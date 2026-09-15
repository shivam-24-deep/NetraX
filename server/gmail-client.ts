// Gmail OAuth + polling glue for the local dev backend. Deliberately NOT part
// of supabase/functions/_shared — this depends on Node's fs for local token
// storage and is inherently tied to this server's own OAuth redirect flow,
// unlike the portable investigation logic in _shared.
//
// Token storage is a plain gitignored JSON file next to this module — fine
// for a single-analyst local dev/demo tool, not a production secret store.
// Nothing here fabricates anything: with no client ID/secret configured,
// every function reports "not configured" rather than pretending to work,
// matching the same honesty pattern as the PhishTank/URLhaus/MaxMind
// adapters in supabase/functions/_shared/threat-intel and /geolocation.

import fs from "node:fs";
import path from "node:path";

const TOKENS_PATH = path.join(import.meta.dirname, ".gmail-tokens.json");
const SEEN_PATH = path.join(import.meta.dirname, ".gmail-seen.json");

// Read lazily (never cache into a module-level const) — local-api.ts calls
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
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

interface StoredTokens {
  access_token: string;
  refresh_token: string;
  /** epoch ms */
  expiry: number;
}

function loadTokens(): StoredTokens | null {
  try {
    return JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8")) as StoredTokens;
  } catch {
    return null;
  }
}

function saveTokens(tokens: StoredTokens): void {
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2), "utf-8");
}

function loadSeenIds(): Set<string> {
  try {
    return new Set(JSON.parse(fs.readFileSync(SEEN_PATH, "utf-8")) as string[]);
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: Set<string>): void {
  fs.writeFileSync(SEEN_PATH, JSON.stringify([...ids]), "utf-8");
}

export function isGoogleConfigured(): boolean {
  return Boolean(clientId() && clientSecret());
}

export function isGmailConnected(): boolean {
  return loadTokens() !== null;
}

export function disconnectGmail(): void {
  try {
    fs.unlinkSync(TOKENS_PATH);
  } catch {
    // already disconnected — nothing to do
  }
  try {
    fs.unlinkSync(SEEN_PATH);
  } catch {
    // no baseline to clear — nothing to do
  }
}

export function buildGoogleAuthUrl(): string {
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
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

const RECENT_WINDOW = "newer_than:7d";
const MAX_PAGES = 5; // hard safety cap — 5 x 100 = 500 messages, regardless of inbox size

/**
 * Lists inbox message IDs from roughly the last week only — NOT the whole
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
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
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
      break; // network hiccup or timeout — return whatever we already have rather than hanging
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

/**
 * Exchanges the OAuth code for tokens, then establishes a baseline of recent
 * (last ~7 days) inbox messages as "seen" WITHOUT investigating them — so
 * auto-detection only ever reacts to mail that arrives after connecting,
 * never a scan of the user's whole mailbox history.
 */
export async function exchangeCodeForTokens(code: string): Promise<void> {
  const id = clientId();
  const secret = clientSecret();
  if (!id || !secret) throw new Error("Google OAuth is not configured");
  const res = await fetch("https://oauth2.googleapis.com/token", {
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
    throw new Error("Google did not return a refresh token — remove NetraX from https://myaccount.google.com/permissions and try connecting again");
  }
  saveTokens({ access_token: data.access_token, refresh_token: data.refresh_token, expiry: Date.now() + data.expires_in * 1000 });

  const baseline = await fetchRecentInboxIds(data.access_token);
  saveSeenIds(new Set(baseline));
}

async function getValidAccessToken(): Promise<string | null> {
  const tokens = loadTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expiry - 60_000) return tokens.access_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: tokens.refresh_token,
      client_id: clientId()!,
      client_secret: clientSecret()!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token: string; expires_in: number };
  const updated: StoredTokens = { access_token: data.access_token, refresh_token: tokens.refresh_token, expiry: Date.now() + data.expires_in * 1000 };
  saveTokens(updated);
  return updated.access_token;
}

export interface GmailScanMessage {
  messageId: string;
  /** Full raw RFC822 text — fed straight into the same parseEmail()/investigateEmail() every other entry point uses. */
  rawEmail: string;
}

/** Fetches inbox messages that arrived since the connection baseline (or the last call) and haven't been returned before. */
export async function fetchNewGmailMessages(maxResults = 5): Promise<GmailScanMessage[]> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) throw new Error("Gmail is not connected");

  const seen = loadSeenIds();
  const currentIds = await fetchRecentInboxIds(accessToken);
  const newIds = currentIds.filter((id) => !seen.has(id)).slice(0, maxResults);

  const results: GmailScanMessage[] = [];
  for (const id of newIds) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    seen.add(id); // mark seen even on a fetch failure — never retry a poisoned message forever
    try {
      const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=raw`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      if (!msgRes.ok) continue;
      const msgData = (await msgRes.json()) as { raw: string };
      const rawEmail = Buffer.from(msgData.raw, "base64url").toString("utf-8");
      results.push({ messageId: id, rawEmail });
    } catch {
      continue; // network hiccup or timeout on this one message — skip it, don't hang the whole scan
    } finally {
      clearTimeout(timeout);
    }
  }
  saveSeenIds(seen);
  return results;
}
