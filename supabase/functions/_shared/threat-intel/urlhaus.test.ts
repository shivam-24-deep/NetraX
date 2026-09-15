import { test } from "node:test";
import assert from "node:assert/strict";
import { URLhausProvider } from "./urlhaus.ts";

function fakeFetch(response: { ok: boolean; status?: number; body?: unknown }): typeof fetch {
  return (async () =>
    ({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      json: async () => response.body,
    }) as Response) as typeof fetch;
}

test("reports unavailable when no auth key is configured", async () => {
  const provider = new URLhausProvider({ authKey: undefined, fetchImpl: fakeFetch({ ok: true, body: {} }) });
  const result = await provider.lookup("http://evil.example/x", "url");
  assert.equal(result.status, "unavailable");
});

test("reports matched when query_status is ok", async () => {
  const fetchImpl = fakeFetch({
    ok: true,
    body: { query_status: "ok", threat: "malware_download", url_status: "online", date_added: "2026-01-01 00:00:00 UTC" },
  });
  const provider = new URLhausProvider({ authKey: "test-key", fetchImpl });
  const result = await provider.lookup("http://evil.example/x", "url");
  assert.equal(result.status, "matched");
  if (result.status === "matched") {
    assert.equal(result.result.category, "malware_download");
    assert.equal(result.result.source, "URLhaus");
  }
});

test("reports not_found when query_status is no_results — never reports safe", async () => {
  const fetchImpl = fakeFetch({ ok: true, body: { query_status: "no_results" } });
  const provider = new URLhausProvider({ authKey: "test-key", fetchImpl });
  const result = await provider.lookup("http://clean.example/x", "url");
  assert.equal(result.status, "not_found");
  assert.doesNotMatch(result.message.toLowerCase(), /\bsafe\b/);
});

test("reports unavailable on HTTP error", async () => {
  const fetchImpl = fakeFetch({ ok: false, status: 503 });
  const provider = new URLhausProvider({ authKey: "test-key", fetchImpl });
  const result = await provider.lookup("http://x.example/y", "url");
  assert.equal(result.status, "unavailable");
});

test("reports unavailable when fetch throws (network failure)", async () => {
  const throwingFetch = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  const provider = new URLhausProvider({ authKey: "test-key", fetchImpl: throwingFetch });
  const result = await provider.lookup("http://x.example/y", "url");
  assert.equal(result.status, "unavailable");
});

test("supports url, domain, and ip indicator types", () => {
  const provider = new URLhausProvider();
  assert.equal(provider.supports("url"), true);
  assert.equal(provider.supports("domain"), true);
  assert.equal(provider.supports("ip"), true);
  assert.equal(provider.supports("email"), false);
});
