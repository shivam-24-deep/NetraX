// Phase 6 — URLhaus threat intelligence adapter.
//
// IMPORTANT (verified live 2026-09-06, corrects an earlier assumption in
// Phase 1's docs): abuse.ch's static bulk CSV downloads work without a key,
// but the query API used here for live single-indicator lookups now returns
// {"error":"Unauthorized"} without an Auth-Key. Get one free at
// https://auth.abuse.ch/. Without URLHAUS_AUTH_KEY, this adapter reports
// "unavailable" — it never falls back to the offline CSV snapshot to answer
// a live query, since that snapshot ages and would misrepresent a stale
// result as current.

import { getEnv } from "../env.ts";
import type { IndicatorType, ThreatIntelLookupResult, ThreatIntelProvider } from "./types.ts";

const API_BASE = "https://urlhaus-api.abuse.ch/v1";
const SOURCE_NAME = "URLhaus";

type FetchLike = typeof fetch;

export class URLhausProvider implements ThreatIntelProvider {
  readonly name = SOURCE_NAME;
  private readonly authKey: string | undefined;
  private readonly fetchImpl: FetchLike;

  constructor(options: { authKey?: string; fetchImpl?: FetchLike } = {}) {
    this.authKey = options.authKey ?? getEnv("URLHAUS_AUTH_KEY");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  supports(indicatorType: IndicatorType): boolean {
    return indicatorType === "url" || indicatorType === "domain" || indicatorType === "ip";
  }

  async lookup(indicator: string, indicatorType: IndicatorType): Promise<ThreatIntelLookupResult> {
    if (!this.authKey) {
      return {
        status: "unavailable",
        source: this.name,
        indicator,
        message: "Threat intelligence unavailable — URLHAUS_AUTH_KEY is not configured.",
      };
    }

    const endpoint = indicatorType === "url" ? `${API_BASE}/url/` : `${API_BASE}/host/`;
    const paramName = indicatorType === "url" ? "url" : "host";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await this.fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Auth-Key": this.authKey },
        body: `${paramName}=${encodeURIComponent(indicator)}`,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return {
          status: "unavailable",
          source: this.name,
          indicator,
          message: `Threat intelligence unavailable — URLhaus API returned HTTP ${res.status}.`,
        };
      }

      const data = await res.json();
      return this.parseResponse(indicator, indicatorType, data);
    } catch (err) {
      return {
        status: "unavailable",
        source: this.name,
        indicator,
        message: `Threat intelligence unavailable — could not reach URLhaus (${err instanceof Error ? err.message : "unknown error"}).`,
      };
    }
  }

  private parseResponse(indicator: string, indicatorType: IndicatorType, data: unknown): ThreatIntelLookupResult {
    if (typeof data !== "object" || data === null) {
      return { status: "unavailable", source: this.name, indicator, message: "Threat intelligence unavailable — malformed response." };
    }
    const record = data as Record<string, unknown>;
    const queryStatus = typeof record.query_status === "string" ? record.query_status : "";

    if (queryStatus !== "ok") {
      return {
        status: "not_found",
        source: this.name,
        indicator,
        message: "Not found in threat-intelligence source.",
      };
    }

    return {
      status: "matched",
      result: {
        indicator,
        indicator_type: indicatorType,
        matched: true,
        source: this.name,
        confidence: "high",
        first_seen: typeof record.date_added === "string" ? record.date_added : (typeof record.firstseen === "string" ? record.firstseen : null),
        last_seen: typeof record.last_online === "string" ? record.last_online : null,
        category: typeof record.threat === "string" ? record.threat : null,
        metadata: {
          url_status: record.url_status ?? null,
          tags: record.tags ?? null,
          urlhaus_reference: record.urlhaus_reference ?? null,
          url_count: record.url_count ?? null,
        },
      },
    };
  }
}
