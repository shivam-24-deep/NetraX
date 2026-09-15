export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

export type InputType = "SMS" | "EMAIL" | "URL" | "PHONE" | "TRANSACTION" | "GENERAL"

export type CaseStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "FALSE_POSITIVE"

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
}

export interface InvestigationLogEvent {
  id: string
  timestamp: string
  message: string
  kind: "info" | "tool" | "risk"
}
