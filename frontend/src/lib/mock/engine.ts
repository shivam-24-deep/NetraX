import type {
  Evidence,
  FraudCase,
  FraudCategory,
  InputType,
  InvestigationLogEvent,
  PipelineStage,
  PipelineStageId,
  ToolExecution,
  ToolId,
  TransactionFields,
} from "@/types/fraud"

import {
  analyzeMessage,
  analyzeTransaction,
  analyzeUrl,
  extractUrls,
  fuseRisk,
  scamPatternSearch,
} from "./analyzers"
import { generateExplanation, getRecommendations, inferCategory } from "./explain"
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGE_ORDER, TOOL_LABELS } from "./tools"

export interface InvestigationInput {
  type: InputType
  content: string
  transactionFields?: TransactionFields
}

export interface InvestigationHandlers {
  onStage?: (stage: PipelineStage) => void
  onTool?: (tool: ToolExecution) => void
  onEvent?: (event: InvestigationLogEvent) => void
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jitter(base: number, spread: number) {
  return base + Math.random() * spread
}

function nowTime() {
  return new Date().toLocaleTimeString("en-IN", { hour12: false })
}

let eventCounter = 0
function makeEvent(message: string, kind: InvestigationLogEvent["kind"] = "info"): InvestigationLogEvent {
  eventCounter += 1
  return { id: `evt_${Date.now()}_${eventCounter}`, timestamp: nowTime(), message, kind }
}

function selectTools(type: InputType, content: string): ToolId[] {
  switch (type) {
    case "TRANSACTION":
      return ["behavioral-analyzer", "risk-engine"]
    case "PHONE":
      return ["scam-pattern-search", "risk-engine"]
    case "URL":
      return ["url-intelligence", "scam-pattern-search", "risk-engine"]
    case "SMS":
    case "EMAIL":
    case "GENERAL":
    default: {
      const tools: ToolId[] = ["message-analyzer"]
      if (extractUrls(content).length > 0) tools.push("url-intelligence")
      tools.push("scam-pattern-search", "risk-engine")
      return tools
    }
  }
}

async function setStage(id: PipelineStageId, status: PipelineStage["status"], handlers: InvestigationHandlers) {
  handlers.onStage?.({ id, label: PIPELINE_STAGE_LABELS[id], status })
}

export async function runInvestigation(input: InvestigationInput, handlers: InvestigationHandlers = {}): Promise<FraudCase> {
  const timeline: FraudCase["timeline"] = []
  const pushTimeline = (label: string, detail?: string) => {
    timeline.push({ label, timestamp: nowTime(), detail })
  }

  for (const id of PIPELINE_STAGE_ORDER) {
    await setStage(id, "waiting", handlers)
  }

  // 1. input
  await setStage("input", "running", handlers)
  handlers.onEvent?.(makeEvent(`Investigation started for ${input.type} input`))
  pushTimeline("Input received")
  await wait(jitter(300, 200))
  await setStage("input", "complete", handlers)

  // 2. classification
  await setStage("classification", "running", handlers)
  await wait(jitter(350, 250))
  handlers.onEvent?.(makeEvent(`Agent classified input as ${input.type}`))
  pushTimeline("Input classified", input.type)
  await setStage("classification", "complete", handlers)

  // 3. tool selection
  await setStage("tool-selection", "running", handlers)
  const toolIds = selectTools(input.type, input.content)
  await wait(jitter(300, 200))
  handlers.onEvent?.(makeEvent(`Selected ${toolIds.length} tool(s): ${toolIds.map((t) => TOOL_LABELS[t]).join(", ")}`))
  pushTimeline("Tools selected", toolIds.map((t) => TOOL_LABELS[t]).join(", "))
  await setStage("tool-selection", "complete", handlers)

  // 4. evidence collection — run each tool
  await setStage("evidence-collection", "running", handlers)
  const allEvidence: Evidence[] = []
  const categories: FraudCategory[] = []
  const toolExecutions: ToolExecution[] = []

  for (const toolId of toolIds) {
    if (toolId === "risk-engine") continue
    handlers.onTool?.({ id: toolId, label: TOOL_LABELS[toolId], status: "running", evidence: [] })
    handlers.onEvent?.(makeEvent(`${TOOL_LABELS[toolId]} invoked`, "tool"))
    const start = performance.now()
    await wait(jitter(400, 500))

    let evidence: Evidence[] = []
    let cats: FraudCategory[] = []

    if (toolId === "message-analyzer") {
      const result = analyzeMessage(input.content)
      evidence = result.evidence
      cats = result.categories
    } else if (toolId === "url-intelligence") {
      const urls = extractUrls(input.content)
      const target = input.type === "URL" ? input.content : urls[0]
      if (target) {
        const result = analyzeUrl(target)
        evidence = result.evidence
      } else {
        evidence = [{ label: "No URL found to analyze", severity: "LOW", source: "URL Intelligence" }]
      }
    } else if (toolId === "scam-pattern-search") {
      const result = scamPatternSearch(input.content)
      evidence = result.evidence
      cats = result.categories
    } else if (toolId === "behavioral-analyzer" && input.transactionFields) {
      const result = analyzeTransaction(input.transactionFields)
      evidence = result.evidence
    }

    const durationMs = Math.round(performance.now() - start)
    allEvidence.push(...evidence)
    categories.push(...cats)

    const execution: ToolExecution = {
      id: toolId,
      label: TOOL_LABELS[toolId],
      status: "completed",
      durationMs,
      summary: `${evidence.length} evidence item(s) found`,
      evidence,
    }
    toolExecutions.push(execution)
    handlers.onTool?.(execution)
    handlers.onEvent?.(makeEvent(`${TOOL_LABELS[toolId]} completed in ${durationMs}ms — ${evidence.length} finding(s)`, "tool"))
    pushTimeline(`${TOOL_LABELS[toolId]} completed`, execution.summary)
  }
  await setStage("evidence-collection", "complete", handlers)

  // 5. risk analysis
  await setStage("risk-analysis", "running", handlers)
  handlers.onTool?.({ id: "risk-engine", label: TOOL_LABELS["risk-engine"], status: "running", evidence: [] })
  const riskStart = performance.now()
  await wait(jitter(350, 300))
  const { score, level, confidence } = fuseRisk(allEvidence)
  const riskDuration = Math.round(performance.now() - riskStart)
  const riskExecution: ToolExecution = {
    id: "risk-engine",
    label: TOOL_LABELS["risk-engine"],
    status: "completed",
    durationMs: riskDuration,
    summary: `Fused ${allEvidence.length} evidence item(s) into a risk score`,
    evidence: [],
  }
  toolExecutions.push(riskExecution)
  handlers.onTool?.(riskExecution)
  handlers.onEvent?.(makeEvent(`Risk Engine completed — ${score}% (${level} RISK)`, "risk"))
  pushTimeline("Risk score calculated", `${score}% — ${level} RISK`)
  await setStage("risk-analysis", "complete", handlers)

  // 6. final assessment
  await setStage("final-assessment", "running", handlers)
  await wait(jitter(300, 200))
  const category = inferCategory(categories, level)
  const explanation = generateExplanation(level, allEvidence, categories)
  const recommendation = getRecommendations(level)
  handlers.onEvent?.(makeEvent("Explanation and recommendation generated"))
  pushTimeline("Assessment generated", `${level} risk — ${category}`)
  await setStage("final-assessment", "complete", handlers)

  const fraudCase: FraudCase = {
    id: `case_${Date.now().toString(36)}`,
    inputType: input.type,
    input: input.type === "TRANSACTION" ? formatTransactionSummary(input.transactionFields) : input.content,
    transactionFields: input.transactionFields,
    category,
    riskScore: score,
    riskLevel: level,
    confidence,
    status: "OPEN",
    toolsUsed: toolExecutions,
    evidence: allEvidence,
    explanation,
    recommendation,
    timeline,
    createdAt: new Date().toISOString(),
    assignee: "You",
  }

  return fraudCase
}

function formatTransactionSummary(fields?: TransactionFields): string {
  if (!fields) return "Transaction"
  return `₹${fields.amount || "0"} at ${fields.merchant || "unknown merchant"}, ${fields.location || "unknown location"}, ${fields.time || "unknown time"}`
}
