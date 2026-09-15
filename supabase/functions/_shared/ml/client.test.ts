import { test } from "node:test";
import assert from "node:assert/strict";
import { callAnalyze, mlResultToFindings } from "./client.ts";

function fakeFetch(response: { ok: boolean; body?: unknown }): typeof fetch {
  return (async () => ({ ok: response.ok, status: response.ok ? 200 : 500, json: async () => response.body }) as Response) as typeof fetch;
}

test("returns null when the ML API is unreachable (fetch throws)", async () => {
  const throwingFetch = (async () => {
    throw new Error("connection refused");
  }) as unknown as typeof fetch;
  const result = await callAnalyze({ type: "url", content: "http://x.com" }, throwingFetch);
  assert.equal(result, null);
});

test("returns null on a non-ok HTTP response", async () => {
  const result = await callAnalyze({ type: "url", content: "http://x.com" }, fakeFetch({ ok: false }));
  assert.equal(result, null);
});

test("returns the parsed result on success", async () => {
  const body = { fraud_probability: 0.8, risk_level: "HIGH", model: "LinearSVM", model_version: "v1", indicators: [{ label: "test", severity: "HIGH" }], confidence: "full" };
  const result = await callAnalyze({ type: "email", content: "x" }, fakeFetch({ ok: true, body }));
  assert.deepEqual(result, body);
});

test("mlResultToFindings maps severities and prefixes ids", () => {
  const findings = mlResultToFindings(
    { fraud_probability: 0.9, risk_level: "HIGH", model: "LinearSVM", model_version: "v1", indicators: [{ label: "flagged", severity: "HIGH" }], confidence: "full" },
    "ml_email_model",
  );
  assert.equal(findings[0].id, "ml_email_model_0");
  assert.equal(findings[0].severity, "high");
  assert.equal(findings[0].source, "ml_model");
});
