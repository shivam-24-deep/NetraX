// Phase 4 — suspicious relay pattern checks over the Received chain.
//
// Deliberately conservative: cross-organization hostname changes between
// hops are NORMAL (sender's ISP -> spam filter -> recipient's server are
// routinely different domains), so that is not treated as a finding here —
// doing so would just be noise on every multi-hop email, not real evidence.

import type { ForensicFinding, ReceivedHop } from "./types.ts";

const LONG_CHAIN_THRESHOLD = 8;

export function analyzeRelayPatterns(chain: ReceivedHop[]): ForensicFinding[] {
  const findings: ForensicFinding[] = [];

  if (chain.length > LONG_CHAIN_THRESHOLD) {
    findings.push({
      id: "unusually_long_relay_chain",
      finding: `Unusually long relay chain (${chain.length} hops)`,
      severity: "low",
      evidence: `${chain.length} Received headers`,
      source: "received_chain",
      confidence: "low",
      explanation: "A long relay chain can indicate relay abuse or an unusual routing path, though mailing lists and forwarding services also legitimately add hops.",
    });
  }

  const unresolvedHops = chain.filter((hop) => hop.fromHost?.toLowerCase() === "unknown");
  for (const hop of unresolvedHops) {
    findings.push({
      id: "unresolved_relay_hostname",
      finding: `Hop ${hop.index} identifies its source host as "unknown"`,
      severity: "low",
      evidence: hop.raw,
      source: "received_chain",
      confidence: "low",
      explanation: "The relay could not resolve reverse DNS for the connecting host, which some legitimate misconfigured servers also exhibit — a weak signal on its own, more meaningful in combination with other findings.",
    });
  }

  return findings;
}
