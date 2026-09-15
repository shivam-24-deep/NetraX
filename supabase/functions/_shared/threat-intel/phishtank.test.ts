import { test } from "node:test";
import assert from "node:assert/strict";
import { PhishTankProvider } from "./phishtank.ts";

function fakeFetch(response: { ok: boolean; status?: number; body?: unknown }): typeof fetch {
  return (async () =>
    ({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      json: async () => response.body,
    }) as Response) as typeof fetch;
}

test("reports unavailable when no app key is configured", async () => {
  const provider = new PhishTankProvider({ appKey: undefined, fetchImpl: fakeFetch({ ok: true, body: {} }) });
  const result = await provider.lookup("http://evil.example/x", "url");
  assert.equal(result.status, "unavailable");
});

test("reports matched when in_database is true", async () => {
  const fetchImpl = fakeFetch({
    ok: true,
    body: { results: { in_database: true, verified: true, phish_id: "123", verified_at: "2026-01-01T00:00:00Z" } },
  });
  const provider = new PhishTankProvider({ appKey: "test-key", fetchImpl });
  const result = await provider.lookup("http://evil.example/x", "url");
  assert.equal(result.status, "matched");
  if (result.status === "matched") {
    assert.equal(result.result.confidence, "high");
    assert.equal(result.result.category, "phishing");
  }
});

test("reports lower confidence when matched but not verified", async () => {
  const fetchImpl = fakeFetch({ ok: true, body: { results: { in_database: true, verified: false } } });
  const provider = new PhishTankProvider({ appKey: "test-key", fetchImpl });
  const result = await provider.lookup("http://evil.example/x", "url");
  assert.equal(result.status, "matched");
  if (result.status === "matched") assert.equal(result.result.confidence, "medium");
});

test("reports not_found when in_database is false — never reports safe", async () => {
  const fetchImpl = fakeFetch({ ok: true, body: { results: { in_database: false } } });
  const provider = new PhishTankProvider({ appKey: "test-key", fetchImpl });
  const result = await provider.lookup("http://clean.example/x", "url");
  assert.equal(result.status, "not_found");
  assert.doesNotMatch(result.message.toLowerCase(), /\bsafe\b/);
});

test("rejects non-url indicator types as unavailable rather than guessing", async () => {
  const provider = new PhishTankProvider({ appKey: "test-key", fetchImpl: fakeFetch({ ok: true, body: {} }) });
  const result = await provider.lookup("203.0.113.5", "ip");
  assert.equal(result.status, "unavailable");
});

test("only supports url indicator type", () => {
  const provider = new PhishTankProvider();
  assert.equal(provider.supports("url"), true);
  assert.equal(provider.supports("domain"), false);
  assert.equal(provider.supports("ip"), false);
});
