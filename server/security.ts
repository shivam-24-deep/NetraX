// Request protection for the deployed API: Supabase login verification, CORS
// allow-listing and per-user rate limiting. Zero dependencies (Node built-ins
// only), like the rest of server/. See local-api.ts for how these are wired in.

import type http from "node:http";
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

/** "https://app.example.com, https://*.vercel.app" -> matchers. Undefined/empty = allow any origin (local dev). */
export function parseAllowedOrigins(raw: string | undefined): RegExp[] | null {
  const entries = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (entries.length === 0) return null;
  return entries.map((entry) => {
    const escaped = entry.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
    return new RegExp(`^${escaped}$`, "i");
  });
}

export function applyCors(req: http.IncomingMessage, res: http.ServerResponse, allowed: RegExp[] | null): void {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  // "*" does not cover Authorization, so the headers are listed explicitly.
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, ngrok-skip-browser-warning");
  res.setHeader("Access-Control-Max-Age", "600");
  if (!allowed) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return;
  }
  res.setHeader("Vary", "Origin");
  const origin = req.headers.origin;
  if (origin && allowed.some((re) => re.test(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
}

// ---------------------------------------------------------------------------
// Supabase login verification
// ---------------------------------------------------------------------------

export interface VerifiedUser {
  id: string;
}

type FetchLike = typeof fetch;

/**
 * Verifies a Supabase access token by asking Supabase itself (GET /auth/v1/user)
 * — no shared secret needed, only the project's public URL and anon key. Only
 * successful lookups are cached; any failure (bad token, Supabase down) is a
 * denial, never a pass.
 */
export function createSupabaseVerifier(options: {
  url: string;
  anonKey: string;
  fetchImpl?: FetchLike;
  ttlMs?: number;
  now?: () => number;
}): (authorization: string | undefined) => Promise<VerifiedUser | null> {
  const { url, anonKey, fetchImpl = fetch, ttlMs = 5 * 60_000, now = Date.now } = options;
  const cache = new Map<string, { user: VerifiedUser; expiresAt: number }>();
  const MAX_CACHE = 1000;

  return async (authorization) => {
    const match = /^Bearer\s+(.+)$/i.exec(authorization ?? "");
    if (!match) return null;
    const token = match[1].trim();
    const key = createHash("sha256").update(token).digest("hex");

    const hit = cache.get(key);
    if (hit && hit.expiresAt > now()) return hit.user;
    cache.delete(key);

    try {
      const res = await fetchImpl(`${url.replace(/\/+$/, "")}/auth/v1/user`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { id?: unknown };
      if (typeof body.id !== "string" || !body.id) return null;
      const user = { id: body.id };
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
      cache.set(key, { user, expiresAt: now() + ttlMs });
      return user;
    } catch {
      return null;
    }
  };
}

// ---------------------------------------------------------------------------
// Rate limiting (fixed window, in memory)
// ---------------------------------------------------------------------------

export function createRateLimiter(limit: number, windowMs = 60_000, now: () => number = Date.now) {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return (key: string): { allowed: boolean; retryAfterSec: number } => {
    const t = now();
    if (windows.size > 5000) {
      for (const [k, w] of windows) if (w.resetAt <= t) windows.delete(k);
    }
    let w = windows.get(key);
    if (!w || w.resetAt <= t) {
      w = { count: 0, resetAt: t + windowMs };
      windows.set(key, w);
    }
    w.count += 1;
    return { allowed: w.count <= limit, retryAfterSec: Math.max(1, Math.ceil((w.resetAt - t) / 1000)) };
  };
}

/** Best-effort client IP behind a reverse proxy (Render sets X-Forwarded-For). */
export function clientIp(req: http.IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "unknown";
}
