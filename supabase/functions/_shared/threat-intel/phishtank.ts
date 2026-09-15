// Phase 6 — PhishTank threat intelligence adapter.
//
// IMPORTANT (verified live 2026-09-06): checkurl.phishtank.com returns a
// Cloudflare bot-challenge page for unauthenticated requests — this adapter
// does not attempt to work around that (evading anti-bot protection is out
// of scope and against PhishTank's terms). Without PHISHTANK_APP_KEY, it
// reports "unavailable" rather than trying and silently failing. Behavior
// WITH a real key has not been verified in this environment, since none is
// available — get one free at https://phishtank.org/.

import { getEnv } from "../env.ts";
import type { IndicatorType, ThreatIntelLookupResult, ThreatIntelProvider } from "./types.ts";

const CHECK_URL_ENDPOINT = "https://checkurl.phishtank.com/checkurl/";
const SOURCE_NAME = "PhishTank";

type FetchLike = typeof fetch;

export class PhishTankProvider implements ThreatIntelProvider {
  readonly name = SOURCE_NAME;
  private readonly appKey: string | undefined;
  private readonly fetchImpl: FetchLike;

  constructor(options: { appKey?: string; fetchImpl?: FetchLike } = {}) {
    this.appKey = options.appKey ?? getEnv("PHISHTANK_APP_KEY");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  supports(indicatorType: IndicatorType): boolean {
    return indicatorType === "url";
  }

  async lookup(indicator: string, indicatorType: IndicatorType): Promise<ThreatIntelLookupResult> {
    if (!this.appKey) {
      return {
        status: "unavailable",
        source: this.name,
        indicator,
        message: "Threat intelligence unavailable — PHISHTANK_APP_KEY is not configured.",
      };
    }
    if (indicatorType !== "url") {
      return {
        status: "unavailable",
        source: this.name,
        indicator,
        message: "PhishTank only supports URL indicators.",
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await this.fetchImpl(CHECK_URL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `url=${encodeURIComponent(indicator)}&format=json&app_key=${encodeURIComponent(this.appKey)}`,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return {
          status: "unavailable",
          source: this.name,
          indicator,
          message: `Threat intelligence unavailable — PhishTank API returned HTTP ${res.status}.`,
        };
      }

      const data = await res.json();
      return this.parseResponse(indicator, data);
    } catch (err) {
      return {
        status: "unavailable",
        source: this.name,
        indicator,
        message: `Threat intelligence unavailable — could not reach PhishTank (${err instanceof Error ? err.message : "unknown error"}).`,
      };
    }
  }

  private parseResponse(indicator: string, data: unknown): ThreatIntelLookupResult {
    if (typeof data !== "object" || data === null || !("results" in data)) {
      return { status: "unavailable", source: this.name, indicator, message: "Threat intelligence unavailable — malformed response." };
    }
    const results = (data as { results?: Record<string, unknown> }).results;
    if (!results || results.in_database !== true) {
      return { status: "not_found", source: this.name, indicator, message: "Not found in threat-intelligence source." };
    }

    const verified = results.verified === true;
    return {
      status: "matched",
      result: {
        indicator,
        indicator_type: "url",
        matched: true,
        source: this.name,
        confidence: verified ? "high" : "medium",
        first_seen: typeof results.submission_time === "string" ? results.submission_time : null,
        last_seen: typeof results.verified_at === "string" ? results.verified_at : null,
        category: "phishing",
        metadata: {
          phish_id: results.phish_id ?? null,
          verified,
          phish_detail_page: results.phish_detail_page ?? null,
        },
      },
    };
  }
}
