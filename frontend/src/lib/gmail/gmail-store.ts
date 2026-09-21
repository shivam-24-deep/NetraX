// Module-level singleton for Gmail connection/auto-detect state — shared
// across every component (the background poller started once from AppLayout,
// Settings' Integrations tab) via the same subscribe/emit pattern
// lib/mock/store.ts already uses, so only one poll interval ever runs
// regardless of how many components read this state.

import { useSyncExternalStore } from "react"
import { toast } from "sonner"

import { sha256Hex } from "@/lib/hash"
import { buildFraudCaseFromEmailResult } from "@/lib/mock/engine"
import { checkGmailForNew, getGoogleAuthStatus } from "@/lib/mock/email-investigation-client"
import { addCase, findCaseByEmailHash } from "@/lib/mock/store"

const POLL_INTERVAL_MS = 30_000
const AUTO_DETECT_STORAGE_KEY = "netrax.gmail-auto-detect-enabled.v1"

interface GmailState {
  /** null = not checked yet */
  configured: boolean | null
  connected: boolean | null
  autoDetectEnabled: boolean
  scanning: boolean
  lastCheckedAt: string | null
  lastError: string | null
  /** How many new cases the MOST RECENT scan created — 0 is a real, meaningful result ("checked, found nothing"), not "not checked yet". */
  lastScanFoundCount: number | null
  /** Running total across this browser session, so a case found by a silent background poll is never invisible even if its toast was missed. */
  totalAutoDetectedCount: number
  /** The connected Google account's address. */
  email: string | null
  /** Why the connection state could not be read (e.g. database table missing). */
  statusError: string | null
}

// On once a user has connected their own Gmail; they can switch it off here.
function loadAutoDetectPref(): boolean {
  if (typeof window === "undefined") return true
  try {
    return window.localStorage.getItem(AUTO_DETECT_STORAGE_KEY) !== "false"
  } catch {
    return true
  }
}

function initialState(): GmailState {
  return {
    configured: null,
    connected: null,
    autoDetectEnabled: loadAutoDetectPref(),
    scanning: false,
    lastCheckedAt: null,
    lastError: null,
    lastScanFoundCount: null,
    totalAutoDetectedCount: 0,
    email: null,
    statusError: null,
  }
}

let state: GmailState = initialState()
const listeners = new Set<() => void>()

function setState(patch: Partial<GmailState>) {
  state = { ...state, ...patch }
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return state
}

export function useGmailState(): GmailState {
  return useSyncExternalStore(subscribe, getSnapshot, () => state)
}

export async function refreshGmailStatus(): Promise<void> {
  const status = await getGoogleAuthStatus()
  setState({
    configured: status?.configured ?? false,
    connected: status?.connected ?? false,
    email: status?.email ?? null,
    statusError: status?.error ?? null,
  })
}

export function setAutoDetectEnabled(enabled: boolean): void {
  setState({ autoDetectEnabled: enabled })
  try {
    window.localStorage.setItem(AUTO_DETECT_STORAGE_KEY, String(enabled))
  } catch {
    // per-viewer convenience only — safe to lose on quota/privacy-mode errors
  }
}

export async function scanGmailNow(): Promise<{ scanned: number; flagged: number } | null> {
  if (!state.connected || state.scanning) return null
  setState({ scanning: true, lastError: null })
  try {
    const res = await checkGmailForNew()
    if (!res.ok) {
      // A revoked/expired Google grant means "not connected" again, not a transient error.
      setState({ scanning: false, lastError: res.error, ...(res.reconnect ? { connected: false, email: null } : {}) })
      return null
    }
    let flagged = 0
    for (const item of res.data.results) {
      const hash = await sha256Hex(item.rawEmail)
      if (findCaseByEmailHash(hash)) continue // already investigated — idempotency, same as every other entry point
      const fraudCase = await buildFraudCaseFromEmailResult(item.rawEmail, item.result, "gmail_auto")
      await addCase(fraudCase)
      flagged += 1
      // Every auto-created case gets a visible toast (not just HIGH/CRITICAL) — a
      // silent background poll finding something is exactly the case a user is
      // most likely to miss otherwise, since nothing prompted them to look.
      const toastFn = fraudCase.riskLevel === "HIGH" || fraudCase.riskLevel === "CRITICAL" ? toast.error : toast.message
      toastFn(`NetraX auto-detected a new email from Gmail — ${fraudCase.riskLevel} risk`, {
        description: fraudCase.input,
        duration: 10_000,
      })
    }
    setState({
      scanning: false,
      lastCheckedAt: new Date().toISOString(),
      lastScanFoundCount: flagged,
      totalAutoDetectedCount: state.totalAutoDetectedCount + flagged,
    })
    return { scanned: res.data.scanned, flagged }
  } catch (err) {
    setState({ scanning: false, lastError: err instanceof Error ? err.message : "Gmail scan failed." })
    return null
  }
}

let pollHandle: ReturnType<typeof setInterval> | null = null

/** Idempotent — safe to call from multiple mounted components; only the first call actually starts the interval. */
export function startGmailPolling(): void {
  if (pollHandle) return
  void refreshGmailStatus().then(() => {
    if (state.connected && state.autoDetectEnabled) void scanGmailNow()
  })
  pollHandle = setInterval(() => {
    if (state.connected && state.autoDetectEnabled && !state.scanning) void scanGmailNow()
  }, POLL_INTERVAL_MS)
}

/** Stops polling and forgets the previous user's Gmail state — called on sign-out / user change so one account's mailbox status never shows for the next. */
export function stopGmailPolling(): void {
  if (pollHandle) {
    clearInterval(pollHandle)
    pollHandle = null
  }
  setState(initialState())
}
