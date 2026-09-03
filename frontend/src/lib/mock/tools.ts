import { Activity, Gauge, Link2, MessageSquare, Search } from "lucide-react"

import type { PipelineStageId, ToolId } from "@/types/fraud"

export const TOOL_LABELS: Record<ToolId, string> = {
  "message-analyzer": "Message Analyzer",
  "url-intelligence": "URL Intelligence",
  "scam-pattern-search": "Scam Pattern Search",
  "behavioral-analyzer": "Behavioral Analyzer",
  "risk-engine": "Risk Engine",
}

export const PIPELINE_STAGE_LABELS: Record<PipelineStageId, string> = {
  input: "Input received",
  classification: "Input classified",
  "tool-selection": "Tools selected",
  "evidence-collection": "Evidence collection",
  "risk-analysis": "Risk analysis",
  "final-assessment": "Final assessment generated",
}

export const PIPELINE_STAGE_ORDER: PipelineStageId[] = [
  "input",
  "classification",
  "tool-selection",
  "evidence-collection",
  "risk-analysis",
  "final-assessment",
]

export const AGENT_STAGE_LABELS = ["UNDERSTANDING", "ANALYZING", "VERIFYING", "CORRELATING", "SCORING"] as const

export const TOOL_ICONS: Record<ToolId, typeof MessageSquare> = {
  "message-analyzer": MessageSquare,
  "url-intelligence": Link2,
  "scam-pattern-search": Search,
  "behavioral-analyzer": Activity,
  "risk-engine": Gauge,
}
