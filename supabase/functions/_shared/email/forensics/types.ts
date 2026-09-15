// Phase 4 — Email Forensics Engine types.
//
// Every ForensicFinding traces back to a literal value in the parsed email —
// this module never invents evidence. An absent header produces a finding
// that says so explicitly (see ABSENT_EVIDENCE below), it never gets skipped
// silently and never gets treated as if it were present-and-clean.

export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type Confidence = "low" | "medium" | "high";

export type ForensicSource =
  | "sender_analysis"
  | "domain_analysis"
  | "authentication"
  | "received_chain"
  | "message_id"
  | "timestamp_analysis";

export interface ForensicFinding {
  /** Stable machine-readable slug, e.g. "reply_to_domain_mismatch". Used for dedup/testing, not display. */
  id: string;
  finding: string;
  severity: Severity;
  /** The literal header/value this finding is based on — never a paraphrase or inference. */
  evidence: string;
  source: ForensicSource;
  confidence: Confidence;
  explanation: string;
}

/** Standard phrase used whenever a finding is about a header that simply isn't in the submitted email. */
export const ABSENT_EVIDENCE = "Not available in submitted email";

export interface ReceivedHop {
  raw: string;
  /** 0 = topmost header = most recently added hop, closest to the recipient. */
  index: number;
  fromHost?: string;
  byHost?: string;
  withProtocol?: string;
  forAddress?: string;
  /** Raw date string as it appeared after the ";" in the header, if present. */
  timestampRaw?: string;
  /** Parsed to a Date only if the raw string was unambiguously parseable — never guessed. */
  timestampParsed?: Date;
  extractedIps: string[];
}

export interface EmailForensicsReport {
  findings: ForensicFinding[];
  receivedChain: ReceivedHop[];
  /** IPs found anywhere in the Received chain, hop order preserved, duplicates removed.
   *  Unfiltered — private/reserved/localhost filtering is Phase 7's job, not this module's. */
  sourceIpCandidates: string[];
}
