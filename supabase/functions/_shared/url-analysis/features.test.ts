import { test } from "node:test";
import assert from "node:assert/strict";
import { extractUrlFeatures } from "./features.ts";

test("parses a normal https URL correctly", () => {
  const f = extractUrlFeatures("https://example.com/login?redirect=home");
  assert.equal(f.isValid, true);
  assert.equal(f.hostname, "example.com");
  assert.equal(f.isHttps, true);
  assert.equal(f.queryParamCount, 1);
  assert.equal(f.subdomainCount, 0);
  assert.equal(f.tld, "com");
});

test("detects an IP address used as hostname", () => {
  const f = extractUrlFeatures("http://203.0.113.5/login");
  assert.equal(f.isIpAsHostname, true);
});

test("detects an at-symbol in the URL", () => {
  const f = extractUrlFeatures("http://real-site.com@evil.example/login");
  assert.equal(f.hasAtSymbol, true);
});

test("counts subdomains correctly", () => {
  const f = extractUrlFeatures("https://a.b.c.example.com/x");
  assert.equal(f.subdomainCount, 3);
});

test("detects a known shortener", () => {
  const f = extractUrlFeatures("https://bit.ly/abc123");
  assert.equal(f.isShortener, true);
});

test("detects non-https", () => {
  const f = extractUrlFeatures("http://example.com");
  assert.equal(f.isHttps, false);
});

test("computes percent-encoding density", () => {
  const f = extractUrlFeatures("http://x.com/%2e%2e%2f%2e%2e%2f");
  assert.ok(f.percentEncodingDensity > 0.3);
});

test("handles a garbage string that cannot be parsed as a URL gracefully", () => {
  const f = extractUrlFeatures("http://");
  assert.equal(f.isValid, false);
});

test("accepts a bare hostname without a protocol", () => {
  const f = extractUrlFeatures("example.com/path");
  assert.equal(f.isValid, true);
  assert.equal(f.hostname, "example.com");
});
