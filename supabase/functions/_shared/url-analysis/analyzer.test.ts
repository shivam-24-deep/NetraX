import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeUrl } from "./analyzer.ts";

test("flags IP-as-hostname", () => {
  const { findings } = analyzeUrl("http://203.0.113.5/login");
  assert.ok(findings.some((f) => f.id === "url_ip_as_hostname"));
});

test("flags @ symbol", () => {
  const { findings } = analyzeUrl("http://trusted.com@evil.example/x");
  assert.ok(findings.some((f) => f.id === "url_at_symbol"));
});

test("flags non-https", () => {
  const { findings } = analyzeUrl("http://example.com");
  assert.ok(findings.some((f) => f.id === "url_not_https"));
});

test("does not flag a clean https legitimate-looking URL with anything severe", () => {
  const { findings } = analyzeUrl("https://example.com/docs/getting-started");
  const severe = findings.filter((f) => f.severity === "high" || f.severity === "critical");
  assert.deepEqual(severe, []);
});

test("flags typosquatting on a URL domain", () => {
  const { findings } = analyzeUrl("https://paypa1.com/login");
  assert.ok(findings.some((f) => f.id === "url_typosquat_domain"));
});

test("flags homoglyph brand impersonation on a URL domain", () => {
  const { findings } = analyzeUrl("https://pаypal.com/login"); // Cyrillic а
  assert.ok(findings.some((f) => f.id === "url_homoglyph_brand_impersonation"));
});

test("does not flag typosquatting for a short legitimate domain (regression: aol.com vs dhl.com)", () => {
  const { findings } = analyzeUrl("https://aol.com/mail");
  assert.ok(!findings.some((f) => f.id === "url_typosquat_domain"));
});

test("does not falsely flag the real brand domain itself", () => {
  const { findings } = analyzeUrl("https://paypal.com/login");
  assert.ok(!findings.some((f) => f.id.startsWith("url_typosquat") || f.id.startsWith("url_homoglyph") || f.id.startsWith("url_brand")));
});

test("reports unparseable input explicitly", () => {
  const { findings } = analyzeUrl("http://");
  assert.ok(findings.some((f) => f.id === "url_unparseable"));
});
