import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeTimestamps } from "./timestamp-analysis.ts";
import { parseReceivedChain } from "./received-chain.ts";
import type { EmailHeaders } from "../types.ts";

function baseHeaders(overrides: Partial<EmailHeaders> = {}): EmailHeaders {
  return { to: [], cc: [], bcc: [], received: [], raw: {}, ...overrides };
}

test("reports absent Date header explicitly", () => {
  const findings = analyzeTimestamps(baseHeaders(), []);
  assert.ok(findings.some((f) => f.id === "date_header_absent"));
});

test("flags unparseable Date header", () => {
  const findings = analyzeTimestamps(baseHeaders({ date: "not a date at all" }), []);
  assert.ok(findings.some((f) => f.id === "date_header_unparseable"));
});

test("flags a Date header far in the future", () => {
  const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toUTCString();
  const findings = analyzeTimestamps(baseHeaders({ date: future }), []);
  assert.ok(findings.some((f) => f.id === "date_header_in_future"));
});

test("does not flag a normal recent Date header", () => {
  const findings = analyzeTimestamps(baseHeaders({ date: new Date().toUTCString() }), []);
  assert.ok(!findings.some((f) => f.id === "date_header_in_future"));
});

test("flags out-of-order Received chain timestamps", () => {
  const chain = parseReceivedChain([
    "from a.com; Mon, 1 Sep 2025 09:00:00 +0000", // index 0 (most recent) is EARLIER than index 1 — anomalous
    "from b.com; Mon, 1 Sep 2025 10:00:00 +0000", // index 1 (older hop) is LATER — backward in time
  ]);
  const findings = analyzeTimestamps(baseHeaders(), chain);
  assert.ok(findings.some((f) => f.id === "received_chain_timestamp_out_of_order"));
});

test("does not flag a normally-ordered Received chain", () => {
  const chain = parseReceivedChain([
    "from a.com; Mon, 1 Sep 2025 10:00:00 +0000",
    "from b.com; Mon, 1 Sep 2025 09:59:00 +0000",
    "from c.com; Mon, 1 Sep 2025 09:58:00 +0000",
  ]);
  const findings = analyzeTimestamps(baseHeaders(), chain);
  assert.ok(!findings.some((f) => f.id === "received_chain_timestamp_out_of_order"));
});
