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
import { investigateEmail } from "../supabase/functions/_shared/agent/orchestrator.ts";
import { parseEmail } from "../supabase/functions/_shared/email/parser.ts";
import { analyzeUrlWithMl } from "../supabase/functions/_shared/url-analysis/index.ts";
import { checkIndicator } from "../supabase/functions/_shared/threat-intel/index.ts";
import type { IndicatorType } from "../supabase/functions/_shared/threat-intel/types.ts";
import { geolocateSourceIps } from "../supabase/functions/_shared/geolocation/index.ts";
import type { EmailInputFormat, EmailJsonInput } from "../supabase/functions/_shared/email/types.ts";

const PORT = Number(process.env.LOCAL_API_PORT ?? 8787);
const MAX_BODY_BYTES = 10 * 1024 * 1024;

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
  console.log("Routes: /health, /parse-email, /investigate-email, /analyze-url, /check-threat-intel, /geolocate-ip");
});
