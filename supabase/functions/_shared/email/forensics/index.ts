// Phase 4 — Email Forensics Engine entry point. Combines all analyzers over
// a Phase 3 ParsedEmail's headers into one report. Pure/deterministic: no
// network calls, no LLM involvement — see docs/AGENT_ARCHITECTURE.md (Phase 10)
// for how an LLM later explains these findings without inventing new ones.

import type { EmailHeaders } from "../types.ts";
import type { EmailForensicsReport } from "./types.ts";
import { parseReceivedChain, collectSourceIpCandidates } from "./received-chain.ts";
import { analyzeSenderIdentity, analyzeMessageId } from "./sender-analysis.ts";
import { analyzeAuthentication } from "./auth-analysis.ts";
import { analyzeTimestamps } from "./timestamp-analysis.ts";
import { analyzeRelayPatterns } from "./relay-analysis.ts";

export function analyzeForensics(headers: EmailHeaders): EmailForensicsReport {
  const receivedChain = parseReceivedChain(headers.received);
  const sourceIpCandidates = collectSourceIpCandidates(receivedChain);

  const findings = [
    ...analyzeSenderIdentity(headers),
    ...analyzeMessageId(headers),
    ...analyzeAuthentication(headers),
    ...analyzeTimestamps(headers, receivedChain),
    ...analyzeRelayPatterns(receivedChain),
  ];

  return { findings, receivedChain, sourceIpCandidates };
}

export type { EmailForensicsReport, ForensicFinding, ReceivedHop, Severity, Confidence, ForensicSource } from "./types.ts";
export { ABSENT_EVIDENCE } from "./types.ts";
export { parseAddress } from "./sender-analysis.ts";
