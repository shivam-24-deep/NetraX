import { useSyncExternalStore } from "react"
import { toast } from "sonner"

import { supabase } from "@/lib/supabase"
import type { CaseAlert, CaseFeedbackAction, CaseFeedbackEntry, CaseStatus, FraudCase } from "@/types/fraud"

// Per-user case store backed by Supabase (public.cases / public.alerts, private
// to each user via RLS). A new account starts empty — nothing is seeded. With
// no signed-in user (tests, signed-out pages) it is a plain in-memory store.

export type StoreStatus = "idle" | "loading" | "ready" | "error"
interface StoreMeta {
  status: StoreStatus
  error: string | null
}

const LEGACY_LOCAL_KEYS = ["netrax.cases.v1", "netrax.alerts.v1"]
const MAX_ROWS = 1000

let cases: FraudCase[] = []
let alerts: CaseAlert[] = []
let meta: StoreMeta = { status: "idle", error: null }
let userId: string | null = null
let loadToken = 0
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

interface CaseRow {
  data: FraudCase
  status: CaseStatus
  saved: boolean
  watchlisted: boolean
}

interface AlertRow {
  id: string
  case_id: string
  severity: CaseAlert["severity"]
  threat_type: CaseAlert["threatType"]
  reason: string
  created_at: string
}

function caseToRow(c: FraudCase, owner: string) {
  return {
    user_id: owner,
    id: c.id,
    input_type: c.inputType,
    category: c.category,
    risk_score: c.riskScore,
    risk_level: c.riskLevel,
    status: c.status,
    source: c.source ?? null,
    email_hash: c.emailHash ?? null,
    saved: !!c.savedByMe,
    watchlisted: !!c.watchlisted,
    created_at: c.createdAt,
    data: c,
  }
}

function rowToCase(row: CaseRow): FraudCase {
  return { ...row.data, status: row.status, savedByMe: row.saved, watchlisted: row.watchlisted }
}

function rowToAlert(row: AlertRow): CaseAlert {
  return {
    id: row.id,
    caseId: row.case_id,
    severity: row.severity,
    threatType: row.threat_type,
    reason: row.reason,
    createdAt: row.created_at,
  }
}

function describeError(error: { message: string; code?: string }): string {
  if (error.code === "PGRST205" || /could not find the table|does not exist/i.test(error.message)) {
    return "Your database isn't set up yet. Run supabase/migrations/20260919120000_user_workspace.sql in the Supabase SQL Editor, then reload."
  }
  return error.message
}

function reportSyncError(what: string, message: string) {
  toast.error(`Couldn't save ${what} to your account: ${message}`)
}

// ---------------------------------------------------------------------------
// Lifecycle (driven by AuthProvider)
// ---------------------------------------------------------------------------

function purgeLegacyLocalData() {
  try {
    for (const key of LEGACY_LOCAL_KEYS) window.localStorage.removeItem(key)
  } catch {
    // storage unavailable — nothing to purge
  }
}

export async function loadStoreForUser(id: string): Promise<void> {
  if (userId === id && meta.status !== "error") return
  userId = id
  cases = []
  alerts = []
  meta = { status: "loading", error: null }
  purgeLegacyLocalData()
  emit()

  const token = ++loadToken
  try {
    const [casesRes, alertsRes] = await Promise.all([
      supabase.from("cases").select("data, status, saved, watchlisted").order("created_at", { ascending: false }).limit(MAX_ROWS),
      supabase.from("alerts").select("id, case_id, severity, threat_type, reason, created_at").order("created_at", { ascending: false }).limit(MAX_ROWS),
    ])
    if (token !== loadToken) return
    const error = casesRes.error ?? alertsRes.error
    if (error) {
      meta = { status: "error", error: describeError(error) }
    } else {
      cases = (casesRes.data as CaseRow[]).map(rowToCase)
      alerts = (alertsRes.data as AlertRow[]).map(rowToAlert)
      meta = { status: "ready", error: null }
    }
  } catch {
    if (token !== loadToken) return
    meta = { status: "error", error: "Could not reach your database. Check your connection and retry." }
  }
  emit()
}

export function reloadStore(): void {
  const id = userId
  if (!id) return
  userId = null
  void loadStoreForUser(id)
}

export function resetStore(): void {
  loadToken++
  userId = null
  cases = []
  alerts = []
  meta = { status: "idle", error: null }
  emit()
}

