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
  isGmailConnected,
  isGoogleConfigured,
} from "./gmail-client.ts";

// Load repo-root .env (GOOGLE_CLIENT_ID, PHISHTANK_APP_KEY, etc.) if present —
// silently continues without it, same "missing key = feature reports
// unavailable, never fake" pattern as every other integration here.
try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  // no root .env — every credential-gated feature below reports "not configured"
}

const PORT = Number(process.env.LOCAL_API_PORT ?? 8787);
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

// Best-effort LAN IPv4 discovery — used only so the "Send to NetraX" mobile QR
// code can point a phone at this machine's real network address instead of
// "localhost" (which resolves to the phone itself, not this machine). Never
// used for anything security-sensitive; if nothing suitable is found, callers
// fall back to whatever origin the page was already loaded from.
function findLanIp(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return null;
}

function withCors(res: http.ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
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

type Handler = (body: unknown) => Promise<{ status: number; body: unknown }>;

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

  "/auth/google/disconnect": async () => {
    disconnectGmail();
    return { status: 200, body: { connected: false } };
  },

  // Gmail auto-detect (SIH26106 mobile-ingest follow-up): scans for inbox
  // messages that arrived since connecting (never a bulk history scan — see
  // gmail-client.ts) and runs each through the SAME investigateEmail()
  // pipeline /investigate-email uses. Never a separate/lesser analysis path.
  "/gmail/check-new": async () => {
    if (!isGoogleConfigured()) return { status: 400, body: { error: "Gmail is not configured (missing GOOGLE_CLIENT_ID/SECRET)." } };
    if (!isGmailConnected()) return { status: 400, body: { error: "Gmail is not connected. Visit /auth/google/start first." } };
    try {
      const messages = await fetchNewGmailMessages(5);
      const results = await Promise.all(
        messages.map(async (m) => ({ messageId: m.messageId, rawEmail: m.rawEmail, result: await investigateEmail(m.rawEmail) })),
      );
      return { status: 200, body: { scanned: messages.length, results } };
    } catch (err) {
      console.error("gmail/check-new failed:", err);
      return { status: 502, body: { error: "Failed to check Gmail for new messages." } };
    }
  },
};

type GetHandler = (req: http.IncomingMessage) => Promise<{ status: number; body: unknown } | { redirect: string }>;

const getRoutes: Record<string, GetHandler> = {
  "/auth/google/status": async () => ({ status: 200, body: { configured: isGoogleConfigured(), connected: isGmailConnected() } }),

  "/auth/google/start": async () => {
    if (!isGoogleConfigured()) return { status: 400, body: { error: "Gmail is not configured (missing GOOGLE_CLIENT_ID/SECRET) — see .env.example." } };
    return { redirect: buildGoogleAuthUrl() };
  },

  "/auth/google/callback": async (req) => {
    const url = new URL(req.url ?? "", `http://localhost:${PORT}`);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    if (error) return { redirect: `${FRONTEND_URL}/settings?gmail=error&reason=${encodeURIComponent(error)}` };
    if (!code) return { status: 400, body: { error: "Missing OAuth code." } };
    try {
      await exchangeCodeForTokens(code);
      return { redirect: `${FRONTEND_URL}/settings?gmail=connected` };
    } catch (err) {
      console.error("Google OAuth exchange failed:", err);
      return { redirect: `${FRONTEND_URL}/settings?gmail=error&reason=${encodeURIComponent(err instanceof Error ? err.message : "unknown")}` };
    }
  },
};

const server = http.createServer(async (req, res) => {
  withCors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { status: "ok" });
    return;
  }
  if (req.method === "GET" && req.url === "/network-info") {
    sendJson(res, 200, { lanIp: findLanIp() });
    return;
  }
  if (req.method === "GET" && req.url) {
    const path = req.url.split("?")[0];
    const getHandler = getRoutes[path];
    if (getHandler) {
      try {
        const result = await getHandler(req);
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
    const { status, body } = await handler(parsed);
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
  console.log(`Local dev API server listening on http://localhost:${PORT}`);
  console.log(
    "Routes: /health, /network-info, /parse-email, /investigate-email, /investigate-url, /analyze-url, " +
      "/check-threat-intel, /geolocate-ip, /auth/google/{status,start,callback,disconnect}, /gmail/check-new",
  );
  console.log(isGoogleConfigured() ? "Gmail auto-detect: configured" : "Gmail auto-detect: not configured (see .env.example GOOGLE_CLIENT_ID/SECRET)");
});
