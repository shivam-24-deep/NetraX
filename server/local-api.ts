// Local development API server — Node.js, zero dependencies (built-in
// `http` only), run with: node server/local-api.ts (Node 24 runs .ts
// natively; no build step or extra install needed).
//
// WHY THIS EXISTS: the actual business logic (Phases 3-13) is written as
// Supabase Edge Functions in supabase/functions/*/index.ts, targeting Deno.
// This sandbox has neither the Deno CLI nor Docker installed, and the only
// Supabase project this session's tools can reach is a different project
// than the one configured in frontend/.env — so those Edge Functions cannot
// actually be run or deployed from here. Every one of them is a thin
// Deno.serve() wrapper around portable TS in supabase/functions/_shared/,
// which has zero Deno-specific code and is already proven to run under
// Node (it's exactly what this repo's entire test suite exercises). This
// server imports that same shared logic directly and exposes it over HTTP
// with the identical request/response shapes as the Edge Functions, so the
// frontend can talk to a real backend locally today. Deploying the actual
// Edge Functions to a correctly-connected Supabase project later is a
// deployment-target change, not a rewrite — see docs/DEPLOYMENT.md.
//
// Mirrors ml/api/server.py's role for the Python models: a local dev
// convenience, not the only supported way to run this code.

import http from "node:http";
import os from "node:os";
import { investigateEmail } from "../supabase/functions/_shared/agent/orchestrator.ts";
import { investigateUrl } from "../supabase/functions/_shared/agent/investigate-url.ts";
import { parseEmail } from "../supabase/functions/_shared/email/parser.ts";
import { analyzeUrlWithMl } from "../supabase/functions/_shared/url-analysis/index.ts";
import { checkIndicator } from "../supabase/functions/_shared/threat-intel/index.ts";
import type { IndicatorType } from "../supabase/functions/_shared/threat-intel/types.ts";
import { geolocateSourceIps } from "../supabase/functions/_shared/geolocation/index.ts";
import type { EmailInputFormat, EmailJsonInput } from "../supabase/functions/_shared/email/types.ts";
import {
  buildGoogleAuthUrl,
  disconnectGmail,
  exchangeCodeForTokens,
  fetchNewGmailMessages,
  getGmailStatus,
  GmailReconnectRequired,
  isGoogleConfigured,
} from "./gmail-client.ts";
import { createFileStore, createSupabaseGmailStore, GmailStorageError, type GmailStore } from "./gmail-storage.ts";
import { createStateStore } from "./oauth-state.ts";
import { applyCors, clientIp, createRateLimiter, createSupabaseVerifier, parseAllowedOrigins } from "./security.ts";

// Load repo-root .env (GOOGLE_CLIENT_ID, PHISHTANK_APP_KEY, etc.) if present —
// silently continues without it, same "missing key = feature reports
// unavailable, never fake" pattern as every other integration here.
try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  // no root .env — every credential-gated feature below reports "not configured"
}

const PORT = Number(process.env.PORT ?? process.env.LOCAL_API_PORT ?? 8787);
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const FRONTEND_URL = (process.env.FRONTEND_URL ?? "http://localhost:5173").replace(/\/+$/, "");

// Deployed mode. REQUIRE_AUTH=true makes every route except /health, /status and
// the Google OAuth callback demand a valid Supabase login (Authorization: Bearer
// <access token>), restricts CORS to ALLOWED_ORIGINS, rate-limits per user, and
// gives every user their OWN Gmail connection (encrypted in Supabase, see
// gmail-storage.ts). Left unset, this is the open single-user local-dev server.
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === "true";
const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
const rateLimit = createRateLimiter(Number(process.env.RATE_LIMIT_PER_MIN ?? 60));
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
if (REQUIRE_AUTH && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
  console.error("REQUIRE_AUTH=true needs SUPABASE_URL and SUPABASE_ANON_KEY — refusing to start unprotected.");
  process.exit(1);
}
if (REQUIRE_AUTH && !allowedOrigins) {
  console.warn("WARNING: REQUIRE_AUTH=true but ALLOWED_ORIGINS is not set — any website may call this API from a signed-in browser.");
}
const verifyUser = REQUIRE_AUTH ? createSupabaseVerifier({ url: SUPABASE_URL!, anonKey: SUPABASE_ANON_KEY! }) : null;

// Gmail. Deployed, per-user tokens are encrypted with GMAIL_TOKEN_KEY, so without
// it the integration stays off rather than storing anything unprotected.
const GMAIL_TOKEN_KEY = process.env.GMAIL_TOKEN_KEY;
const gmailAvailable = () => isGoogleConfigured() && (!REQUIRE_AUTH || Boolean(GMAIL_TOKEN_KEY));
const oauthStates = createStateStore<RequestContext>();
const localGmailStore = createFileStore();

