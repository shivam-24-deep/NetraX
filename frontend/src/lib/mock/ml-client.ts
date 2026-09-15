/**
 * Thin client for the local ML inference API (ml/api/server.py).
 *
 * This is additive evidence on top of the existing rule-based tools, not a
 * replacement — if the Python API isn't running (the common case for
 * anyone who hasn't started it), every call here fails fast and silently,
 * and the agent continues with its existing rule-based evidence exactly as
 * before. No UI, type, or existing behavior changes when the API is absent.
 */

import type { Evidence } from "@/types/fraud"

const ML_API_URL = import.meta.env.VITE_ML_API_URL || "http://localhost:8000"

export interface MlAnalyzeResult {
  fraud_probability: number
  risk_level: "LOW" | "MEDIUM" | "HIGH"
  model: string
  model_version: string
  indicators: { label: string; severity: "LOW" | "MEDIUM" | "HIGH" }[]
  confidence: string
}

let apiAvailable: boolean | null = null

async function callAnalyze(body: Record<string, unknown>): Promise<MlAnalyzeResult | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    const res = await fetch(`${ML_API_URL}/analyze`, {
      method: "POST",
      // ngrok-skip-browser-warning bypasses ngrok's one-time interstitial HTML
      // page when ML_API_URL is a tunnel — harmless no-op against localhost.
      headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) {
      apiAvailable = false
      return null
    }
    apiAvailable = true
    return (await res.json()) as MlAnalyzeResult
  } catch {
    apiAvailable = false
    return null
  }
}

export function isMlApiKnownAvailable(): boolean | null {
  return apiAvailable
}

export async function mlPredictSms(text: string): Promise<MlAnalyzeResult | null> {
  return callAnalyze({ type: "sms", content: text })
}

export async function mlPredictUrl(url: string): Promise<MlAnalyzeResult | null> {
  return callAnalyze({ type: "url", content: url })
}

/** Converts an ML API result's indicators into the app's shared Evidence shape. */
export function mlResultToEvidence(result: MlAnalyzeResult, source: string): Evidence[] {
  return result.indicators.map((i) => ({
    label: i.label,
    severity: i.severity,
    source,
    detail: `${result.model} (${result.model_version}) — ${result.confidence}`,
  }))
}
