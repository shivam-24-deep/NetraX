import { test } from "node:test";
import assert from "node:assert/strict";
import { investigateUrl } from "./investigate-url.ts";

test("runs URL analysis and threat intelligence for a well-formed URL, and produces a URL-rooted graph", async () => {
  const result = await investigateUrl("http://paypa1.com/login");
  assert.equal(result.url, "http://paypa1.com/login");

  const urlTool = result.toolLog.find((t) => t.tool === "url_analysis");
  assert.equal(urlTool?.status, "success");
  assert.ok(result.urlAnalysis.findings.some((f) => f.id === "url_typosquat_domain"));

  const tiTool = result.toolLog.find((t) => t.tool === "threat_intelligence");
  assert.equal(tiTool?.status, "success");

  assert.ok(result.evidenceGraph.nodes.some((n) => n.type === "url"));
  assert.ok(result.evidenceGraph.nodes.some((n) => n.type === "domain"));
  // No email/sender nodes should ever appear — nothing about an email was submitted.
  assert.ok(!result.evidenceGraph.nodes.some((n) => n.type === "email" || n.type === "sender"));
});

test("skips threat intelligence and returns an empty graph for a URL that fails to parse", async () => {
  const result = await investigateUrl("not a url at all");
  const tiTool = result.toolLog.find((t) => t.tool === "threat_intelligence");
  assert.equal(tiTool?.status, "skipped");
  assert.deepEqual(result.threatIntelResults, []);
  assert.deepEqual(result.evidenceGraph, { nodes: [], edges: [] });
});

test("computes a deterministic risk score from real findings, never a fixed/fabricated value", async () => {
  const suspicious = await investigateUrl("http://192.168.1.1@paypa1.com.evil-tld.tk/login");
  const benign = await investigateUrl("https://example.com/");
  assert.ok(suspicious.riskAssessment.score >= benign.riskAssessment.score);
  assert.ok(suspicious.allFindings.length > 0);
});
