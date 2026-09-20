import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import { decryptSecret, encryptSecret, createSupabaseGmailStore, GmailStorageError, type GmailConnection, type GmailStore } from "./gmail-storage.ts";
import { createStateStore } from "./oauth-state.ts";

// ---------------------------------------------------------------------------
// A tiny fake Google (OAuth token endpoint + Gmail API). The account is encoded
// in the tokens: access token "atk-<account>-<n>", refresh token "rtk-<account>".
// ---------------------------------------------------------------------------

const inbox: Record<string, { id: string; raw: string }[]> = { A: [], B: [] };
const revoked: string[] = [];
let refreshCount = 0;

function accountOf(authHeader: string | undefined): string | null {
  return /^Bearer atk-([A-Z])-/.exec(authHeader ?? "")?.[1] ?? null;
}

const fakeGoogle = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "", "http://x");
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  let body = "";
  for await (const chunk of req) body += chunk;
  const form = new URLSearchParams(body);

  if (req.method === "POST" && url.pathname === "/token") {
    if (form.get("grant_type") === "authorization_code") {
      const code = form.get("code") ?? "";
      if (code === "code-A") return send(200, { access_token: "atk-A-1", refresh_token: "rtk-A", expires_in: 3600 });
      if (code === "code-B") return send(200, { access_token: "atk-B-1", refresh_token: "rtk-B", expires_in: 3600 });
      if (code === "code-no-refresh") return send(200, { access_token: "atk-A-9", expires_in: 3600 });
      return send(400, { error: "invalid_grant" });
    }
    const rt = form.get("refresh_token") ?? "";
    if (rt === "rtk-A" || rt === "rtk-B") {
      refreshCount += 1;
      return send(200, { access_token: `atk-${rt.slice(-1)}-r${refreshCount}`, expires_in: 3600 });
    }
    return send(400, { error: "invalid_grant" });
  }
  if (req.method === "POST" && url.pathname === "/revoke") {
    revoked.push(form.get("token") ?? "");
    return send(200, {});
  }

  const account = accountOf(req.headers.authorization);
  if (!account) return send(401, { error: "unauthorized" });
  if (url.pathname === "/gmail/v1/users/me/profile") return send(200, { emailAddress: `${account.toLowerCase()}@gmail.test` });
  if (url.pathname === "/gmail/v1/users/me/messages") return send(200, { messages: inbox[account].map((m) => ({ id: m.id })) });
  const single = /^\/gmail\/v1\/users\/me\/messages\/(.+)$/.exec(url.pathname);
  if (single) {
    const message = inbox[account].find((m) => m.id === single[1]);
    if (!message) return send(404, {});
    return send(200, { raw: Buffer.from(message.raw).toString("base64url") });
  }
  send(404, {});
});

function memoryStore(initial: GmailConnection | null = null): GmailStore & { current: GmailConnection | null } {
  const store = {
    current: initial,
    async load() {
      return store.current ? structuredClone(store.current) : null;
    },
    async save(c: GmailConnection) {
      store.current = structuredClone(c);
    },
    async remove() {
      store.current = null;
    },
  };
  return store;
}

let client: typeof import("./gmail-client.ts");