/** Permanently deletes every investigation and alert belonging to the signed-in user. */
export async function deleteAllMyData(): Promise<string | null> {
  if (userId) {
    const [casesRes, alertsRes] = await Promise.all([
      supabase.from("cases").delete().eq("user_id", userId),
      supabase.from("alerts").delete().eq("user_id", userId),
    ])
    const error = casesRes.error ?? alertsRes.error
    if (error) return describeError(error)
  }
  cases = []
  alerts = []
  emit()
  return null
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function persistCase(fraudCase: FraudCase): Promise<void> {
  const owner = userId
  if (!owner) return Promise.resolve()
  return Promise.resolve(
    supabase
      .from("cases")
      .upsert(caseToRow(fraudCase, owner), { onConflict: "user_id,id" })
      .then(({ error }) => {
        if (error) reportSyncError("the case", describeError(error))
      }),
  )
}

function persistAlert(alert: CaseAlert): Promise<void> {
  const owner = userId
  if (!owner) return Promise.resolve()
  return Promise.resolve(
    supabase
      .from("alerts")
    .upsert(
      {
        user_id: owner,
        id: alert.id,
        case_id: alert.caseId,
        severity: alert.severity,
        threat_type: alert.threatType,
        reason: alert.reason,
        created_at: alert.createdAt,
      },
      { onConflict: "user_id,id" },
    )
      .then(({ error }) => {
        if (error) reportSyncError("the alert", describeError(error))
      }),
  )
}

function changeCase(id: string, patch: (c: FraudCase) => FraudCase) {
  const target = cases.find((c) => c.id === id)
  if (!target) return
  const next = patch(target)
  cases = cases.map((c) => (c.id === id ? next : c))
  emit()
  void persistCase(next)
}

/**
 * Real alert triggering (SIH26106 §23): a HIGH/CRITICAL case automatically
 * creates an alert record — never a fake/animated notification, and never
 * a real-world push/email/SMS (not supported by this prototype).
 */
function maybeCreateAlert(fraudCase: FraudCase): Promise<void> {
  if (fraudCase.riskLevel !== "HIGH" && fraudCase.riskLevel !== "CRITICAL") return Promise.resolve()
  const reason =
    fraudCase.riskBreakdown && fraudCase.riskBreakdown.length > 0
      ? `Contributing signals: ${fraudCase.riskBreakdown
          .filter((b) => b.cappedPoints > 0)
          .map((b) => b.source.replaceAll("_", " "))
          .join(", ")}.`
      : fraudCase.explanation
  const alert: CaseAlert = {
    id: `alert_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    caseId: fraudCase.id,
    severity: fraudCase.riskLevel,
    threatType: fraudCase.category,
    reason,
    createdAt: fraudCase.createdAt,
  }
  alerts = [alert, ...alerts]
  return persistAlert(alert)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Adds the case locally right away and resolves once it is saved to the
 * database. Callers that show a "saved" confirmation should await it, so leaving
 * the page straight after cannot cancel the save.
 */
export async function addCase(fraudCase: FraudCase): Promise<void> {
  cases = [fraudCase, ...cases]
  const saved = persistCase(fraudCase)
  const alertSaved = maybeCreateAlert(fraudCase)
  emit()
  await Promise.all([saved, alertSaved])
}

export function updateCaseStatus(id: string, status: CaseStatus) {
  changeCase(id, (c) => ({ ...c, status }))
}

export function toggleSaved(id: string) {
  changeCase(id, (c) => ({ ...c, savedByMe: !c.savedByMe }))
}

export function toggleWatchlisted(id: string) {
  changeCase(id, (c) => ({ ...c, watchlisted: !c.watchlisted }))
}

export function getCaseById(id: string): FraudCase | undefined {
  return cases.find((c) => c.id === id)
}

/** Idempotency check: same submitted-email bytes must not create a second case. */
export function findCaseByEmailHash(emailHash: string): FraudCase | undefined {
  return cases.find((c) => c.emailHash === emailHash)
}

export function updateCase(id: string, patch: Partial<FraudCase>) {
  changeCase(id, (c) => ({ ...c, ...patch }))
}

/** Human-in-the-loop feedback (SIH26106 §25) — recorded only, never auto-applies a destructive action. */
export function addCaseFeedback(id: string, action: CaseFeedbackAction, note?: string) {
  const entry: CaseFeedbackEntry = { action, note, timestamp: new Date().toISOString() }
  changeCase(id, (c) => ({ ...c, feedback: [...(c.feedback ?? []), entry] }))
}

export function useCases(): FraudCase[] {
  return useSyncExternalStore(subscribe, () => cases, () => cases)
}

export function useCase(id: string | undefined): FraudCase | undefined {
  const all = useCases()
  return all.find((c) => c.id === id)
}

export function useAlerts(): CaseAlert[] {
  return useSyncExternalStore(subscribe, () => alerts, () => alerts)
}

export function useStoreMeta(): StoreMeta {
  return useSyncExternalStore(subscribe, () => meta, () => meta)
}
