import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyCors, createRateLimiter, createSupabaseVerifier, parseAllowedOrigins } from "./security.ts";

function fakeRes() {
  const headers: Record<string, string> = {};
  return { headers, setHeader: (k: string, v: string) => void (headers[k] = v) } as never as import("node:http").ServerResponse & { headers: Record<string, string> };
}
const reqWithOrigin = (origin?: string) => ({ headers: origin ? { origin } : {} }) as never as import("node:http").IncomingMessage;

describe("CORS allow-list", () => {
  it("allows any origin when no list is configured (local dev)", () => {
    const res = fakeRes();
    applyCors(reqWithOrigin("http://localhost:5173"), res, parseAllowedOrigins(undefined));
    assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
  });

  it("reflects only listed origins, supports wildcard subdomains, and lists Authorization explicitly", () => {
    const allowed = parseAllowedOrigins("https://netrax.vercel.app, https://*.preview.app");
    const ok = fakeRes();
    applyCors(reqWithOrigin("https://netrax.vercel.app"), ok, allowed);
    assert.equal(ok.headers["Access-Control-Allow-Origin"], "https://netrax.vercel.app");
    assert.match(ok.headers["Access-Control-Allow-Headers"], /Authorization/);

    const wild = fakeRes();
    applyCors(reqWithOrigin("https://pr-12.preview.app"), wild, allowed);
    assert.equal(wild.headers["Access-Control-Allow-Origin"], "https://pr-12.preview.app");

    for (const evil of ["https://evil.example", "https://netrax.vercel.app.evil.example", "http://netrax.vercel.app"]) {
      const bad = fakeRes();
      applyCors(reqWithOrigin(evil), bad, allowed);
      assert.equal(bad.headers["Access-Control-Allow-Origin"], undefined, evil);
    }
  });
});

describe("CORS allow-list formatting", () => {
  it("ignores a trailing slash pasted into the setting", () => {
    const res = fakeRes();
    applyCors(reqWithOrigin("https://netra-x-chi.vercel.app"), res, parseAllowedOrigins("https://netra-x-chi.vercel.app/"));
    assert.equal(res.headers["Access-Control-Allow-Origin"], "https://netra-x-chi.vercel.app");
  });
});

describe("Supabase token verification", () => {
  const okFetch = (calls: string[]) =>
    (async (url: string, init: RequestInit) => {
      calls.push(`${url} ${(init.headers as Record<string, string>).Authorization}`);
      return new Response(JSON.stringify({ id: "user-1" }), { status: 200 });
    }) as never as typeof fetch;

  it("accepts a token Supabase accepts and caches it", async () => {
    const calls: string[] = [];
    let t = 1_000;
    const verify = createSupabaseVerifier({ url: "https://p.supabase.co/", anonKey: "k", fetchImpl: okFetch(calls), ttlMs: 60_000, now: () => t });
    assert.deepEqual(await verify("Bearer abc"), { id: "user-1" });
    assert.deepEqual(await verify("Bearer abc"), { id: "user-1" });
    assert.equal(calls.length, 1, "second call served from cache");
    assert.equal(calls[0], "https://p.supabase.co/auth/v1/user Bearer abc");
    t += 61_000;
    await verify("Bearer abc");
    assert.equal(calls.length, 2, "cache expires");
  });

  it("rejects missing, malformed and Supabase-rejected tokens, and fails closed on network errors", async () => {
    const reject = (async () => new Response("{}", { status: 401 })) as never as typeof fetch;
    const down = (async () => { throw new Error("network"); }) as never as typeof fetch;
    const noId = (async () => new Response("{}", { status: 200 })) as never as typeof fetch;
    assert.equal(await createSupabaseVerifier({ url: "u", anonKey: "k", fetchImpl: reject })("Bearer bad"), null);
    assert.equal(await createSupabaseVerifier({ url: "u", anonKey: "k", fetchImpl: down })("Bearer x"), null);
    assert.equal(await createSupabaseVerifier({ url: "u", anonKey: "k", fetchImpl: noId })("Bearer x"), null);
    const verify = createSupabaseVerifier({ url: "u", anonKey: "k", fetchImpl: okFetch([]) });
    assert.equal(await verify(undefined), null);
    assert.equal(await verify("Basic abc"), null);
    assert.equal(await verify("Bearer "), null);
  });
});

describe("rate limiter", () => {
  it("blocks over the limit per key, resets after the window, and isolates keys", () => {
    let t = 0;
    const limit = createRateLimiter(2, 1000, () => t);
    assert.equal(limit("a").allowed, true);
    assert.equal(limit("a").allowed, true);
    const blocked = limit("a");
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSec >= 1);
    assert.equal(limit("b").allowed, true);
    t = 1001;
    assert.equal(limit("a").allowed, true);
  });
});
