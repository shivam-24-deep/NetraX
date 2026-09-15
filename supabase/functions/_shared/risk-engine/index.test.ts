import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRiskScore } from "./index.ts";
import type { Finding } from "../email/evidence.ts";

function f(overrides: Partial<Finding>): Finding {
  return {
    id: "f1",
    finding: "test finding",
    severity: "low",
    evidence: "evidence",
    source: "sender_analysis",
    confidence: "medium",
    explanation: "explanation",
    ...overrides,
  };
}

test("no findings produces a zero score and LOW level", () => {
  const result = computeRiskScore([]);
  assert.equal(result.score, 0);
  assert.equal(result.level, "LOW");
});

test("info-severity findings contribute zero points", () => {
  const result = computeRiskScore([f({ severity: "info" }), f({ severity: "info", id: "f2" })]);
  assert.equal(result.score, 0);
});

test("a single critical finding alone only reaches MEDIUM — genuine CRITICAL needs corroboration", () => {
  const result = computeRiskScore([f({ severity: "critical", source: "threat_intelligence" })]);
  assert.equal(result.score, 25);
  assert.equal(result.level, "MEDIUM");
});

test("per-source cap prevents one noisy source from dominating", () => {
  // 10 low-severity findings (3 points each = 30 raw) from the same source, capped at 30 for url_analysis.
  const findings = Array.from({ length: 10 }, (_, i) => f({ id: `u${i}`, source: "url_analysis", severity: "low" }));
  const result = computeRiskScore(findings);
  assert.equal(result.score, 30); // capped, not 30 raw coincidentally equal here — verify explicitly below
  const breakdown = result.breakdown.find((b) => b.source === "url_analysis")!;
  assert.equal(breakdown.rawPoints, 30);
  assert.equal(breakdown.cappedPoints, 30);
});

test("per-source cap actually caps when raw points exceed it", () => {
  // 20 low-severity url_analysis findings = 60 raw points, but url_analysis caps at 30.
  const findings = Array.from({ length: 20 }, (_, i) => f({ id: `u${i}`, source: "url_analysis", severity: "low" }));
  const result = computeRiskScore(findings);
  const breakdown = result.breakdown.find((b) => b.source === "url_analysis")!;
  assert.equal(breakdown.rawPoints, 60);
  assert.equal(breakdown.cappedPoints, 30);
  assert.equal(result.score, 30);
});

test("multiple corroborating sources combine to a higher score than any one alone", () => {
  const findings = [
    f({ id: "a", source: "authentication", severity: "high" }), // 15, capped at 25
    f({ id: "b", source: "url_analysis", severity: "high" }), // 15, capped at 30
    f({ id: "c", source: "threat_intelligence", severity: "critical" }), // 25, capped at 40
  ];
  const result = computeRiskScore(findings);
  assert.equal(result.score, 15 + 15 + 25); // 55
  assert.equal(result.level, "HIGH"); // 50-74 range — genuinely CRITICAL (75+) needs even more corroboration than this
});

test("score never exceeds 100 even with many severe findings across sources", () => {
  const sources: Array<Finding["source"]> = ["sender_analysis", "domain_analysis", "authentication", "url_analysis", "threat_intelligence", "ml_model"];
  const findings = sources.flatMap((source, i) =>
    Array.from({ length: 5 }, (_, j) => f({ id: `${source}-${j}`, source, severity: "critical" })),
  );
  const result = computeRiskScore(findings);
  assert.ok(result.score <= 100);
  assert.equal(result.level, "CRITICAL");
});

test("level thresholds match spec boundaries", () => {
  assert.equal(computeRiskScore([f({ severity: "low", source: "message_id" })]).level, "LOW"); // 3 points
  assert.equal(
    computeRiskScore([f({ severity: "high", source: "authentication" }), f({ id: "2", severity: "high", source: "domain_analysis" })]).level,
    "MEDIUM", // 15+15=30 points, within the 25-49 MEDIUM band
  );
  assert.equal(
    computeRiskScore([f({ severity: "critical", source: "threat_intelligence" }), f({ id: "2", severity: "critical", source: "url_analysis" })]).level,
    "HIGH", // 25 (threat_intel) + 25 (url_analysis) = 50 points, exactly the HIGH band's lower boundary
  );
});

test("topReasons excludes info severity and orders by severity descending", () => {
  const findings = [
    f({ id: "i", severity: "info" }),
    f({ id: "l", severity: "low", finding: "low finding" }),
    f({ id: "c", severity: "critical", finding: "critical finding" }),
    f({ id: "h", severity: "high", finding: "high finding" }),
  ];
  const result = computeRiskScore(findings);
  assert.ok(!result.topReasons.some((r) => r.finding === findings[0].finding));
  assert.equal(result.topReasons[0].finding, "critical finding");
  assert.equal(result.topReasons[1].finding, "high finding");
});

test("topReasons caps at 6 entries", () => {
  const findings = Array.from({ length: 10 }, (_, i) => f({ id: `h${i}`, severity: "high", finding: `finding ${i}` }));
  const result = computeRiskScore(findings);
  assert.equal(result.topReasons.length, 6);
});
