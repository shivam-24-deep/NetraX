import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeDomainForHomoglyphs,
  decodePunycodeLabel,
  isPunycodeLabel,
  normalizeConfusables,
} from "./homoglyph.ts";

test("decodePunycodeLabel matches the RFC 3492 worked example (München)", () => {
  assert.equal(decodePunycodeLabel("mnchen-3ya"), "münchen");
});

test("isPunycodeLabel detects the xn-- prefix case-insensitively", () => {
  assert.equal(isPunycodeLabel("xn--mnchen-3ya"), true);
  assert.equal(isPunycodeLabel("XN--mnchen-3ya"), true);
  assert.equal(isPunycodeLabel("example"), false);
});

test("normalizeConfusables maps Cyrillic look-alikes to Latin letters", () => {
  // "paypal" with Cyrillic а (U+0430) replacing the Latin a's
  const spoofed = "pаypаl";
  assert.equal(normalizeConfusables(spoofed), "paypal");
});

test("analyzeDomainForHomoglyphs flags a raw-Unicode confusable domain", () => {
  const result = analyzeDomainForHomoglyphs("pаypаl.com");
  assert.equal(result.hasPunycodeLabel, false);
  assert.equal(result.hasNonAsciiCharacters, true);
  assert.equal(result.normalizedDomain, "paypal.com");
});

test("analyzeDomainForHomoglyphs decodes a punycode label before normalizing", () => {
  const result = analyzeDomainForHomoglyphs("xn--mnchen-3ya.de");
  assert.equal(result.hasPunycodeLabel, true);
  assert.equal(result.decodedDomain, "münchen.de");
});

test("analyzeDomainForHomoglyphs treats an ordinary ASCII domain as clean", () => {
  const result = analyzeDomainForHomoglyphs("example.com");
  assert.equal(result.hasPunycodeLabel, false);
  assert.equal(result.hasNonAsciiCharacters, false);
  assert.equal(result.normalizedDomain, "example.com");
});
