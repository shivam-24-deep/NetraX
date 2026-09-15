import { test } from "node:test";
import assert from "node:assert/strict";
import { extractAllIpAddresses, extractIpv4Addresses, extractIpv6Addresses } from "./ip-utils.ts";

test("extractIpv4Addresses finds valid addresses and rejects out-of-range octets", () => {
  assert.deepEqual(extractIpv4Addresses("ok 8.8.8.8 bad 999.999.999.999"), ["8.8.8.8"]);
});

test("extractIpv6Addresses does not mistake a time-of-day for an address", () => {
  assert.deepEqual(extractIpv6Addresses("Mon, 1 Sep 2025 10:00:00 +0000"), []);
});

test("extractIpv6Addresses accepts addresses with hex letters", () => {
  assert.deepEqual(extractIpv6Addresses("addr 2001:db8:85a3::8a2e:370:7334 end"), ["2001:db8:85a3::8a2e:370:7334"]);
});

test("extractIpv6Addresses accepts :: compression even without hex letters", () => {
  assert.deepEqual(extractIpv6Addresses("loopback ::1 here"), ["::1"]);
});

test("extractAllIpAddresses combines v4 and v6 without duplicates", () => {
  const result = extractAllIpAddresses("v4: 203.0.113.5 v6: 2001:db8::1 repeat: 203.0.113.5");
  assert.deepEqual(result, ["203.0.113.5", "2001:db8::1"]);
});
