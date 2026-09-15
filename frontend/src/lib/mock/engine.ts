import type {
  CaseSource,
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
import {
  investigateEmailRemote,
  investigateUrlRemote,
  type RemoteFinding,
  type RemoteInvestigationResult,
  type RemoteUrlInvestigationResult,
  type Severity as RemoteSeverity,
} from "./email-investigation-client"
import { mlPredictSms, mlPredictUrl, mlResultToEvidence } from "./ml-client"
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGE_ORDER, TOOL_LABELS } from "./tools"
import { generateCaseId, generateInvestigationToken } from "@/lib/case-id"
import { sha256Hex } from "@/lib/hash"

export interface InvestigationInput {
  type: InputType
  content: string
  transactionFields?: TransactionFields
}

export interface InvestigationHandlers {
  onStage?: (stage: PipelineStage) => void
  onTool?: (tool: ToolExecution) => void
  onEvent?: (event: InvestigationLogEvent) => void
  /** Fired once the evidence graph has been built (email path only). */
  onGraph?: (graph: RemoteInvestigationResult["evidenceGraph"]) => void
  /** Fired once the final risk score is known (email path only). */
  onRisk?: (risk: { score: number; level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" }) => void
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
      const [result, mlResult] = await Promise.all([
        Promise.resolve(analyzeMessage(input.content)),
        mlPredictSms(input.content),
      ])
      evidence = result.evidence
      cats = result.categories
      if (mlResult) {
        evidence = [...evidence, ...mlResultToEvidence(mlResult, "SMS Model")]
      }
    } else if (toolId === "url-intelligence") {
      const urls = extractUrls(input.content)
      const target = input.type === "URL" ? input.content : urls[0]
      if (target) {
        const [result, mlResult] = await Promise.all([
          Promise.resolve(analyzeUrl(target)),
          mlPredictUrl(target),
        ])
        evidence = result.evidence
        if (mlResult) {
          evidence = [...evidence, ...mlResultToEvidence(mlResult, "URL Model")]
        }
      } else {
        evidence = [{ label: "No URL found to analyze", severity: "LOW", source: "URL Intelligence" }]
      }
    } else if (toolId === "scam-pattern-search") {
      const result = scamPatternSearch(input.content)
      evidence = result.evidence
      cats = result.categories
    } else if (toolId === "behavioral-analyzer" && input.transactionFields) {
      // Stays rule-based only: the trained transaction model's V1-V28
      // features are PCA components of a private feature set that can't be
      // derived from these free-text fields (amount/merchant/location/time/
      // device) — see docs/ml/TRAINING_REPORT.md Limitations. The real
      // model is still real and evaluated (Model Performance page), just
      // not reachable from this particular input shape.
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

  await setStage("case-creation", "running", handlers)
  const contentForHash = input.type === "TRANSACTION" ? JSON.stringify(input.transactionFields) : input.content
  const contentHash = await sha256Hex(contentForHash)
  const caseId = generateCaseId()
  const investigationToken = generateInvestigationToken()
  pushTimeline("Case generated", caseId)
  await setStage("case-creation", "complete", handlers)

  const fraudCase: FraudCase = {
    id: caseId,
    investigationToken,
    emailHash: contentHash,
    inputType: input.type,
    input: input.type === "TRANSACTION" ? formatTransactionSummary(input.transactionFields) : input.content,
    transactionFields: input.transactionFields,
    category,
    riskScore: score,
    riskLevel: level,
    confidence,
    status: "INVESTIGATION_COMPLETE",
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

// --- Real email investigation (SIH26106) ---------------------------------
// Calls the actual backend (Phases 3-13: parser, forensics, URL analysis,
// threat intel, geolocation, ML content model, risk engine, evidence graph)
// via email-investigation-client.ts, then adapts the real result into the
// same FraudCase/ToolExecution/PipelineStage shapes the existing UI already
// renders — no UI rewrite needed, just a real data source.
//
// The pipeline-stage/tool reveal below is paced for a readable animation,
// not literally real-time (a real investigation can take several seconds
// across multiple network calls) — but every duration, status, and finding
// shown is the real measured value from the backend, never invented.

const REMOTE_SEVERITY_TO_RISK_LEVEL: Record<RemoteSeverity, Evidence["severity"]> = {
  info: "LOW",
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  critical: "CRITICAL",
}

function remoteFindingToEvidence(f: RemoteFinding): Evidence {
  return {
    label: f.finding,
    severity: REMOTE_SEVERITY_TO_RISK_LEVEL[f.severity],
    source: f.source,
    detail: f.explanation,
  }
}

function findingsForTool(tool: string, allFindings: RemoteFinding[]): RemoteFinding[] {
  switch (tool) {
    case "header_forensics":
      return allFindings.filter((f) =>
        ["sender_analysis", "domain_analysis", "authentication", "received_chain", "message_id", "timestamp_analysis"].includes(f.source),
      )
    case "content_analysis":
      return allFindings.filter((f) => f.source === "content_analysis" || f.id.startsWith("ml_email_model"))
    case "url_analysis":
      return allFindings.filter((f) => f.source === "url_analysis" || f.id.startsWith("ml_url_model"))
    case "threat_intelligence":
      return allFindings.filter((f) => f.source === "threat_intelligence")
    case "geolocation":
      return allFindings.filter((f) => f.source === "ip_geolocation")
    default:
      return []
  }
}

function toolSummary(record: RemoteInvestigationResult["toolLog"][number], findings: RemoteFinding[]): string {
  if (record.status === "skipped") return `Skipped — ${record.reason}`
  if (record.status === "error") return `Error — ${record.reason}`
  return findings.length > 0 ? `${findings.length} finding(s) — ${Math.round(record.durationMs)}ms` : `No findings — ${Math.round(record.durationMs)}ms`
}

export async function runEmailInvestigation(rawEmail: string, handlers: InvestigationHandlers = {}): Promise<FraudCase | null> {
  const timeline: FraudCase["timeline"] = []
  const pushTimeline = (label: string, detail?: string) => {
    timeline.push({ label, timestamp: nowTime(), detail })
  }

  for (const id of PIPELINE_STAGE_ORDER) {
    await setStage(id, "waiting", handlers)
  }

  await setStage("input", "running", handlers)
  handlers.onEvent?.(makeEvent("Investigation started for EMAIL input"))
  pushTimeline("Input received")
  await wait(200)
  await setStage("input", "complete", handlers)

  await setStage("classification", "running", handlers)
  await wait(200)
  handlers.onEvent?.(makeEvent("Agent classified input as EMAIL"))
  pushTimeline("Input classified", "EMAIL")
  await setStage("classification", "complete", handlers)

  await setStage("tool-selection", "running", handlers)
  handlers.onEvent?.(makeEvent("Submitting to the real investigation backend…"))
  const result = await investigateEmailRemote(rawEmail)
  if (!result) {
    handlers.onEvent?.(makeEvent("Investigation backend unavailable — is server/local-api.ts running on port 8787?", "info"))
    await setStage("tool-selection", "complete", handlers)
    return null
  }
  await setStage("tool-selection", "complete", handlers)
  pushTimeline("Tools selected", result.toolLog.filter((t) => t.status !== "skipped").map((t) => TOOL_LABELS[t.tool as ToolId] ?? t.tool).join(", "))

  await setStage("evidence-collection", "running", handlers)
  const toolExecutions: ToolExecution[] = []
  for (const record of result.toolLog) {
    if (record.tool === "email_parser") continue // not a user-facing tool card — it's the entry point every other tool builds on
    const toolId = record.tool as ToolId
    const findings = findingsForTool(record.tool, result.allFindings)
    handlers.onTool?.({ id: toolId, label: TOOL_LABELS[toolId] ?? record.tool, status: "running", evidence: [] })
    await wait(180)
    const execution: ToolExecution = {
      id: toolId,
      label: TOOL_LABELS[toolId] ?? record.tool,
      status: "completed",
      durationMs: Math.round(record.durationMs),
      summary: toolSummary(record, findings),
      evidence: findings.map(remoteFindingToEvidence),
    }
    toolExecutions.push(execution)
    handlers.onTool?.(execution)
    handlers.onEvent?.(makeEvent(`${execution.label} ${record.status === "skipped" ? "skipped" : "completed"} — ${execution.summary}`, "tool"))
    pushTimeline(`${execution.label} ${record.status}`, execution.summary)
  }
  handlers.onGraph?.(result.evidenceGraph)
  handlers.onEvent?.(makeEvent(`Evidence correlated — ${result.evidenceGraph.nodes.length} node(s), ${result.evidenceGraph.edges.length} relationship(s)`))
  pushTimeline("Evidence correlated", `${result.evidenceGraph.nodes.length} node(s)`)
  await setStage("evidence-collection", "complete", handlers)

  await setStage("risk-analysis", "running", handlers)
  await wait(200)
  const { score, level } = result.riskAssessment
  const confidence: Evidence["severity"] = result.allFindings.length >= 8 ? "HIGH" : result.allFindings.length >= 3 ? "MEDIUM" : "LOW"
  handlers.onRisk?.({ score, level })
  handlers.onEvent?.(makeEvent(`Risk Engine completed — ${score}/100 (${level})`, "risk"))
  pushTimeline("Risk score calculated", `${score}/100 — ${level}`)
  await setStage("risk-analysis", "complete", handlers)

  await setStage("final-assessment", "running", handlers)
  await wait(150)
  const evidence = result.allFindings.filter((f) => f.severity !== "info").map(remoteFindingToEvidence)
  // Multiple top reasons can share an identical generic explanation template (e.g. several
  // "urgency language" findings) — dedupe by text before joining so the summary doesn't repeat itself.
  const uniqueExplanations = Array.from(new Set(result.riskAssessment.topReasons.map((r) => r.explanation)))
  const explanation =
    uniqueExplanations.length > 0
      ? uniqueExplanations.slice(0, 3).join(" ")
      : "No significant risk indicators were found across header forensics, content analysis, URL analysis, threat intelligence, or geolocation checks."
  const recommendation = getRecommendations(level)
  handlers.onEvent?.(makeEvent("Explanation and recommendation generated"))
  pushTimeline("Assessment generated", `${level} risk`)
  await setStage("final-assessment", "complete", handlers)

  await setStage("case-creation", "running", handlers)
  const emailHash = await sha256Hex(rawEmail)
  const caseId = generateCaseId()
  const investigationToken = generateInvestigationToken()
  handlers.onEvent?.(makeEvent(`Case ${caseId} created — investigation token ${investigationToken}`))
  pushTimeline("Case generated", caseId)
  await setStage("case-creation", "complete", handlers)

  const fraudCase: FraudCase = {
    id: caseId,
    investigationToken,
    emailHash,
    rawEmailContent: rawEmail,
    parsedEmail: result.parsedEmail,
    riskBreakdown: result.riskAssessment.breakdown,
    allFindings: result.allFindings,
    inputType: "EMAIL",
    input: result.parsedEmail.headers.subject ?? rawEmail.slice(0, 120),
    category: inferCategory([], level),
    riskScore: score,
    riskLevel: level,
    confidence,
    status: "INVESTIGATION_COMPLETE",
    toolsUsed: toolExecutions,
    evidence,
    evidenceGraph: result.evidenceGraph,
    explanation,
    recommendation,
    timeline,
    createdAt: new Date().toISOString(),
    assignee: "You",
  }

  return fraudCase
}

// --- Real URL-only investigation (Phase 3 of the mobile-ingest build) ------
// Same treatment as runEmailInvestigation above: calls the real backend
// (url-analysis + threat-intel + risk-engine, never the archived mock URL
// analyzer in ./analyzers.ts) and adapts it into the same FraudCase shape.
// There is deliberately no parsedEmail/rawEmailContent on the resulting
// case — nothing about an email was ever submitted, and nothing here
// pretends otherwise.

function findingsForUrlTool(tool: string, allFindings: RemoteFinding[]): RemoteFinding[] {
  if (tool === "url_analysis") return allFindings.filter((f) => f.source === "url_analysis" || f.id.startsWith("ml_url_model"))
  if (tool === "threat_intelligence") return allFindings.filter((f) => f.source === "threat_intelligence")
  return []
}

export async function runUrlInvestigation(url: string, handlers: InvestigationHandlers = {}): Promise<FraudCase | null> {
  const timeline: FraudCase["timeline"] = []
  const pushTimeline = (label: string, detail?: string) => {
    timeline.push({ label, timestamp: nowTime(), detail })
  }

  for (const id of PIPELINE_STAGE_ORDER) {
    await setStage(id, "waiting", handlers)
  }

  await setStage("input", "running", handlers)
  handlers.onEvent?.(makeEvent("Investigation started for URL input"))
  pushTimeline("Input received")
  await wait(200)
  await setStage("input", "complete", handlers)

  await setStage("classification", "running", handlers)
  await wait(200)
  handlers.onEvent?.(makeEvent("Agent classified input as URL"))
  pushTimeline("Input classified", "URL")
  await setStage("classification", "complete", handlers)

  await setStage("tool-selection", "running", handlers)
  handlers.onEvent?.(makeEvent("Submitting to the real investigation backend…"))
  const result: RemoteUrlInvestigationResult | null = await investigateUrlRemote(url)
  if (!result) {
    handlers.onEvent?.(makeEvent("Investigation backend unavailable — is server/local-api.ts running on port 8787?", "info"))
    await setStage("tool-selection", "complete", handlers)
    return null
  }
  await setStage("tool-selection", "complete", handlers)
  pushTimeline("Tools selected", result.toolLog.filter((t) => t.status !== "skipped").map((t) => TOOL_LABELS[t.tool as ToolId] ?? t.tool).join(", "))

  await setStage("evidence-collection", "running", handlers)
  const toolExecutions: ToolExecution[] = []
  for (const record of result.toolLog) {
    const toolId = record.tool as ToolId
    const findings = findingsForUrlTool(record.tool, result.allFindings)
    handlers.onTool?.({ id: toolId, label: TOOL_LABELS[toolId] ?? record.tool, status: "running", evidence: [] })
    await wait(180)
    const execution: ToolExecution = {
      id: toolId,
      label: TOOL_LABELS[toolId] ?? record.tool,
      status: "completed",
      durationMs: Math.round(record.durationMs),
      summary: toolSummary(record, findings),
      evidence: findings.map(remoteFindingToEvidence),
    }
    toolExecutions.push(execution)
    handlers.onTool?.(execution)
    handlers.onEvent?.(makeEvent(`${execution.label} ${record.status === "skipped" ? "skipped" : "completed"} — ${execution.summary}`, "tool"))
    pushTimeline(`${execution.label} ${record.status}`, execution.summary)
  }
  handlers.onGraph?.(result.evidenceGraph)
  handlers.onEvent?.(makeEvent(`Evidence correlated — ${result.evidenceGraph.nodes.length} node(s), ${result.evidenceGraph.edges.length} relationship(s)`))
  pushTimeline("Evidence correlated", `${result.evidenceGraph.nodes.length} node(s)`)
  await setStage("evidence-collection", "complete", handlers)

  await setStage("risk-analysis", "running", handlers)
  await wait(200)
  const { score, level } = result.riskAssessment
  const confidence: Evidence["severity"] = result.allFindings.length >= 5 ? "HIGH" : result.allFindings.length >= 2 ? "MEDIUM" : "LOW"
  handlers.onRisk?.({ score, level })
  handlers.onEvent?.(makeEvent(`Risk Engine completed — ${score}/100 (${level})`, "risk"))
  pushTimeline("Risk score calculated", `${score}/100 — ${level}`)
  await setStage("risk-analysis", "complete", handlers)

  await setStage("final-assessment", "running", handlers)
  await wait(150)
  const evidence = result.allFindings.filter((f) => f.severity !== "info").map(remoteFindingToEvidence)
  const uniqueExplanations = Array.from(new Set(result.riskAssessment.topReasons.map((r) => r.explanation)))
  const explanation =
    uniqueExplanations.length > 0
      ? uniqueExplanations.slice(0, 3).join(" ")
      : "No significant risk indicators were found across URL structural analysis or threat intelligence checks."
  const recommendation = getRecommendations(level)
  handlers.onEvent?.(makeEvent("Explanation and recommendation generated"))
  pushTimeline("Assessment generated", `${level} risk`)
  await setStage("final-assessment", "complete", handlers)

  await setStage("case-creation", "running", handlers)
  const urlHash = await sha256Hex(url)
  const caseId = generateCaseId()
  const investigationToken = generateInvestigationToken()
  handlers.onEvent?.(makeEvent(`Case ${caseId} created — investigation token ${investigationToken}`))
  pushTimeline("Case generated", caseId)
  await setStage("case-creation", "complete", handlers)

  const fraudCase: FraudCase = {
    id: caseId,
    investigationToken,
    emailHash: urlHash,
    riskBreakdown: result.riskAssessment.breakdown,
    allFindings: result.allFindings,
    inputType: "URL",
    input: url,
    category: inferCategory([], level),
    riskScore: score,
    riskLevel: level,
    confidence,
    status: "INVESTIGATION_COMPLETE",
    toolsUsed: toolExecutions,
    evidence,
    evidenceGraph: result.evidenceGraph,
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

// --- Gmail auto-detect case building -----------------------------------
// Builds a FraudCase from an investigation the backend already ran (via
// /gmail/check-new, which calls the exact same investigateEmail()
// orchestrator runEmailInvestigation above does) — no re-investigation, and
// deliberately no paced/animated reveal: unlike the live single-email flow,
// this processes a batch that finished before the UI ever saw it, so there's
// nothing honest to animate.

export async function buildFraudCaseFromEmailResult(rawEmail: string, result: RemoteInvestigationResult, source: CaseSource): Promise<FraudCase> {
  const toolExecutions: ToolExecution[] = result.toolLog
    .filter((record) => record.tool !== "email_parser")
    .map((record) => {
      const toolId = record.tool as ToolId
      const findings = findingsForTool(record.tool, result.allFindings)
      return {
        id: toolId,
        label: TOOL_LABELS[toolId] ?? record.tool,
        status: "completed" as const,
        durationMs: Math.round(record.durationMs),
        summary: toolSummary(record, findings),
        evidence: findings.map(remoteFindingToEvidence),
      }
    })

  const timeline: FraudCase["timeline"] = result.toolLog.map((record) => ({
    label: `${TOOL_LABELS[record.tool as ToolId] ?? record.tool} ${record.status}`,
    timestamp: nowTime(),
    detail: record.status === "skipped" ? record.reason : `${Math.round(record.durationMs)}ms`,
  }))

  const { score, level } = result.riskAssessment
  const confidence: Evidence["severity"] = result.allFindings.length >= 8 ? "HIGH" : result.allFindings.length >= 3 ? "MEDIUM" : "LOW"
  const evidence = result.allFindings.filter((f) => f.severity !== "info").map(remoteFindingToEvidence)
  const uniqueExplanations = Array.from(new Set(result.riskAssessment.topReasons.map((r) => r.explanation)))
  const explanation =
    uniqueExplanations.length > 0
      ? uniqueExplanations.slice(0, 3).join(" ")
      : "No significant risk indicators were found across header forensics, content analysis, URL analysis, threat intelligence, or geolocation checks."
  const recommendation = getRecommendations(level)

  const emailHash = await sha256Hex(rawEmail)
  const caseId = generateCaseId()
  const investigationToken = generateInvestigationToken()

  return {
    id: caseId,
    investigationToken,
    emailHash,
    rawEmailContent: rawEmail,
    parsedEmail: result.parsedEmail,
    riskBreakdown: result.riskAssessment.breakdown,
    allFindings: result.allFindings,
    inputType: "EMAIL",
    input: result.parsedEmail.headers.subject ?? rawEmail.slice(0, 120),
    category: inferCategory([], level),
    riskScore: score,
    riskLevel: level,
    confidence,
    status: "INVESTIGATION_COMPLETE",
    toolsUsed: toolExecutions,
    evidence,
    evidenceGraph: result.evidenceGraph,
    explanation,
    recommendation,
    timeline,
    createdAt: new Date().toISOString(),
    assignee: "You",
    source,
  }
}
