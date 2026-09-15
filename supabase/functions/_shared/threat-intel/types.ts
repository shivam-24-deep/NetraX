// Phase 6 — Threat Intelligence provider contract.
//
// Rule 5: "no match" is never reported as "safe" — a provider returning
// not_found means only that this specific source has no record of the
// indicator, not that the indicator is clean. Rule 2/Phase 24: an
// unreachable/unconfigured provider reports "unavailable", never a fake
// match and never silently treated as not_found.

export type IndicatorType = "url" | "domain" | "ip" | "email";

export interface ThreatIntelMatch {
  indicator: string;
  indicator_type: IndicatorType;
  matched: true;
  source: string;
  confidence: "low" | "medium" | "high";
  first_seen: string | null;
  last_seen: string | null;
  category: string | null;
  metadata: Record<string, unknown>;
}

export type ThreatIntelLookupResult =
  | { status: "matched"; result: ThreatIntelMatch }
  | { status: "not_found"; source: string; indicator: string; message: string }
  | { status: "unavailable"; source: string; indicator: string; message: string };

export interface ThreatIntelProvider {
  readonly name: string;
  supports(indicatorType: IndicatorType): boolean;
  lookup(indicator: string, indicatorType: IndicatorType): Promise<ThreatIntelLookupResult>;
}