before(async () => {
  await new Promise<void>((resolve) => fakeGoogle.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(fakeGoogle.address() as AddressInfo).port}`;
  process.env.GOOGLE_OAUTH_BASE = base;
  process.env.GMAIL_API_BASE = base;
  process.env.GOOGLE_AUTH_BASE = base;
  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.GOOGLE_REDIRECT_URI = "https://api.example/auth/google/callback";
  client = await import("./gmail-client.ts");
});
after(() => fakeGoogle.close());

describe("token encryption", () => {
  it("round-trips, uses a fresh IV each time, and rejects a wrong key or tampered data", () => {
    const blob = encryptSecret("refresh-token-123", "server-key");
    assert.equal(decryptSecret(blob, "server-key"), "refresh-token-123");
    assert.notEqual(encryptSecret("refresh-token-123", "server-key"), blob);
    assert.ok(!blob.includes("refresh-token-123"), "ciphertext must not contain the plaintext");
    assert.throws(() => decryptSecret(blob, "another-key"));
    const tampered = Buffer.from(blob, "base64");
    tampered[tampered.length - 1] ^= 1;
    assert.throws(() => decryptSecret(tampered.toString("base64"), "server-key"));
  });
});

describe("OAuth state", () => {
  it("is single-use, unguessable, expires, and refuses unknown values", () => {
    let t = 0;
    const states = createStateStore<{ userId: string }>(1000, () => t);
    const a = states.create({ userId: "u1" });
    const b = states.create({ userId: "u2" });
    assert.notEqual(a, b);
    assert.ok(a.length >= 30);
    assert.deepEqual(states.consume(a), { userId: "u1" });
    assert.equal(states.consume(a), null, "second use is refused");
    assert.equal(states.consume("made-up"), null);
    assert.equal(states.consume(null), null);
    t = 2000;
    assert.equal(states.consume(b), null, "expired");
  });

  it("the authorization URL carries the state, the read-only scope and offline access", () => {
    const url = new URL(client.buildGoogleAuthUrl("state-xyz"));
    assert.equal(url.searchParams.get("state"), "state-xyz");
    assert.equal(url.searchParams.get("scope"), "https://www.googleapis.com/auth/gmail.readonly");
    assert.equal(url.searchParams.get("access_type"), "offline");
    assert.equal(url.searchParams.get("redirect_uri"), "https://api.example/auth/google/callback");
  });
});

describe("connecting and scanning", () => {
  it("connect stores tokens + account email + a baseline, so only mail arriving AFTER connecting is scanned", async () => {
    inbox.A = [{ id: "old-1", raw: "Subject: old mail\n\nbody" }];
    const store = memoryStore();
    await client.exchangeCodeForTokens("code-A", store);
    assert.equal(store.current?.email, "a@gmail.test");
    assert.equal(store.current?.refresh_token, "rtk-A");
    assert.deepEqual(store.current?.seen_ids, ["old-1"]);

    assert.deepEqual(await client.fetchNewGmailMessages(store), [], "nothing new yet");
    inbox.A.push({ id: "new-1", raw: "Subject: fresh phish\n\nclick here" });
    const found = await client.fetchNewGmailMessages(store);
    assert.deepEqual(found.map((m) => m.messageId), ["new-1"]);
    assert.match(found[0].rawEmail, /fresh phish/);
    assert.deepEqual(await client.fetchNewGmailMessages(store), [], "already returned once");
  });

  it("two users each scan only their own mailbox and never see the other's mail", async () => {
    inbox.A = [{ id: "a-base", raw: "Subject: A base\n\nx" }];
    inbox.B = [{ id: "b-base", raw: "Subject: B base\n\nx" }];
    const storeA = memoryStore();
    const storeB = memoryStore();
    await client.exchangeCodeForTokens("code-A", storeA);
    await client.exchangeCodeForTokens("code-B", storeB);
    inbox.A.push({ id: "a-new", raw: "Subject: only for A\n\nx" });
    inbox.B.push({ id: "b-new", raw: "Subject: only for B\n\nx" });
    const a = await client.fetchNewGmailMessages(storeA);
    const b = await client.fetchNewGmailMessages(storeB);
    assert.deepEqual(a.map((m) => m.messageId), ["a-new"]);
    assert.deepEqual(b.map((m) => m.messageId), ["b-new"]);
    assert.ok(!a[0].rawEmail.includes("only for B") && !b[0].rawEmail.includes("only for A"));
    assert.equal(storeA.current?.email, "a@gmail.test");
    assert.equal(storeB.current?.email, "b@gmail.test");
  });

  it("refreshes an expired access token and saves the new one", async () => {
    inbox.A = [];
    const store = memoryStore({ access_token: "atk-A-stale", refresh_token: "rtk-A", expiry: Date.now() - 1000, seen_ids: [], email: "a@gmail.test" });
    await client.fetchNewGmailMessages(store);
    assert.match(store.current!.access_token, /^atk-A-r\d+$/);
    assert.ok(store.current!.expiry > Date.now());
  });

  it("a revoked or expired grant clears the connection and asks the user to reconnect", async () => {
    const store = memoryStore({ access_token: "old", refresh_token: "rtk-revoked", expiry: 0, seen_ids: [] });
    await assert.rejects(() => client.fetchNewGmailMessages(store), client.GmailReconnectRequired);
    assert.equal(store.current, null, "the dead connection is forgotten so the UI offers Connect again");
  });

  it("scanning with no connection reports not connected", async () => {
    await assert.rejects(() => client.fetchNewGmailMessages(memoryStore()), /not connected/);
  });

  it("a Google response without a refresh token is an actionable error", async () => {
    await assert.rejects(() => client.exchangeCodeForTokens("code-no-refresh", memoryStore()), /refresh token/i);
  });

  it("a bad authorization code is rejected", async () => {
    await assert.rejects(() => client.exchangeCodeForTokens("forged", memoryStore()), /token exchange failed/i);
  });

  it("disconnect forgets the connection and revokes the grant at Google", async () => {
    const store = memoryStore();
    await client.exchangeCodeForTokens("code-A", store);
    revoked.length = 0;
    await client.disconnectGmail(store);
    assert.equal(store.current, null);
    assert.deepEqual(revoked, ["rtk-A"]);
    assert.deepEqual(await client.getGmailStatus(store), { connected: false, email: undefined });
  });
});

describe("Supabase per-user store", () => {
  const conn: GmailConnection = { access_token: "atk-secret-value", refresh_token: "rtk-secret-value", expiry: 123, seen_ids: ["m1"], email: "me@gmail.test" };

  function fakeSupabase() {
    const calls: { url: string; method: string; headers: Record<string, string>; body?: string }[] = [];
    let row: { secret: string; seen_ids: string[]; google_email: string | null } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      const method = init.method ?? "GET";
      calls.push({ url, method, headers: init.headers as Record<string, string>, body: init.body as string | undefined });
      if (method === "POST") {
        const parsed = JSON.parse(init.body as string);
        row = { secret: parsed.secret, seen_ids: parsed.seen_ids, google_email: parsed.google_email };
        return new Response(null, { status: 201 });
      }
      if (method === "DELETE") {
        row = null;
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify(row ? [row] : []), { status: 200 });
    }) as never as typeof fetch;
    return { calls, fetchImpl, getRow: () => row };
  }

  it("acts as the signed-in user (their token, the public anon key, filtered to their id) and stores only ciphertext", async () => {
    const fake = fakeSupabase();
    const store = createSupabaseGmailStore({ url: "https://p.supabase.co/", anonKey: "anon-key", userJwt: "user-jwt", userId: "user-1", encryptionKey: "k", fetchImpl: fake.fetchImpl });
    await store.save(conn);
    const written = fake.calls[0];
    assert.equal(written.headers.Authorization, "Bearer user-jwt");
    assert.equal(written.headers.apikey, "anon-key");
    assert.match(written.url, /rest\/v1\/gmail_connections\?on_conflict=user_id$/);
    assert.ok(!written.body!.includes("atk-secret-value") && !written.body!.includes("rtk-secret-value"), "no plaintext token is sent to the database");
    assert.deepEqual(await store.load(), conn);
    assert.match(fake.calls[1].url, /user_id=eq\.user-1/);
    await store.remove();
    assert.match(fake.calls[2].url, /user_id=eq\.user-1/);
    assert.equal(await store.load(), null);
  });

  it("treats data it cannot decrypt (rotated key) as no connection instead of crashing", async () => {
    const fake = fakeSupabase();
    const writer = createSupabaseGmailStore({ url: "https://p.supabase.co", anonKey: "a", userJwt: "j", userId: "u", encryptionKey: "old-key", fetchImpl: fake.fetchImpl });
    await writer.save(conn);
    const reader = createSupabaseGmailStore({ url: "https://p.supabase.co", anonKey: "a", userJwt: "j", userId: "u", encryptionKey: "new-key", fetchImpl: fake.fetchImpl });
    assert.equal(await reader.load(), null);
  });

  it("explains a missing table and fails on network errors with a clear error", async () => {
    const missing = (async () => new Response(JSON.stringify({ code: "PGRST205" }), { status: 404 })) as never as typeof fetch;
    const down = (async () => { throw new Error("offline"); }) as never as typeof fetch;
    const base = { url: "https://p.supabase.co", anonKey: "a", userJwt: "j", userId: "u", encryptionKey: "k" };
    await assert.rejects(() => createSupabaseGmailStore({ ...base, fetchImpl: missing }).load(), /table is missing/);
    await assert.rejects(() => createSupabaseGmailStore({ ...base, fetchImpl: down }).load(), GmailStorageError);
  });
});
