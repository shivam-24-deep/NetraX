// Gmail OAuth + polling glue. Deliberately NOT part of supabase/functions/_shared
// - it is tied to this server's own OAuth redirect flow, unlike the portable
// investigation logic in _shared.
//
// Where the tokens live is decided by the caller (see gmail-storage.ts): a local
// file for single-analyst development, or one encrypted row per user in
// Supabase when deployed. Everything here works on a GmailStore, so the same
// code serves both, and each user only ever touches their own mailbox.
//
// Nothing here fabricates anything: with no client ID/secret configured,
// every function reports "not configured" rather than pretending to work,
// matching the same honesty pattern as the PhishTank/URLhaus/MaxMind
// adapters in supabase/functions/_shared/threat-intel and /geolocation.

import type { GmailStore } from "./gmail-storage.ts";

// Read lazily (never cache into a module-level const) - local-api.ts calls
// process.loadEnvFile() at its own top level, but ES module imports (this
// file included) are always evaluated before an importing module's own
// top-level statements run, so a const captured here at import time would
// permanently see "undefined" regardless of what loadEnvFile() loads a
// moment later.
function clientId(): string | undefined {
  return process.env.GOOGLE_CLIENT_ID;
}
function clientSecret(): string | undefined {
  return process.env.GOOGLE_CLIENT_SECRET;
}
function redirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:8787/auth/google/callback";
}
// Overridable only so tests can point at a fake Google; production uses the real hosts.
const authBase = () => process.env.GOOGLE_AUTH_BASE ?? "https://accounts.google.com";
const oauthBase = () => process.env.GOOGLE_OAUTH_BASE ?? "https://oauth2.googleapis.com";
const gmailBase = () => process.env.GMAIL_API_BASE ?? "https://gmail.googleapis.com";

const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

/** The saved Google access is gone (revoked, expired after 7 days in Testing mode, ...) - the user must connect again. */
export class GmailReconnectRequired extends Error {}

export function isGoogleConfigured(): boolean {
  return Boolean(clientId() && clientSecret());
}

export async function getGmailStatus(store: GmailStore): Promise<{ connected: boolean; email?: string }> {
  const connection = await store.load();
  return { connected: connection !== null, email: connection?.email };
}

export async function disconnectGmail(store: GmailStore): Promise<void> {
  const connection = await store.load();
  await store.remove();
  if (!connection) return;
  // Best effort: also withdraw the grant at Google so NetraX no longer appears in
  // the user's connected apps. Failure here must never block disconnecting.
  try {
    await fetch(`${oauthBase()}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: connection.refresh_token }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // ignore
  }
}

export function buildGoogleAuthUrl(state?: string): string {
  const id = clientId();
  if (!id) throw new Error("GOOGLE_CLIENT_ID is not configured");
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  });
  if (state) params.set("state", state);
  return `${authBase()}/o/oauth2/v2/auth?${params.toString()}`;
}

const RECENT_WINDOW = "newer_than:7d";
const MAX_PAGES = 5; // hard safety cap - 5 x 100 = 500 messages, regardless of inbox size

/**
 * Lists inbox message IDs from roughly the last week only - NOT the whole
 * inbox. A real Gmail account can have tens of thousands of messages;
 * paginating through all of them (as an earlier version of this function
 * did) made every scan take minutes and made "Check now" appear to hang.
 * Auto-detect only cares about mail that arrives after connecting anyway, so
 * a bounded recent window is both correct and fast.
 */
async function fetchRecentInboxIds(accessToken: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  do {
    const url = new URL(`${gmailBase()}/gmail/v1/users/me/messages`);
    url.searchParams.set("labelIds", "INBOX");
    url.searchParams.set("q", RECENT_WINDOW);
    url.searchParams.set("maxResults", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal });
    } catch {
      break; // network hiccup or timeout - return whatever we already have rather than hanging
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) break;
    const data = (await res.json()) as { messages?: { id: string }[]; nextPageToken?: string };
    ids.push(...(data.messages ?? []).map((m) => m.id));
    pageToken = data.nextPageToken;
    pages += 1;
  } while (pageToken && pages < MAX_PAGES);
  return ids;
}

async function fetchAccountEmail(accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${gmailBase()}/gmail/v1/users/me/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return undefined;
    return ((await res.json()) as { emailAddress?: string }).emailAddress;
  } catch {
    return undefined;
  }
}

/**
 * Exchanges the OAuth code for tokens, then establishes a baseline of recent
 * (last ~7 days) inbox messages as "seen" WITHOUT investigating them - so
 * auto-detection only ever reacts to mail that arrives after connecting,
 * never a scan of the user's whole mailbox history.
 */
export async function exchangeCodeForTokens(code: string, store: GmailStore): Promise<void> {
  const id = clientId();
  const secret = clientSecret();
  if (!id || !secret) throw new Error("Google OAuth is not configured");
  const res = await fetch(`${oauthBase()}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  if (!data.refresh_token) {
    throw new Error("Google did not return a refresh token - remove NetraX from https://myaccount.google.com/permissions and try connecting again");
  }

  const [email, baseline] = await Promise.all([fetchAccountEmail(data.access_token), fetchRecentInboxIds(data.access_token)]);
  await store.save({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry: Date.now() + data.expires_in * 1000,
    seen_ids: baseline,
    email,
  });
}

async function getValidConnection(store: GmailStore) {
  const connection = await store.load();
  if (!connection) throw new Error("Gmail is not connected");
  if (Date.now() < connection.expiry - 60_000) return connection;

  const res = await fetch(`${oauthBase()}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: connection.refresh_token,
      client_id: clientId()!,
      client_secret: clientSecret()!,
      grant_type: "refresh_token",
    }),
  });
  if (res.status === 400 || res.status === 401) {
    // Google says the grant is no longer valid (user revoked access, or the 7-day
    // limit for apps in Testing mode). Forget it so the UI offers "Connect" again.
    await store.remove();
    throw new GmailReconnectRequired("Gmail access expired or was revoked. Please connect Gmail again.");
  }
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  const updated = { ...connection, access_token: data.access_token, expiry: Date.now() + data.expires_in * 1000 };
  await store.save(updated);
  return updated;
}

export interface GmailScanMessage {
  messageId: string;
  /** Full raw RFC822 text - fed straight into the same parseEmail()/investigateEmail() every other entry point uses. */
  rawEmail: string;
}

/** Fetches inbox messages that arrived since the connection baseline (or the last call) and haven't been returned before. */
export async function fetchNewGmailMessages(store: GmailStore, maxResults = 5): Promise<GmailScanMessage[]> {
  const connection = await getValidConnection(store);
  const accessToken = connection.access_token;

  const seen = new Set(connection.seen_ids);
  const currentIds = await fetchRecentInboxIds(accessToken);
  const newIds = currentIds.filter((id) => !seen.has(id)).slice(0, maxResults);
  if (newIds.length === 0) return [];

  const results: GmailScanMessage[] = [];
  for (const id of newIds) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    seen.add(id); // mark seen even on a fetch failure - never retry a poisoned message forever
    try {
      const msgRes = await fetch(`${gmailBase()}/gmail/v1/users/me/messages/${id}?format=raw`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      if (!msgRes.ok) continue;
      const msgData = (await msgRes.json()) as { raw: string };
      const rawEmail = Buffer.from(msgData.raw, "base64url").toString("utf-8");
      results.push({ messageId: id, rawEmail });
    } catch {
      continue; // network hiccup or timeout on this one message - skip it, don't hang the whole scan
    } finally {
      clearTimeout(timeout);
    }
  }
  await store.save({ ...connection, seen_ids: [...seen] });
  return results;
}