interface RequestContext {
  userId?: string;
  /** The caller's Supabase access token — used so database access stays scoped to them by RLS. */
  jwt?: string;
}

function gmailStoreFor(ctx: RequestContext): GmailStore {
  if (!REQUIRE_AUTH) return localGmailStore;
  return createSupabaseGmailStore({
    url: SUPABASE_URL!,
    anonKey: SUPABASE_ANON_KEY!,
    userJwt: ctx.jwt!,
    userId: ctx.userId!,
    encryptionKey: GMAIL_TOKEN_KEY!,
  });
}

// Best-effort LAN IPv4 discovery — used only so the "Send to NetraX" mobile QR
// code can point a phone at this machine's real network address instead of
// "localhost" (which resolves to the phone itself, not this machine). Never
// used for anything security-sensitive; if nothing suitable is found, callers
// fall back to whatever origin the page was already loaded from.
const VIRTUAL_ADAPTER = /vethernet|wsl|hyper-v|virtualbox|vmware|vmnet|docker|bluetooth|loopback|tailscale|zerotier|vpn/i;

function findLanIp(): string | null {
  const candidates: { address: string; score: number }[] = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const iface of addrs ?? []) {
      if (iface.family !== "IPv4" || iface.internal || iface.address.startsWith("169.254.")) continue;
      let score = 0;
      if (VIRTUAL_ADAPTER.test(name)) score -= 10;
      if (/wi-?fi|wlan|wireless/i.test(name)) score += 3;
      else if (/^eth|ethernet/i.test(name)) score += 2;
      if (iface.address.startsWith("192.168.") || iface.address.startsWith("10.")) score += 1;
      candidates.push({ address: iface.address, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.address ?? null;
}

// The browser cannot reach the ML service directly once deployed (different host,
// API key), so this server reports its health. Each /status call also nudges a
// sleeping free-tier ML service awake, so it is warm by the time someone submits
// an investigation. /health stays dependency-free for the platform's own checks.
const ML_HEALTH_URL = `${(process.env.ML_API_URL ?? "http://localhost:8000").replace(/\/+$/, "")}/health`;
let mlState: "checking" | "up" | "down" = "checking";
let mlCheckedAt = 0;
let mlChecking = false;
function refreshMlState(): void {
  if (mlChecking || Date.now() - mlCheckedAt < 20_000) return;
  mlChecking = true;
  if (mlState === "down") mlState = "checking";
  fetch(ML_HEALTH_URL, { signal: AbortSignal.timeout(90_000) })
    .then((r) => void (mlState = r.ok ? "up" : "down"))
    .catch(() => void (mlState = "down"))
    .finally(() => {
      mlChecking = false;
      mlCheckedAt = Date.now();
    });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

function sendRedirect(res: http.ServerResponse, location: string): void {
  res.writeHead(302, { Location: location });
  res.end();
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    let bytes = 0;
    req.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      data += chunk.toString("utf-8");
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

type Handler = (body: unknown, ctx: RequestContext) => Promise<{ status: number; body: unknown }>;

const routes: Record<string, Handler> = {
  "/parse-email": async (body) => {
    const { input, format } = body as { input?: string | EmailJsonInput; format?: EmailInputFormat };
    if (input === undefined || input === null) return { status: 400, body: { error: "Missing required field: input." } };
    try {
      return { status: 200, body: parseEmail(input, format) };
    } catch {
      return { status: 422, body: { error: "Failed to parse email input." } };
    }
  },

  "/investigate-email": async (body) => {
    const { input, format } = body as { input?: string | EmailJsonInput; format?: EmailInputFormat };
    if (input === undefined || input === null) return { status: 400, body: { error: "Missing required field: input." } };
    try {
      return { status: 200, body: await investigateEmail(input, format) };
    } catch (err) {
      console.error("investigate-email failed:", err);
      return { status: 422, body: { error: "Failed to investigate email." } };
    }
  },

  "/analyze-url": async (body) => {
    const { url } = body as { url?: string };
    if (typeof url !== "string" || !url.trim()) return { status: 400, body: { error: "Missing required field: url." } };
    try {
      return { status: 200, body: await analyzeUrlWithMl(url) };
    } catch (err) {
      console.error("analyze-url failed:", err);
      return { status: 422, body: { error: "Failed to analyze URL." } };
    }
  },

  "/investigate-url": async (body) => {
    const { url } = body as { url?: string };
    if (typeof url !== "string" || !url.trim()) return { status: 400, body: { error: "Missing required field: url." } };
    try {
      return { status: 200, body: await investigateUrl(url) };
    } catch (err) {
      console.error("investigate-url failed:", err);
      return { status: 422, body: { error: "Failed to investigate URL." } };
    }
  },

  "/check-threat-intel": async (body) => {
    const { indicator, indicator_type } = body as { indicator?: string; indicator_type?: string };
    const validTypes: IndicatorType[] = ["url", "domain", "ip", "email"];
    if (typeof indicator !== "string" || !indicator.trim()) return { status: 400, body: { error: "Missing required field: indicator." } };
    if (!validTypes.includes(indicator_type as IndicatorType)) return { status: 400, body: { error: `indicator_type must be one of ${validTypes.join(", ")}.` } };
    const results = await checkIndicator(indicator, indicator_type as IndicatorType);
    return { status: 200, body: { results } };
  },

  "/geolocate-ip": async (body) => {
    const { ips } = body as { ips?: unknown };
    if (!Array.isArray(ips) || !ips.every((ip) => typeof ip === "string")) return { status: 400, body: { error: "Missing or invalid field: ips (string[])." } };
    const results = await geolocateSourceIps(ips as string[]);
    return { status: 200, body: { results } };
  },

  "/auth/google/start": async (_body, ctx) => {
    if (!gmailAvailable()) return { status: 400, body: { error: "Gmail is not configured on this server." } };
    return { status: 200, body: { url: buildGoogleAuthUrl(oauthStates.create(ctx)) } };
  },

  "/auth/google/disconnect": async (_body, ctx) => {
    try {
      await disconnectGmail(gmailStoreFor(ctx));
      return { status: 200, body: { connected: false } };
    } catch (err) {
      return gmailFailure(err, "Failed to disconnect Gmail.");
    }
  },

  // Gmail auto-detect (SIH26106 mobile-ingest follow-up): scans for inbox
  // messages that arrived since connecting (never a bulk history scan — see
  // gmail-client.ts) and runs each through the SAME investigateEmail()
  // pipeline /investigate-email uses. Never a separate/lesser analysis path.
  // Each user only ever scans their own mailbox (their own stored connection).
  "/gmail/check-new": async (_body, ctx) => {
    if (!gmailAvailable()) return { status: 400, body: { error: "Gmail is not configured on this server." } };
    try {
      const messages = await fetchNewGmailMessages(gmailStoreFor(ctx), 5);
      const results = await Promise.all(
        messages.map(async (m) => ({ messageId: m.messageId, rawEmail: m.rawEmail, result: await investigateEmail(m.rawEmail) })),
      );
      return { status: 200, body: { scanned: messages.length, results } };
    } catch (err) {
      if (err instanceof Error && err.message === "Gmail is not connected") {
        return { status: 400, body: { error: "Gmail is not connected. Connect it in Settings, Integrations." } };
      }
      return gmailFailure(err, "Failed to check Gmail for new messages.");
    }
  },
};

function gmailFailure(err: unknown, fallback: string): { status: number; body: unknown } {
  if (err instanceof GmailReconnectRequired) return { status: 409, body: { error: err.message, reconnect: true } };
  if (err instanceof GmailStorageError) return { status: 503, body: { error: err.message } };
  console.error(fallback, err);
  return { status: 502, body: { error: fallback } };
}

type GetHandler = (req: http.IncomingMessage, ctx: RequestContext) => Promise<{ status: number; body: unknown } | { redirect: string }>;

const getRoutes: Record<string, GetHandler> = {
  "/auth/google/status": async (_req, ctx) => {
    if (!gmailAvailable()) return { status: 200, body: { configured: false, connected: false } };
    try {
      const status = await getGmailStatus(gmailStoreFor(ctx));
      return { status: 200, body: { configured: true, ...status } };
    } catch (err) {
      // e.g. the table has not been created yet: still "configured", but say why it cannot connect
      return { status: 200, body: { configured: true, connected: false, error: err instanceof GmailStorageError ? err.message : "Could not read the Gmail connection." } };
    }
  },

  // Local development convenience (open a URL in the browser). Deployed, the
  // frontend uses POST /auth/google/start instead, because a plain navigation
  // cannot carry the login token.
  "/auth/google/start": async (_req, ctx) => {
    if (!gmailAvailable()) return { status: 400, body: { error: "Gmail is not configured (missing GOOGLE_CLIENT_ID/SECRET) — see .env.example." } };
    return { redirect: buildGoogleAuthUrl(oauthStates.create(ctx)) };
  },

  "/auth/google/callback": async (req) => {
    const url = new URL(req.url ?? "", `http://localhost:${PORT}`);
    const fail = (reason: string) => ({ redirect: `${FRONTEND_URL}/settings?gmail=error&reason=${encodeURIComponent(reason)}` });
    // The browser arrives here straight from Google with no login header, so who
    // is connecting comes from the one-time state issued by an authenticated /start.
    const owner = oauthStates.consume(url.searchParams.get("state"));
    if (!owner) return fail("This connection link expired or was already used. Please try connecting again.");
    if (url.searchParams.get("error")) return fail(url.searchParams.get("error")!);
    const code = url.searchParams.get("code");
    if (!code) return fail("Google did not return an authorization code.");
    try {
      await exchangeCodeForTokens(code, gmailStoreFor(owner));
      return { redirect: `${FRONTEND_URL}/settings?gmail=connected` };
    } catch (err) {
      console.error("Google OAuth exchange failed:", err);
      return fail(err instanceof GmailStorageError ? err.message : err instanceof Error ? err.message : "unknown");
    }
  },
};

const server = http.createServer(async (req, res) => {
  applyCors(req, res, allowedOrigins);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { status: "ok" });
    return;
  }
  if (req.method === "GET" && req.url === "/status") {
    refreshMlState();
    sendJson(res, 200, { status: "ok", ml: mlState });
    return;
  }
  if (req.method === "GET" && req.url === "/network-info") {
    sendJson(res, 200, { lanIp: REQUIRE_AUTH ? null : findLanIp() });
    return;
  }

  const path = (req.url ?? "").split("?")[0];
  const isGmailPath = path.startsWith("/auth/google") || path.startsWith("/gmail");
  if (isGmailPath && REQUIRE_AUTH && !gmailAvailable()) {
    if (path === "/auth/google/status") sendJson(res, 200, { configured: false, connected: false });
    else sendJson(res, 404, { error: "Gmail integration is not enabled on this server." });
    return;
  }

  let ctx: RequestContext = {};
  // The OAuth callback is a browser redirect from Google and cannot carry a login
  // header; it is protected by the single-use state instead (see oauth-state.ts).
  if (verifyUser && path !== "/auth/google/callback") {
    const user = await verifyUser(req.headers.authorization);
    if (!user) {
      sendJson(res, 401, { error: "Sign in required." });
      return;
    }
    const limit = rateLimit(user.id);
    if (!limit.allowed) {
      res.setHeader("Retry-After", String(limit.retryAfterSec));
      sendJson(res, 429, { error: "Too many requests. Please wait a moment and try again." });
      return;
    }
    ctx = { userId: user.id, jwt: /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? "")?.[1]?.trim() };
  }
  if (req.method === "GET" && req.url) {
    const getHandler = getRoutes[path];
    if (getHandler) {
      try {
        const result = await getHandler(req, ctx);
        if ("redirect" in result) sendRedirect(res, result.redirect);
        else sendJson(res, result.status, result.body);
      } catch (err) {
        console.error("GET request failed:", err);
        sendJson(res, 500, { error: "Internal server error." });
      }
      return;
    }
  }

  const handler = req.url ? routes[req.url] : undefined;
  if (!handler) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed. Use POST." });
    return;
  }

  try {
    const raw = await readBody(req);
    const parsed = raw ? JSON.parse(raw) : {};
    const { status, body } = await handler(parsed, ctx);
    sendJson(res, status, body);
  } catch (err) {
    if (err instanceof SyntaxError) {
      sendJson(res, 400, { error: "Request body must be valid JSON." });
    } else {
      console.error("Request failed:", err);
      sendJson(res, 500, { error: "Internal server error." });
    }
  }
});

server.listen(PORT, () => {
  console.log(`API server listening on port ${PORT} (${REQUIRE_AUTH ? "login required" : "open local-dev mode"})`);
  console.log(
    "Routes: /health, /network-info, /parse-email, /investigate-email, /investigate-url, /analyze-url, " +
      "/check-threat-intel, /geolocate-ip, /auth/google/{status,start,callback,disconnect}, /gmail/check-new",
  );
  console.log(
    gmailAvailable()
      ? `Gmail auto-detect: configured (${REQUIRE_AUTH ? "per-user, encrypted in Supabase" : "single local mailbox"})`
      : REQUIRE_AUTH && isGoogleConfigured()
        ? "Gmail auto-detect: OFF — set GMAIL_TOKEN_KEY to enable per-user connections"
        : "Gmail auto-detect: not configured (see .env.example GOOGLE_CLIENT_ID/SECRET)",
  );
});
