import { test } from "node:test";
import assert from "node:assert/strict";
import { geolocateSourceIps, geolocationToFinding } from "./index.ts";
import { MaxMindGeoProvider } from "./maxmind-client.ts";

function fakeFetch(body: unknown): typeof fetch {
  return (async () => ({ ok: true, status: 200, json: async () => body }) as Response) as typeof fetch;
}

test("geolocateSourceIps filters out private/reserved IPs before looking any up", async () => {
  const provider = new MaxMindGeoProvider({ accountId: "a", licenseKey: "k", fetchImpl: fakeFetch({ country: { iso_code: "US" } }) });
  const results = await geolocateSourceIps(["10.0.0.1", "8.8.8.8", "127.0.0.1", "1.1.1.1"], provider);
  assert.deepEqual(results.map((r) => r.ip), ["8.8.8.8", "1.1.1.1"]);
});

test("geolocationToFinding never claims an exact address, always says approximate", () => {
  const finding = geolocationToFinding({
    ip: "8.8.8.8",
    lookup: { status: "found", result: { ip: "8.8.8.8", country: "United States", countryCode: "US", region: "California", city: "Mountain View", asn: 15169, organization: "GOOGLE", network: "8.8.8.0/24", accuracyRadiusKm: 1000 } },
  });
  assert.match(finding.explanation, /APPROXIMATE/);
  assert.doesNotMatch(finding.finding.toLowerCase(), /exact/);
});

test("geolocationToFinding handles unavailable status without fabricating a location", () => {
  const finding = geolocationToFinding({ ip: "8.8.8.8", lookup: { status: "unavailable", ip: "8.8.8.8", message: "Geolocation unavailable — MAXMIND_ACCOUNT_ID / MAXMIND_LICENSE_KEY are not configured." } });
  assert.equal(finding.confidence, "low");
  assert.doesNotMatch(finding.finding, /location:/i);
});
