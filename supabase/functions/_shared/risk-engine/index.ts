// Phase 11 — Deterministic Risk Engine.
//
// Rule 9: the deterministic engine calculates the final score — no LLM ever
// sets or adjusts it (an LLM may only explain an already-computed score,
// per Rule 8). Every point on the score traces back to a real Finding; there
// is no hidden fudge factor.
//
// METHODOLOGY (documented here since the UI must explain WHY a score
// exists — see docs/RISK_SCORING.md for the same explanation in prose):
//   1. Each Finding contributes points based on its severity:
//        critical=25, high=15, medium=8, low=3, info=0
//   2. Points are summed PER EVIDENCE SOURCE, then capped at that source's
//      ceiling (below) — this stops one noisy source (e.g. five low-severity
//      URL quirks) from single-handedly driving the score up, while still
//      letting one truly severe finding from any source matter a lot.
//   3. Capped per-source totals are summed and clamped to [0, 100].
//   4. Risk level: 0-24 LOW, 25-49 MEDIUM, 50-74 HIGH, 75-100 CRITICAL.

import type { EvidenceSource, Finding, Severity } from "../email/evidence.ts";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskScoreBreakdown {
  source: EvidenceSource;
  rawPoints: number;
  cappedPoints: number;
  findingIds: string[];
}

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  breakdown: RiskScoreBreakdown[];
  /** Highest-severity findings, in order — the literal basis for "why this score", never invented text. */
  topReasons: Array<{ finding: string; severity: Severity; source: EvidenceSource; explanation: string }>;
}

const SEVERITY_POINTS: Record<Severity, number> = {
  info: 0,
  low: 3,
  medium: 8,
  high: 15,
  critical: 25,
};

// Per-source ceilings: threat intelligence and the ML model are the
// strongest independent signals (external confirmation / trained pattern
// recognition), so they're allowed to contribute the most; structural
// signals like the Received chain or Message-ID are capped lower since
// they're the weakest/most heuristic evidence categories.
const SOURCE_CAP: Record<EvidenceSource, number> = {
  sender_analysis: 30,
  domain_analysis: 30,
  authentication: 25,
  received_chain: 15,
  message_id: 10,
  timestamp_analysis: 15,
  url_analysis: 30,
  threat_intelligence: 40,
  ip_geolocation: 10,
  ml_model: 35,
  content_analysis: 20,
};

const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function levelForScore(score: number): RiskLevel {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

export function computeRiskScore(findings: Finding[]): RiskAssessment {
  const bySource = new Map<EvidenceSource, Finding[]>();
  for (const f of findings) {
    if (!bySource.has(f.source)) bySource.set(f.source, []);
    bySource.get(f.source)!.push(f);
  }

  const breakdown: RiskScoreBreakdown[] = [];
  let total = 0;
  for (const [source, sourceFindings] of bySource) {
    const rawPoints = sourceFindings.reduce((sum, f) => sum + SEVERITY_POINTS[f.severity], 0);
    const cap = SOURCE_CAP[source] ?? 20;
    const cappedPoints = Math.min(rawPoints, cap);
    breakdown.push({ source, rawPoints, cappedPoints, findingIds: sourceFindings.map((f) => f.id) });
    total += cappedPoints;
  }

  const score = Math.max(0, Math.min(100, Math.round(total)));

  const topReasons = [...findings]
    .filter((f) => f.severity !== "info")
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
    .slice(0, 6)
    .map((f) => ({ finding: f.finding, severity: f.severity, source: f.source, explanation: f.explanation }));

  return { score, level: levelForScore(score), breakdown, topReasons };
}
