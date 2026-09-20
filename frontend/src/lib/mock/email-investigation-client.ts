/**
 * Client for the real email investigation backend (Phases 3-13).
 *
 * Talks to server/local-api.ts by default (a Node HTTP server exposing the
 * same shared TS logic the Supabase Edge Functions in supabase/functions/
 * use — see that file's header comment for why: no Deno CLI or Docker is
 * available in this environment to run/deploy the Edge Functions directly).
 * Set VITE_LOCAL_API_URL to point elsewhere (e.g. a deployed Edge Function
 * base URL) without any other code change.
 */

import { toast } from "sonner"

import { supabase } from "@/lib/supabase"

const LOCAL_API_URL = import.meta.env.VITE_LOCAL_API_URL || "http://localhost:8787"

// The deployed API requires the signed-in user's Supabase access token; the
// local dev server ignores it. ngrok-skip-browser-warning bypasses ngrok's
// one-time interstitial page when LOCAL_API_URL is a tunnel — a harmless
// no-op otherwise.
async function apiHeaders(json = false): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "ngrok-skip-browser-warning": "true" }
  if (json) headers["Content-Type"] = "application/json"
  try {
    const { data } = await supabase.auth.getSession()
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`
  } catch {
    // no session available — the request goes out unauthenticated
  }
  return headers
}

/** Says why a rejected call failed instead of the generic "backend unavailable". */
function explainRejection(status: number): void {
  if (status === 401) toast.error("Your session expired. Please sign in again.")
  else if (status === 429) toast.error("Too many requests — please wait a minute and try again.")
}

export type ToolStatus = "success" | "skipped" | "error"

export interface RemoteToolExecutionRecord {
  tool: string
  status: ToolStatus
  reason?: string
  startedAt: string
  durationMs: number
  findingCount: number
}

export type Severity = "info" | "low" | "medium" | "high" | "critical"

export interface RemoteFinding {
  id: string
  finding: string
  severity: Severity
  evidence: string
  source: string
  confidence: "low" | "medium" | "high"
  explanation: string
}

export interface RemoteRiskAssessment {
  score: number
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  breakdown: { source: string; rawPoints: number; cappedPoints: number; findingIds: string[] }[]
  topReasons: { finding: string; severity: Severity; source: string; explanation: string }[]
}

export interface RemoteGraphNode {
  id: string
  type: string
  label: string
  data: Record<string, unknown>
}

export interface RemoteGraphEdge {
  from: string
  to: string
  relationship: string
}

export interface RemoteInvestigationResult {
  parsedEmail: {
    format: string
    headers: Record<string, unknown> & {
      from?: string
      subject?: string
      spf?: string
      dkim?: string
      dmarc?: string
    }
    body: { text?: string; html?: string; htmlAsText?: string }
    indicators: {
      urls: string[]
      domains: string[]
      emailAddresses: string[]
      ipAddresses: string[]
      phoneNumbers: string[]
      cryptoAddresses: string[]
      attachments: { filename?: string; contentType?: string; sizeBytes?: number }[]
    }
    warnings: string[]
  }
  allFindings: RemoteFinding[]
  riskAssessment: RemoteRiskAssessment
  evidenceGraph: { nodes: RemoteGraphNode[]; edges: RemoteGraphEdge[] }
  toolLog: RemoteToolExecutionRecord[]
}

export interface RemoteUrlFeatures {
  url: string
  hostname: string
  isValid: boolean
  [key: string]: unknown
}

export interface RemoteUrlInvestigationResult {
  url: string
  urlAnalysis: { features: RemoteUrlFeatures; findings: RemoteFinding[]; mlModelAvailable: boolean }
  threatIntelResults: unknown[]
  allFindings: RemoteFinding[]
  riskAssessment: RemoteRiskAssessment
  evidenceGraph: { nodes: RemoteGraphNode[]; edges: RemoteGraphEdge[] }
  toolLog: RemoteToolExecutionRecord[]
}

let apiAvailable: boolean | null = null

export function isEmailApiKnownAvailable(): boolean | null {
  return apiAvailable
}

export async function investigateEmailRemote(rawEmail: string): Promise<RemoteInvestigationResult | null> {
  try {
    const controller = new AbortController()
    // Investigations make several real network calls in sequence (ML model,
    // threat intel, geolocation). The generous limit also covers a hosted free-tier
    // API that has spun down and needs ~50s to wake before it can answer.
    const timeout = setTimeout(() => controller.abort(), 90_000)
    const res = await fetch(`${LOCAL_API_URL}/investigate-email`, {
      method: "POST",
      headers: await apiHeaders(true),
      body: JSON.stringify({ input: rawEmail }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) {
      explainRejection(res.status)
      apiAvailable = false
      return null
    }
    apiAvailable = true
    return (await res.json()) as RemoteInvestigationResult
  } catch {
    apiAvailable = false
    return null
  }
}

export async function investigateUrlRemote(url: string): Promise<RemoteUrlInvestigationResult | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 75_000) // covers a free-tier cold start
    const res = await fetch(`${LOCAL_API_URL}/investigate-url`, {
      method: "POST",
      headers: await apiHeaders(true),
      body: JSON.stringify({ url }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) {
      explainRejection(res.status)
      apiAvailable = false
      return null
    }
    apiAvailable = true
    return (await res.json()) as RemoteUrlInvestigationResult
  } catch {
    apiAvailable = false
    return null
  }
}

// --- Gmail auto-detect ------------------------------------------------------
// Thin client for server/local-api.ts's OAuth + polling endpoints
// (server/gmail-client.ts). "Connect Gmail" is a full-page navigation (OAuth
// requires a real browser redirect through Google, not a fetch), everything
// else here is a normal JSON call.

export interface GoogleAuthStatus {
  configured: boolean
  connected: boolean
}

export async function getGoogleAuthStatus(): Promise<GoogleAuthStatus | null> {
  try {
    const res = await fetch(`${LOCAL_API_URL}/auth/google/status`, { headers: await apiHeaders() })
    if (!res.ok) return null
    return (await res.json()) as GoogleAuthStatus
  } catch {
    return null
  }
}

export function googleConnectUrl(): string {
  return `${LOCAL_API_URL}/auth/google/start`
}

export async function disconnectGmailRemote(): Promise<boolean> {
  try {
    const res = await fetch(`${LOCAL_API_URL}/auth/google/disconnect`, { method: "POST", headers: await apiHeaders() })
    return res.ok
  } catch {
    return false
  }
}

export interface GmailCheckNewResult {
  scanned: number
  results: { messageId: string; rawEmail: string; result: RemoteInvestigationResult }[]
}

export async function checkGmailForNew(): Promise<GmailCheckNewResult | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    const res = await fetch(`${LOCAL_API_URL}/gmail/check-new`, {
      method: "POST",
      headers: await apiHeaders(),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    return (await res.json()) as GmailCheckNewResult
  } catch {
    return null
  }
}
