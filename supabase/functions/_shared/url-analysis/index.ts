// Phase 5 — URL analysis entry point: deterministic findings always run;
// the trained ML model's prediction is added on top when ml/api/server.py
// is reachable, and silently omitted (not faked) when it isn't.

import type { Finding } from "../email/evidence.ts";
import { analyzeUrl as analyzeUrlDeterministic, type UrlAnalysisResult } from "./analyzer.ts";
import { mlPredictUrl, mlResultToFindings } from "../ml/client.ts";

export interface FullUrlAnalysisResult extends UrlAnalysisResult {
  mlModelAvailable: boolean;
}

export async function analyzeUrlWithMl(rawUrl: string): Promise<FullUrlAnalysisResult> {
  const deterministic = analyzeUrlDeterministic(rawUrl);
  const mlResult = await mlPredictUrl(rawUrl);

  const findings: Finding[] = [...deterministic.findings];
  if (mlResult) {
    findings.push(...mlResultToFindings(mlResult, "ml_url_model"));
  }

  return { features: deterministic.features, findings, mlModelAvailable: mlResult !== null };
}

export { analyzeUrl } from "./analyzer.ts";
export { extractUrlFeatures } from "./features.ts";
export type { UrlFeatures } from "./features.ts";
export type { UrlAnalysisResult } from "./analyzer.ts";
