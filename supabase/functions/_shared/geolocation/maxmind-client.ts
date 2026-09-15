// Phase 7 — MaxMind GeoLite2 web service client.
//
// Uses MaxMind's hosted GeoLite2 web service (HTTP + Basic Auth), not the
// downloadable .mmdb binary database — parsing that binary format from
// scratch would be substantial, error-prone work for no real benefit over
// calling the service MaxMind already runs. Gated on MAXMIND_ACCOUNT_ID +
// MAXMIND_LICENSE_KEY; this project has neither, so this client's behavior
// against the REAL API has not been verified live — implemented against
// MaxMind's documented contract (https://dev.maxmind.com/geoip/docs/web-services)
// and treated as unavailable, not fabricated, until credentials exist.
//
// Per Rule 4: results are always "approximate infrastructure geolocation",
// never an exact physical address.

import { getEnv } from "../env.ts";

const API_BASE = "https://geolite.info/geoip/v2.1/city";

export interface GeoLocationResult {
  ip: string;
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  asn: number | null;
  organization: string | null;
  network: string | null;
  /** Kilometers — MaxMind's own reported accuracy radius, surfaced so callers never overstate precision. */
  accuracyRadiusKm: number | null;
}

export type GeoLookupResult =
  | { status: "found"; result: GeoLocationResult }
  | { status: "not_found"; ip: string; message: string }
  | { status: "unavailable"; ip: string; message: string };

type FetchLike = typeof fetch;

export class MaxMindGeoProvider {
  private readonly accountId: string | undefined;
  private readonly licenseKey: string | undefined;
  private readonly fetchImpl: FetchLike;

  constructor(options: { accountId?: string; licenseKey?: string; fetchImpl?: FetchLike } = {}) {
    this.accountId = options.accountId ?? getEnv("MAXMIND_ACCOUNT_ID");
    this.licenseKey = options.licenseKey ?? getEnv("MAXMIND_LICENSE_KEY");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.accountId && this.licenseKey);
  }

  async lookup(ip: string): Promise<GeoLookupResult> {
    if (!this.accountId || !this.licenseKey) {
      return {
        status: "unavailable",
        ip,
        message: "Geolocation unavailable — MAXMIND_ACCOUNT_ID / MAXMIND_LICENSE_KEY are not configured.",
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const auth = btoa(`${this.accountId}:${this.licenseKey}`);
      const res = await this.fetchImpl(`${API_BASE}/${encodeURIComponent(ip)}`, {
        headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status === 404) {
        return { status: "not_found", ip, message: "MaxMind has no geolocation record for this IP." };
      }
      if (!res.ok) {
        return { status: "unavailable", ip, message: `Geolocation unavailable — MaxMind API returned HTTP ${res.status}.` };
      }

      const data = await res.json();
      return { status: "found", result: this.parseResponse(ip, data) };
    } catch (err) {
      return {
        status: "unavailable",
        ip,
        message: `Geolocation unavailable — could not reach MaxMind (${err instanceof Error ? err.message : "unknown error"}).`,
      };
    }
  }

  private parseResponse(ip: string, data: unknown): GeoLocationResult {
    const record = (data ?? {}) as Record<string, unknown>;
    const country = record.country as Record<string, unknown> | undefined;
    const subdivisions = record.subdivisions as Array<Record<string, unknown>> | undefined;
    const city = record.city as Record<string, unknown> | undefined;
    const traits = record.traits as Record<string, unknown> | undefined;
    const location = record.location as Record<string, unknown> | undefined;

    const namesOf = (obj: Record<string, unknown> | undefined): string | null => {
      const names = obj?.names as Record<string, string> | undefined;
      return names?.en ?? null;
    };

    return {
      ip,
      country: namesOf(country),
      countryCode: (country?.iso_code as string) ?? null,
      region: subdivisions?.length ? namesOf(subdivisions[0]) : null,
      city: namesOf(city),
      asn: (traits?.autonomous_system_number as number) ?? null,
      organization: (traits?.autonomous_system_organization as string) ?? null,
      network: (traits?.network as string) ?? null,
      accuracyRadiusKm: (location?.accuracy_radius as number) ?? null,
    };
  }
}
