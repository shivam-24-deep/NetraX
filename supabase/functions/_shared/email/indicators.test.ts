import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractBodySignals,
  extractCryptoAddresses,
  extractDomainsFromUrls,
  extractEmailAddresses,
  extractIpAddresses,
  extractPhoneNumbers,
  extractUrls,
} from "./indicators.ts";

test("extractUrls finds http/https links and trims trailing punctuation", () => {
  const urls = extractUrls("Visit https://example.com/login?x=1, or http://bit.ly/abc.");
  assert.deepEqual(urls, ["https://example.com/login?x=1", "http://bit.ly/abc"]);
});

test("extractDomainsFromUrls derives lowercase hostnames", () => {
  const domains = extractDomainsFromUrls(["https://Example.COM/x", "https://sub.example.com"]);
  assert.deepEqual(domains, ["example.com", "sub.example.com"]);
});

test("extractDomainsFromUrls skips unparseable URLs instead of guessing", () => {
  const domains = extractDomainsFromUrls(["not a url", "https://ok.com"]);
  assert.deepEqual(domains, ["ok.com"]);
});

test("extractEmailAddresses finds and lowercases addresses", () => {
  const emails = extractEmailAddresses("Contact Admin@Example.com or billing@example.org.");
  assert.deepEqual(emails, ["admin@example.com", "billing@example.org"]);
});

test("extractIpAddresses finds IPv4 addresses", () => {
  const ips = extractIpAddresses("Source: 203.0.113.5, internal 10.0.0.1");
  assert.deepEqual(ips, ["203.0.113.5", "10.0.0.1"]);
});

test("extractIpAddresses rejects out-of-range octets", () => {
  const ips = extractIpAddresses("Not an IP: 999.999.999.999 but this is: 8.8.8.8");
  assert.deepEqual(ips, ["8.8.8.8"]);
});

test("extractPhoneNumbers requires enough digits to reduce false positives", () => {
  const phones = extractPhoneNumbers("Call +1-555-123-4567 now. Ref: 12-34.");
  assert.deepEqual(phones, ["+1-555-123-4567"]);
});

test("extractCryptoAddresses finds BTC and ETH style addresses", () => {
  const addrs = extractCryptoAddresses("Send to 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa or 0x1234567890abcdef1234567890abcdef12345678");
  assert.equal(addrs.length, 2);
});

test("extractBodySignals flags known phrases with category and context", () => {
  const signals = extractBodySignals("Your account will be suspended. Please wire transfer immediately.");
  const categories = signals.map((s) => s.category).sort();
  assert.ok(categories.includes("urgency"));
  assert.ok(categories.includes("financial"));
  for (const s of signals) {
    assert.ok(s.context.length > 0);
  }
});

test("extractBodySignals returns nothing for a benign message", () => {
  const signals = extractBodySignals("Hi team, attaching the quarterly report for your review. Thanks!");
  assert.deepEqual(signals, []);
});
