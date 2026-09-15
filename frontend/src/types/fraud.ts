import type { RemoteFinding, RemoteInvestigationResult, RemoteRiskAssessment } from "@/lib/mock/email-investigation-client"

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export type InputType = "SMS" | "EMAIL" | "URL" | "PHONE" | "TRANSACTION" | "GENERAL"

/** How this case's evidence arrived. Absent (undefined) means "manual" — the original Investigate page flow, before mobile ingestion existed. */
export type CaseSource = "mobile_share" | "web_upload" | "manual"

// Legacy (SMS/URL/Transaction, archived scope): OPEN | UNDER_REVIEW | RESOLVED | FALSE_POSITIVE.
// Email-forensics workflow (SIH26106): the rest — see docs/IMPLEMENTATION_PLAN.md case-status section.
export type CaseStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "RESOLVED"
  | "FALSE_POSITIVE"
  | "ANALYZING"
  | "INVESTIGATION_COMPLETE"
  | "REPORT_GENERATED"
  | "READY_FOR_REPORTING"
  | "DEMO_PACKAGE_GENERATED"
  | "SUBMITTED_EXTERNALLY"
  | "ACKNOWLEDGED"
  | "INVESTIGATION"

export type FraudCategory =
  | "Phishing"
  | "UPI Scam"
  | "KYC Scam"
  | "Investment Scam"
  | "OTP Scam"
  | "Lottery Scam"
  | "Job Scam"
  | "Impersonation"
  | "Transaction Anomaly"
  | "Uncategorized"

export interface Evidence {
  label: string
  severity: RiskLevel
  source: string
  detail?: string
}

export type ToolId =
  | "message-analyzer"
  | "url-intelligence"
  | "scam-pattern-search"
  | "behavioral-analyzer"
  | "risk-engine"
  // Real email-investigation tools (SIH26106) — see server/local-api.ts / supabase/functions/_shared/agent
  | "email_parser"
  | "header_forensics"
  | "content_analysis"
  | "url_analysis"
  | "threat_intelligence"
  | "geolocation"

export type ToolExecutionStatus = "pending" | "running" | "completed"

export interface ToolExecution {
  id: ToolId
  label: string
  status: ToolExecutionStatus
  durationMs?: number
  summary?: string
  evidence: Evidence[]
}

export type PipelineStageId =
  | "input"
  | "classification"
  | "tool-selection"
  | "evidence-collection"
  | "risk-analysis"
  | "final-assessment"
  | "case-creation"

export type PipelineStageStatus = "waiting" | "running" | "complete"

export interface PipelineStage {
  id: PipelineStageId
  label: string
  status: PipelineStageStatus
}

export interface TimelineEvent {
  label: string
  timestamp: string
  detail?: string
}

export interface TransactionFields {
  amount: string
  merchant: string
  location: string
  time: string
  device: string
}

export interface EvidenceGraphNode {
  id: string
  type: string
  label: string
  data: Record<string, unknown>
}

export interface EvidenceGraphEdge {
  from: string
  to: string
  relationship: string
}

export interface EvidenceGraph {
  nodes: EvidenceGraphNode[]
  edges: EvidenceGraphEdge[]
}

export interface FraudCase {
  id: string
  inputType: InputType
  input: string
  transactionFields?: TransactionFields
  category: FraudCategory
  riskScore: number
  riskLevel: RiskLevel
  confidence: RiskLevel
  status: CaseStatus
  toolsUsed: ToolExecution[]
  evidence: Evidence[]
  /** Only populated for real email investigations (Phase 13) — undefined for archived mock analyzers. */
  evidenceGraph?: EvidenceGraph
  explanation: string
  recommendation: string[]
  timeline: TimelineEvent[]
  createdAt: string
  assignee?: string
  savedByMe?: boolean
  watchlisted?: boolean
  /** Set only by the Send-to-NetraX ingestion flow — absent for cases created via the manual Investigate page. */
  source?: CaseSource

  /** Set only for real email investigations — NX-YYYY-MMDD-XXXXXX (see lib/case-id.ts). `id` mirrors this for email cases so routing stays a single field. */
  investigationToken?: string
  /** SHA-256 of the raw submitted email bytes — drives submission idempotency and evidence-integrity hashes. */
  emailHash?: string
  /** The exact bytes submitted (.eml/pasted) — kept for report/evidence-package export, never re-derived or reformatted. */
  rawEmailContent?: string
  /** Full parsed-email + indicators payload from the backend, kept for the forensic report/evidence package. */
  parsedEmail?: RemoteInvestigationResult["parsedEmail"]
  /** Per-source point contributions behind riskScore — only sources that actually contributed appear here. */
  riskBreakdown?: RemoteRiskAssessment["breakdown"]
  /** Full unfiltered backend findings (including info-severity) — kept for report/evidence-package export. */
  allFindings?: RemoteFinding[]
  /** Human-in-the-loop review actions recorded against this case (never auto-applied, never destructive). */
  feedback?: CaseFeedbackEntry[]
  /** Set once a forensic PDF has been generated for this case. */
  reportVersion?: string
  reportGeneratedAt?: string
  /** Set only after the demo Cyber Cell complaint flow has actually been run for this case — never pre-filled. */
  demoComplaintReference?: string
  demoComplaintGeneratedAt?: string
}

export type CaseFeedbackAction = "CONFIRM_THREAT" | "FALSE_POSITIVE" | "ESCALATE" | "NOTE"

export interface CaseFeedbackEntry {
  action: CaseFeedbackAction
  note?: string
  timestamp: string
}

export interface CaseAlert {
  id: string
  caseId: string
  severity: RiskLevel
  threatType: FraudCategory
  reason: string
  createdAt: string
}

export interface InvestigationLogEvent {
  id: string
  timestamp: string
  message: string
  kind: "info" | "tool" | "risk"
}
