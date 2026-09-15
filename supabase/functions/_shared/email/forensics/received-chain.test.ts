import { test } from "node:test";
import assert from "node:assert/strict";
import { collectSourceIpCandidates, parseReceivedChain } from "./received-chain.ts";

test("parses a standard from/by/with/for/date Received header", () => {
  const raw =
    "from mail.example.com (mail.example.com [203.0.113.5]) by mx.recipient.com with ESMTP id abc123 " +
    "for <user@recipient.com>; Mon, 1 Sep 2025 10:00:00 +0000";
  const [hop] = parseReceivedChain([raw]);
  assert.equal(hop.fromHost, "mail.example.com");
  assert.equal(hop.byHost, "mx.recipient.com");
  assert.equal(hop.withProtocol, "ESMTP");
  assert.equal(hop.forAddress, "<user@recipient.com>");
  assert.equal(hop.timestampRaw, "Mon, 1 Sep 2025 10:00:00 +0000");
  assert.ok(hop.timestampParsed instanceof Date);
  assert.deepEqual(hop.extractedIps, ["203.0.113.5"]);
});

test("extracts a bracketed IP used directly as the from-host", () => {
  const raw = "from [198.51.100.7] by mx.recipient.com with SMTP; Mon, 1 Sep 2025 10:00:00 +0000";
  const [hop] = parseReceivedChain([raw]);
  assert.deepEqual(hop.extractedIps, ["198.51.100.7"]);
});

test("leaves fields undefined rather than guessing when a header is malformed/partial", () => {
  const raw = "from mail.example.com";
  const [hop] = parseReceivedChain([raw]);
  assert.equal(hop.byHost, undefined);
  assert.equal(hop.timestampRaw, undefined);
  assert.equal(hop.timestampParsed, undefined);
});

test("preserves hop order with index 0 = topmost/most recent header", () => {
  const chain = parseReceivedChain(["from a.com; Mon, 1 Sep 2025 10:00:00 +0000", "from b.com; Mon, 1 Sep 2025 09:00:00 +0000"]);
  assert.equal(chain[0].index, 0);
  assert.equal(chain[0].fromHost, "a.com");
  assert.equal(chain[1].index, 1);
  assert.equal(chain[1].fromHost, "b.com");
});

test("collectSourceIpCandidates dedupes across the whole chain, preserving order", () => {
  const chain = parseReceivedChain([
    "from a.com (a.com [203.0.113.5]) by b.com; Mon, 1 Sep 2025 10:00:00 +0000",
    "from b.com (b.com [203.0.113.5]) by c.com; Mon, 1 Sep 2025 09:59:00 +0000",
    "from c.com (c.com [198.51.100.1]) by d.com; Mon, 1 Sep 2025 09:58:00 +0000",
  ]);
  assert.deepEqual(collectSourceIpCandidates(chain), ["203.0.113.5", "198.51.100.1"]);
});
