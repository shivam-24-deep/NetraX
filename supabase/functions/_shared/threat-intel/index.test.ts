import { test } from "node:test";
import assert from "node:assert/strict";
import { checkIndicator, threatIntelResultToFinding } from "./index.ts";
import type { ThreatIntelProvider } from "./types.ts";

function stubProvider(name: string, supported: boolean, result: Awaited<ReturnType<ThreatIntelProvider["lookup"]>>): ThreatIntelProvider {
  return {
    name,
    supports: () => supported,
    lookup: async () => result,
  };
}

test("checkIndicator only calls providers that support the indicator type", async () => {
  const supported = stubProvider("A", true, { status: "not_found", source: "A", indicator: "x", message: "Not found in threat-intelligence source." });
  const unsupported = stubProvider("B", false, { status: "not_found", source: "B", indicator: "x", message: "n/a" });
  const results = await checkIndicator("x", "url", [supported, unsupported]);
  assert.equal(results.length, 1);
  assert.equal(results[0].source, "A");
});

test("threatIntelResultToFinding never phrases not_found as safe", () => {
  const finding = threatIntelResultToFinding({ status: "not_found", source: "URLhaus", indicator: "http://x.com", message: "Not found in threat-intelligence source." });
  assert.doesNotMatch(finding.explanation.toLowerCase(), /this is safe|is not malicious/);
  assert.match(finding.explanation.toLowerCase(), /does not mean/);
});

test("threatIntelResultToFinding marks unavailable with low confidence, not a negative result", () => {
  const finding = threatIntelResultToFinding({ status: "unavailable", source: "PhishTank", indicator: "http://x.com", message: "Threat intelligence unavailable — PHISHTANK_APP_KEY is not configured." });
  assert.equal(finding.confidence, "low");
  assert.equal(finding.severity, "info");
});

test("threatIntelResultToFinding escalates severity for a confirmed match", () => {
  const finding = threatIntelResultToFinding({
    status: "matched",
    result: {
      indicator: "http://evil.example", indicator_type: "url", matched: true, source: "URLhaus",
      confidence: "high", first_seen: null, last_seen: null, category: "malware_download", metadata: {},
    },
  });
  assert.equal(finding.severity, "critical");
});
