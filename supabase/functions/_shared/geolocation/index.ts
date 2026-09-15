// Phase 7 — Geolocation entry point: filters candidate IPs (e.g. from
// Phase 4's Received-chain extraction) down to public ones, geolocates each
// via MaxMind, and produces evidence Findings. Private/reserved/localhost
// IPs are excluded entirely — see Phase 7 spec.

import type { Finding } from "../email/evidence.ts";
import { filterToPublicIps } from "./ip-classification.ts";
import { MaxMindGeoProvider, type GeoLookupResult } from "./maxmind-client.ts";

export interface GeolocatedIp {
  ip: string;
  lookup: GeoLookupResult;
}

export async function geolocateSourceIps(
  candidateIps: string[],
  provider: MaxMindGeoProvider = new MaxMindGeoProvider(),
): Promise<GeolocatedIp[]> {
  const publicIps = filterToPublicIps(candidateIps);
  return Promise.all(publicIps.map(async (ip) => ({ ip, lookup: await provider.lookup(ip) })));
}

export function geolocationToFinding(entry: GeolocatedIp): Finding {
  const { ip, lookup } = entry;
  if (lookup.status === "found") {
    const r = lookup.result;
    const location = [r.city, r.region, r.country].filter(Boolean).join(", ") || "unknown location";
    return {
      id: `geolocation_${ip}`,
      finding: `Source IP ${ip} traces to approximate infrastructure location: ${location}`,
      severity: "info",
      evidence: `IP: ${ip}; ASN: ${r.asn ?? "unknown"} (${r.organization ?? "unknown organization"})`,
      source: "ip_geolocation",
      confidence: r.accuracyRadiusKm !== null && r.accuracyRadiusKm <= 50 ? "medium" : "low",
      explanation: `This is an APPROXIMATE infrastructure geolocation based on IP registration data${r.accuracyRadiusKm !== null ? ` (MaxMind-reported accuracy radius: ~${r.accuracyRadiusKm}km)` : ""} — it identifies the network operator's likely region, not a physical address or the sender's exact location.`,
    };
  }
  if (lookup.status === "not_found") {
    return {
      id: `geolocation_${ip}_not_found`,
      finding: `No geolocation record found for source IP ${ip}`,
      severity: "info",
      evidence: ip,
      source: "ip_geolocation",
      confidence: "low",
      explanation: lookup.message,
    };
  }
  return {
    id: `geolocation_${ip}_unavailable`,
    finding: `Geolocation unavailable for source IP ${ip}`,
    severity: "info",
    evidence: ip,
    source: "ip_geolocation",
    confidence: "low",
    explanation: lookup.message,
  };
}

export { classifyIp, filterToPublicIps, isPublicIp, type IpClassification } from "./ip-classification.ts";
export { MaxMindGeoProvider } from "./maxmind-client.ts";
export type { GeoLocationResult, GeoLookupResult } from "./maxmind-client.ts";
