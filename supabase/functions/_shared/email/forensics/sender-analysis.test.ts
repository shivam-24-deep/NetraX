import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeMessageId, analyzeSenderIdentity, parseAddress } from "./sender-analysis.ts";
import type { EmailHeaders } from "../types.ts";

function baseHeaders(overrides: Partial<EmailHeaders> = {}): EmailHeaders {
  return { to: [], cc: [], bcc: [], received: [], raw: {}, ...overrides };
}

test("parseAddress extracts display name, email, and domain", () => {
  const parsed = parseAddress("Alice Example <alice@example.com>");
  assert.equal(parsed.displayName, "Alice Example");
  assert.equal(parsed.email, "alice@example.com");
  assert.equal(parsed.domain, "example.com");
});

test("parseAddress handles a bare address with no display name", () => {
  const parsed = parseAddress("alice@example.com");
  assert.equal(parsed.displayName, undefined);
  assert.equal(parsed.email, "alice@example.com");
});

test("flags absent From header explicitly rather than skipping silently", () => {
  const findings = analyzeSenderIdentity(baseHeaders());
  assert.ok(findings.some((f) => f.id === "from_header_absent"));
});

test("flags display-name brand impersonation when domain is unrelated", () => {
  const findings = analyzeSenderIdentity(baseHeaders({ from: "PayPal Security <security@totally-not-paypal.xyz>" }));
  assert.ok(findings.some((f) => f.id === "display_name_brand_mismatch"));
});

test("does not flag brand mismatch when the domain genuinely is the brand's", () => {
  const findings = analyzeSenderIdentity(baseHeaders({ from: "PayPal <service@paypal.com>" }));
  assert.ok(!findings.some((f) => f.id === "display_name_brand_mismatch"));
});

test("flags Reply-To domain mismatch", () => {
  const findings = analyzeSenderIdentity(baseHeaders({ from: "a@example.com", replyTo: "b@other-domain.com" }));
  assert.ok(findings.some((f) => f.id === "reply_to_domain_mismatch"));
});

test("does not flag Reply-To mismatch when domains match", () => {
  const findings = analyzeSenderIdentity(baseHeaders({ from: "a@example.com", replyTo: "b@example.com" }));
  assert.ok(!findings.some((f) => f.id === "reply_to_domain_mismatch"));
});

test("flags Return-Path domain mismatch", () => {
  const findings = analyzeSenderIdentity(baseHeaders({ from: "a@example.com", returnPath: "<bounce@other.com>" }));
  assert.ok(findings.some((f) => f.id === "return_path_domain_mismatch"));
});

test("flags typosquatting via edit distance", () => {
  const findings = analyzeSenderIdentity(baseHeaders({ from: "a@paypa1.com" }));
  assert.ok(findings.some((f) => f.id === "typosquat_domain"));
});

test("flags homoglyph brand impersonation after confusable normalization", () => {
  const findings = analyzeSenderIdentity(baseHeaders({ from: "a@pаypal.com" })); // Cyrillic а
  assert.ok(findings.some((f) => f.id === "homoglyph_brand_impersonation"));
});

test("flags low-trust TLD", () => {
  const findings = analyzeSenderIdentity(baseHeaders({ from: "a@some-random-shop.xyz" }));
  assert.ok(findings.some((f) => f.id === "low_trust_tld"));
});

test("does not flag a short legitimate domain as typosquatting a short brand name by chance", () => {
  // aol.com and dhl.com are edit-distance 2 apart purely by coincidence of length —
  // real bug found via real-corpus validation, not a hypothetical.
  const findings = analyzeSenderIdentity(baseHeaders({ from: "a@aol.com" }));
  assert.ok(!findings.some((f) => f.id === "typosquat_domain"));
});

test("still flags typosquatting against longer brand names", () => {
  const findings = analyzeSenderIdentity(baseHeaders({ from: "a@paypa1.com" }));
  assert.ok(findings.some((f) => f.id === "typosquat_domain" && f.evidence.includes("paypal.com")));
});

test("does not flag an ordinary legitimate domain with anything", () => {
  const findings = analyzeSenderIdentity(baseHeaders({ from: "Dermot Daly <dermot.daly@itsmobile.com>" }));
  const badIds = findings.filter((f) => f.severity === "high" || f.severity === "critical");
  assert.deepEqual(badIds, []);
});

test("analyzeMessageId reports absence explicitly", () => {
  const findings = analyzeMessageId(baseHeaders());
  assert.ok(findings.some((f) => f.id === "message_id_absent"));
});

test("analyzeMessageId flags domain mismatch with From", () => {
  const findings = analyzeMessageId(baseHeaders({ from: "a@example.com", messageId: "<xyz123@totally-different.net>" }));
  assert.ok(findings.some((f) => f.id === "message_id_domain_mismatch"));
});
