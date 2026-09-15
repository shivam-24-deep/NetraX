// Phase 10 — Agentic investigation workflow types.
//
// The agent's job is dynamic TOOL SELECTION and auditable execution — it
// never invents evidence itself (Rule 8). Every tool call or skip is logged
// so the Investigation Control Room UI (Phase 17) can show a full, honest
// trace: "Email had no URLs, so URL/threat-intel tools were not run" is
// itself a legitimate, displayable investigation event.

import type { Finding } from "../email/evidence.ts";
import type { ParsedEmail } from "../email/types.ts";
import type { EmailForensicsReport } from "../email/forensics/types.ts";
import type { FullUrlAnalysisResult } from "../url-analysis/index.ts";
import type { ThreatIntelLookupResult } from "../threat-intel/types.ts";
import type { GeolocatedIp } from "../geolocation/index.ts";
import type { RiskAssessment } from "../risk-engine/index.ts";
import type { EvidenceGraph } from "../evidence-graph/types.ts";

export type ToolName =
  | "email_parser"
  | "header_forensics"
  | "content_analysis"
  | "url_analysis"
  | "threat_intelligence"
  | "geolocation";

export interface ToolExecutionRecord {
  tool: ToolName;
  status: "success" | "skipped" | "error";
  /** Why a tool was skipped (e.g. "no URLs found in email") or what failed. */
  reason?: string;
  startedAt: string;
  durationMs: number;
  findingCount: number;
}

export interface InvestigationResult {
  parsedEmail: ParsedEmail;
  forensicsReport: EmailForensicsReport;
  urlAnalyses: FullUrlAnalysisResult[];
  threatIntelResults: ThreatIntelLookupResult[];
  geolocationResults: GeolocatedIp[];
  contentFindings: Finding[];
  /** Every Finding from every source, normalized — this is what the risk engine below consumes. */
  allFindings: Finding[];
  riskAssessment: RiskAssessment;
  evidenceGraph: EvidenceGraph;
  toolLog: ToolExecutionRecord[];
}

/**
 * URL-only investigation (no email to anchor the evidence graph on) — real
 * findings from the same url-analysis/threat-intel/risk-engine modules
 * investigateEmail uses, never the archived mock URL analyzer. See
 * investigate-url.ts.
 */
export interface UrlInvestigationResult {
  url: string;
  urlAnalysis: FullUrlAnalysisResult;
  threatIntelResults: ThreatIntelLookupResult[];
  allFindings: Finding[];
  riskAssessment: RiskAssessment;
  evidenceGraph: EvidenceGraph;
  toolLog: ToolExecutionRecord[];
}
