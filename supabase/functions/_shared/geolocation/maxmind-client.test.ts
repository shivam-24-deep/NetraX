import { test } from "node:test";
import assert from "node:assert/strict";
import { MaxMindGeoProvider } from "./maxmind-client.ts";

function fakeFetch(response: { ok: boolean; status?: number; body?: unknown }): typeof fetch {
  return (async () =>
    ({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      json: async () => response.body,
    }) as Response) as typeof fetch;
}

test("reports unavailable when credentials are not configured", async () => {
  const provider = new MaxMindGeoProvider({ fetchImpl: fakeFetch({ ok: true, body: {} }) });
  const result = await provider.lookup("8.8.8.8");
  assert.equal(result.status, "unavailable");
  assert.equal(provider.isConfigured(), false);
});

test("parses a full successful response into approximate location fields", async () => {
  const body = {
    country: { iso_code: "US", names: { en: "United States" } },
    subdivisions: [{ names: { en: "California" } }],
    city: { names: { en: "Mountain View" } },
    traits: { autonomous_system_number: 15169, autonomous_system_organization: "GOOGLE", network: "8.8.8.0/24" },
    location: { accuracy_radius: 1000 },
  };
  const provider = new MaxMindGeoProvider({ accountId: "acc", licenseKey: "key", fetchImpl: fakeFetch({ ok: true, body }) });
  const result = await provider.lookup("8.8.8.8");
  assert.equal(result.status, "found");
  if (result.status === "found") {
    assert.equal(result.result.country, "United States");
    assert.equal(result.result.countryCode, "US");
    assert.equal(result.result.city, "Mountain View");
    assert.equal(result.result.asn, 15169);
    assert.equal(result.result.accuracyRadiusKm, 1000);
  }
});

test("handles a sparse response without inventing missing fields", async () => {
  const provider = new MaxMindGeoProvider({ accountId: "acc", licenseKey: "key", fetchImpl: fakeFetch({ ok: true, body: { country: { iso_code: "DE" } } }) });
  const result = await provider.lookup("1.2.3.4");
  assert.equal(result.status, "found");
  if (result.status === "found") {
    assert.equal(result.result.country, null);
    assert.equal(result.result.city, null);
    assert.equal(result.result.asn, null);
  }
});

test("reports not_found on HTTP 404", async () => {
  const provider = new MaxMindGeoProvider({ accountId: "acc", licenseKey: "key", fetchImpl: fakeFetch({ ok: false, status: 404 }) });
  const result = await provider.lookup("8.8.8.8");
  assert.equal(result.status, "not_found");
});

test("reports unavailable on other HTTP errors and network failures", async () => {
  const providerHttpError = new MaxMindGeoProvider({ accountId: "acc", licenseKey: "key", fetchImpl: fakeFetch({ ok: false, status: 401 }) });
  assert.equal((await providerHttpError.lookup("8.8.8.8")).status, "unavailable");

  const throwingFetch = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  const providerNetworkError = new MaxMindGeoProvider({ accountId: "acc", licenseKey: "key", fetchImpl: throwingFetch });
  assert.equal((await providerNetworkError.lookup("8.8.8.8")).status, "unavailable");
});
