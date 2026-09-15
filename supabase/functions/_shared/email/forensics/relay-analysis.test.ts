import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeRelayPatterns } from "./relay-analysis.ts";
import { parseReceivedChain } from "./received-chain.ts";

test("flags an unusually long relay chain", () => {
  const headers = Array.from({ length: 9 }, (_, i) => `from hop${i}.com; Mon, 1 Sep 2025 10:0${i}:00 +0000`);
  const findings = analyzeRelayPatterns(parseReceivedChain(headers));
  assert.ok(findings.some((f) => f.id === "unusually_long_relay_chain"));
});

test("does not flag a normal-length chain", () => {
  const headers = ["from a.com; Mon, 1 Sep 2025 10:00:00 +0000", "from b.com; Mon, 1 Sep 2025 09:59:00 +0000"];
  const findings = analyzeRelayPatterns(parseReceivedChain(headers));
  assert.ok(!findings.some((f) => f.id === "unusually_long_relay_chain"));
});

test("flags a hop with unresolved (unknown) source hostname", () => {
  const findings = analyzeRelayPatterns(parseReceivedChain(["from unknown (HELO evil) [203.0.113.5] by mx.example.com; Mon, 1 Sep 2025 10:00:00 +0000"]));
  assert.ok(findings.some((f) => f.id === "unresolved_relay_hostname"));
});
