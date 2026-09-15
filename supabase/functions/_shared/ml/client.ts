// Shared client for the local ML inference API (ml/api/server.py), used by
// both URL analysis (Phase 5) and email content analysis (Phase 8-9).
// Mirrors frontend/src/lib/mock/ml-client.ts's proven fallback pattern:
// short timeout, fails silently to null — this is additive evidence, never
// a required dependency. If the Python API isn't running, callers proceed
// with deterministic-only evidence exactly as if this were never called.

import type { Finding } from "../email/evidence.ts";
import { getEnv } from "../env.ts";

const ML_API_URL = getEnv("ML_API_URL") ?? "http://localhost:8000";

export interface MlAnalyzeResult {
  fraud_probability: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  model: string;
  model_version: string;
  indicators: { label: string; severity: "LOW" | "MEDIUM" | "HIGH" }[];
  confidence: string;
}

type FetchLike = typeof fetch;

export async function callAnalyze(
  body: Record<string, unknown>,
  fetchImpl: FetchLike = fetch,
): Promise<MlAnalyzeResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetchImpl(`${ML_API_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as MlAnalyzeResult;
  } catch {
    return null;
  }
}

export function mlPredictUrl(url: string, fetchImpl?: FetchLike): Promise<MlAnalyzeResult | null> {
  return callAnalyze({ type: "url", content: url }, fetchImpl);
}

export function mlPredictEmail(text: string, fetchImpl?: FetchLike): Promise<MlAnalyzeResult | null> {
  return callAnalyze({ type: "email", content: text }, fetchImpl);
}

const severityMap: Record<"LOW" | "MEDIUM" | "HIGH", Finding["severity"]> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

/** Converts an ML API result into the shared Finding shape used by every other evidence source. */
export function mlResultToFindings(result: MlAnalyzeResult, idPrefix: string): Finding[] {
  return result.indicators.map((indicator, i) => ({
    id: `${idPrefix}_${i}`,
    finding: indicator.label,
    severity: severityMap[indicator.severity],
    evidence: `${result.model} (${result.model_version}): fraud_probability=${result.fraud_probability.toFixed(3)}`,
    source: "ml_model" as const,
    confidence: "medium" as const,
    explanation: `Trained model prediction — ${result.confidence}.`,
  }));
}
