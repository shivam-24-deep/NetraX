// Phase 6 — Threat Intelligence entry point: runs every provider that
// supports the given indicator type and converts results into the shared
// Finding shape. "Not found" and "unavailable" are never collapsed into
// each other or into a positive "safe" signal — see types.ts.

import type { Finding } from "../email/evidence.ts";
import { PhishTankProvider } from "./phishtank.ts";
import { URLhausProvider } from "./urlhaus.ts";
import type { IndicatorType, ThreatIntelLookupResult, ThreatIntelProvider } from "./types.ts";

export function defaultProviders(): ThreatIntelProvider[] {
  return [new URLhausProvider(), new PhishTankProvider()];
}

export async function checkIndicator(
  indicator: string,
  indicatorType: IndicatorType,
  providers: ThreatIntelProvider[] = defaultProviders(),
): Promise<ThreatIntelLookupResult[]> {
  const applicable = providers.filter((p) => p.supports(indicatorType));
  return Promise.all(applicable.map((p) => p.lookup(indicator, indicatorType)));
}

export function threatIntelResultToFinding(result: ThreatIntelLookupResult): Finding {
  if (result.status === "matched") {
    const m = result.result;
    return {
      id: `threat_intel_${m.source.toLowerCase()}_match`,
      finding: `${m.source} has a record for this ${m.indicator_type}${m.category ? ` (category: ${m.category})` : ""}`,
      severity: m.confidence === "high" ? "critical" : "high",
      evidence: `${m.indicator} — matched in ${m.source}`,
      source: "threat_intelligence",
      confidence: m.confidence,
      explanation: `${m.source} has confirmed this indicator as malicious${m.first_seen ? ` (first seen: ${m.first_seen})` : ""}.`,
    };
  }
  if (result.status === "not_found") {
    return {
      id: `threat_intel_${result.source.toLowerCase()}_not_found`,
      finding: `Not found in ${result.source}`,
      severity: "info",
      evidence: result.indicator,
      source: "threat_intelligence",
      confidence: "high",
      explanation: `${result.source} has no record of this indicator. This does NOT mean it is safe — it only means this one source has no match.`,
    };
  }
  return {
    id: `threat_intel_${result.source.toLowerCase()}_unavailable`,
    finding: `${result.source} threat intelligence unavailable`,
    severity: "info",
    evidence: result.indicator,
    source: "threat_intelligence",
    confidence: "low",
    explanation: result.message,
  };
}

export { PhishTankProvider } from "./phishtank.ts";
export { URLhausProvider } from "./urlhaus.ts";
export type { IndicatorType, ThreatIntelLookupResult, ThreatIntelMatch, ThreatIntelProvider } from "./types.ts";
