import { useSyncExternalStore } from "react"

import type { CaseAlert, CaseFeedbackAction, CaseFeedbackEntry, CaseStatus, FraudCase } from "@/types/fraud"

import { seedCases } from "./seed-cases"

const STORAGE_KEY = "netrax.cases.v1"
const ALERTS_STORAGE_KEY = "netrax.alerts.v1"

function loadInitial(): FraudCase[] {
  if (typeof window === "undefined") return seedCases
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedCases
    const parsed = JSON.parse(raw) as FraudCase[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedCases
  } catch {
    return seedCases
  }
}

function loadInitialAlerts(): CaseAlert[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(ALERTS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CaseAlert[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

let cases: FraudCase[] = loadInitial()
let alerts: CaseAlert[] = loadInitialAlerts()
const listeners = new Set<() => void>()

function emit() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cases))
      window.localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts))
    } catch {
      // ignore quota / privacy-mode errors — in-memory state still updates
    }
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return cases
}

function getAlertsSnapshot() {
  return alerts
}

/**
 * Real alert triggering (SIH26106 §23): a HIGH/CRITICAL case automatically
 * creates an alert record — never a fake/animated notification, and never
 * a real-world push/email/SMS (not supported by this prototype).
 */
function maybeCreateAlert(fraudCase: FraudCase) {
  if (fraudCase.riskLevel !== "HIGH" && fraudCase.riskLevel !== "CRITICAL") return
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
}

export function addCase(fraudCase: FraudCase) {
  cases = [fraudCase, ...cases]
  maybeCreateAlert(fraudCase)
  emit()
}

export function updateCaseStatus(id: string, status: CaseStatus) {
  cases = cases.map((c) => (c.id === id ? { ...c, status } : c))
  emit()
}

export function toggleSaved(id: string) {
  cases = cases.map((c) => (c.id === id ? { ...c, savedByMe: !c.savedByMe } : c))
  emit()
}

export function toggleWatchlisted(id: string) {
  cases = cases.map((c) => (c.id === id ? { ...c, watchlisted: !c.watchlisted } : c))
  emit()
}

export function getCaseById(id: string): FraudCase | undefined {
  return cases.find((c) => c.id === id)
}

/** Idempotency check: same submitted-email bytes must not create a second case. */
export function findCaseByEmailHash(emailHash: string): FraudCase | undefined {
  return cases.find((c) => c.emailHash === emailHash)
}

export function updateCase(id: string, patch: Partial<FraudCase>) {
  cases = cases.map((c) => (c.id === id ? { ...c, ...patch } : c))
  emit()
}

/** Human-in-the-loop feedback (SIH26106 §25) — recorded only, never auto-applies a destructive action. */
export function addCaseFeedback(id: string, action: CaseFeedbackAction, note?: string) {
  const entry: CaseFeedbackEntry = { action, note, timestamp: new Date().toISOString() }
  cases = cases.map((c) => (c.id === id ? { ...c, feedback: [...(c.feedback ?? []), entry] } : c))
  emit()
}

export function useCases(): FraudCase[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => seedCases)
}

export function useCase(id: string | undefined): FraudCase | undefined {
  const all = useCases()
  return all.find((c) => c.id === id)
}

export function useAlerts(): CaseAlert[] {
  return useSyncExternalStore(subscribe, getAlertsSnapshot, () => [])
}
