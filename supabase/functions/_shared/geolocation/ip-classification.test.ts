import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyIp, filterToPublicIps, isPublicIp } from "./ip-classification.ts";

test("classifies RFC1918 private ranges", () => {
  assert.equal(classifyIp("10.1.2.3"), "private");
  assert.equal(classifyIp("172.16.0.1"), "private");
  assert.equal(classifyIp("172.31.255.255"), "private");
  assert.equal(classifyIp("192.168.1.1"), "private");
});

test("does not misclassify a public IP that merely starts similarly to a private range", () => {
  // 172.32.x.x is OUTSIDE 172.16.0.0/12 (which ends at 172.31.255.255) — a naive
  // startsWith("172.") check would wrongly call this private.
  assert.equal(classifyIp("172.32.0.1"), "public");
  // 101.x.x.x is public, not to be confused with the 10.x.x.x private range.
  assert.equal(classifyIp("101.2.3.4"), "public");
});

test("classifies loopback correctly for v4 and v6", () => {
  assert.equal(classifyIp("127.0.0.1"), "loopback");
  assert.equal(classifyIp("127.255.255.254"), "loopback");
  assert.equal(classifyIp("::1"), "loopback");
});

test("classifies link-local ranges", () => {
  assert.equal(classifyIp("169.254.1.1"), "link_local");
  assert.equal(classifyIp("fe80::1"), "link_local");
});

test("classifies carrier-grade NAT range (100.64.0.0/10)", () => {
  assert.equal(classifyIp("100.64.0.1"), "carrier_grade_nat");
  assert.equal(classifyIp("100.127.255.255"), "carrier_grade_nat");
  assert.equal(classifyIp("100.128.0.1"), "public"); // just outside the /10
});

test("classifies documentation ranges (TEST-NET)", () => {
  assert.equal(classifyIp("192.0.2.5"), "documentation");
  assert.equal(classifyIp("198.51.100.5"), "documentation");
  assert.equal(classifyIp("203.0.113.5"), "documentation");
});

test("classifies IPv6 unique local and multicast", () => {
  assert.equal(classifyIp("fc00::1"), "private");
  assert.equal(classifyIp("ff02::1"), "multicast");
});

test("classifies a normal public IPv4 address correctly", () => {
  assert.equal(classifyIp("8.8.8.8"), "public");
  assert.equal(classifyIp("203.0.114.1"), "public"); // just outside the 203.0.113.0/24 documentation block
});

test("classifies a normal public IPv6 address correctly", () => {
  assert.equal(classifyIp("2001:4860:4860::8888"), "public"); // Google public DNS
});

test("classifies malformed input as invalid, never guesses", () => {
  assert.equal(classifyIp("999.999.999.999"), "invalid");
  assert.equal(classifyIp("not-an-ip"), "invalid");
});

test("unwraps 6to4 (2002::/16) addresses and classifies by their embedded IPv4", () => {
  // 2002:0a05:7011:: embeds 10.5.112.17 — private, should not reach MaxMind.
  assert.equal(classifyIp("2002:a05:7011:8383:b0:548:68ab:3c55"), "private");
  // 2002:0808:0808:: embeds 8.8.8.8 — a real public 6to4 address.
  assert.equal(classifyIp("2002:808:808::1"), "public");
});

test("isPublicIp / filterToPublicIps filter a mixed list correctly, preserving order", () => {
  const ips = ["10.0.0.1", "8.8.8.8", "127.0.0.1", "203.0.113.5", "1.1.1.1"];
  assert.deepEqual(filterToPublicIps(ips), ["8.8.8.8", "1.1.1.1"]);
  assert.equal(isPublicIp("8.8.8.8"), true);
  assert.equal(isPublicIp("10.0.0.1"), false);
});
