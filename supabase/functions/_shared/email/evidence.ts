// Shared evidence shape used across forensics (Phase 4), URL analysis
// (Phase 5), threat intelligence (Phase 6), geolocation (Phase 7), and ML
// signals — so Phase 11/12's evidence fusion can combine all of them without
// per-source translation. Forensics' ForensicFinding (forensics/types.ts)
// already structurally matches this; new modules should use it directly.

export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type Confidence = "low" | "medium" | "high";

export type EvidenceSource =
  | "sender_analysis"
  | "domain_analysis"
  | "authentication"
  | "received_chain"
  | "message_id"
  | "timestamp_analysis"
  | "url_analysis"
  | "threat_intelligence"
  | "ip_geolocation"
  | "ml_model"
  | "content_analysis";

export interface Finding {
  id: string;
  finding: string;
  severity: Severity;
  evidence: string;
  source: EvidenceSource;
  confidence: Confidence;
  explanation: string;
}

export const ABSENT_EVIDENCE = "Not available in submitted email";
export const UNAVAILABLE_EVIDENCE = "Unavailable — could not be checked";
