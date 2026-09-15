// Phase 4 — timestamp consistency checks between the Date header and the
// Received chain. Tolerances are intentionally generous (real mail servers
// have clock skew and real transit delay) so this flags genuine anomalies,
// not routine variance.

import type { EmailHeaders } from "../types.ts";
import { ABSENT_EVIDENCE, type ForensicFinding, type ReceivedHop } from "./types.ts";

const CLOCK_SKEW_TOLERANCE_MS = 10 * 60 * 1000; // 10 minutes
const RELAY_DELAY_TOLERANCE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export function analyzeTimestamps(headers: EmailHeaders, chain: ReceivedHop[]): ForensicFinding[] {
  const findings: ForensicFinding[] = [];

  if (!headers.date) {
    findings.push({
      id: "date_header_absent",
      finding: "No Date header present",
      severity: "low",
      evidence: ABSENT_EVIDENCE,
      source: "timestamp_analysis",
      confidence: "high",
      explanation: "A missing Date header is unusual for standards-compliant mail, though some relays can strip it.",
    });
  } else {
    const dateParsed = new Date(headers.date);
    if (Number.isNaN(dateParsed.getTime())) {
      findings.push({
        id: "date_header_unparseable",
        finding: "Date header could not be parsed as a valid date",
        severity: "low",
        evidence: `Date: ${headers.date}`,
        source: "timestamp_analysis",
        confidence: "high",
        explanation: "The Date header value doesn't match any recognizable date format, which is itself unusual for standards-compliant mail software.",
      });
    } else {
      const now = new Date();
      if (dateParsed.getTime() > now.getTime() + CLOCK_SKEW_TOLERANCE_MS) {
        findings.push({
          id: "date_header_in_future",
          finding: "Date header is in the future relative to analysis time",
          severity: "medium",
          evidence: `Date: ${headers.date}`,
          source: "timestamp_analysis",
          confidence: "medium",
          explanation: "A future-dated Date header can indicate a misconfigured or deliberately manipulated sending system, though minor clock drift can also be the cause.",
        });
      }

      const mostRecentHop = chain[0];
      if (mostRecentHop?.timestampParsed) {
        const diff = Math.abs(dateParsed.getTime() - mostRecentHop.timestampParsed.getTime());
        if (diff > RELAY_DELAY_TOLERANCE_MS) {
          findings.push({
            id: "date_relay_timestamp_mismatch",
            finding: "Date header differs substantially from Received chain timestamps",
            severity: "low",
            evidence: `Date: ${headers.date}; most recent Received timestamp: ${mostRecentHop.timestampRaw}`,
            source: "timestamp_analysis",
            confidence: "low",
            explanation: "The sender-supplied Date header is more than 3 days apart from when the receiving server actually processed the message. The Date header is sender-controlled and unverified, so this can reflect either a delayed/replayed message or simple sender misconfiguration.",
          });
        }
      }
    }
  }

  for (let i = 0; i < chain.length - 1; i++) {
    const closerToRecipient = chain[i];
    const closerToOrigin = chain[i + 1];
    if (!closerToRecipient.timestampParsed || !closerToOrigin.timestampParsed) continue;
    const backwardDrift = closerToOrigin.timestampParsed.getTime() - closerToRecipient.timestampParsed.getTime();
    if (backwardDrift > CLOCK_SKEW_TOLERANCE_MS) {
      findings.push({
        id: "received_chain_timestamp_out_of_order",
        finding: "Received chain timestamps are out of chronological order",
        severity: "medium",
        evidence: `Hop ${closerToRecipient.index} (${closerToRecipient.timestampRaw}) is earlier than hop ${closerToOrigin.index} (${closerToOrigin.timestampRaw}), which should have happened before it`,
        source: "timestamp_analysis",
        confidence: "medium",
        explanation: "Received headers are prepended by each relay in the order mail actually traveled, so timestamps should decrease (allowing for minor clock skew) moving from the topmost header toward the origin. An out-of-order timestamp can indicate a forged, reordered, or injected header.",
      });
    }
  }

  return findings;
}
