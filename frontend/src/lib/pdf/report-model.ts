// Consolidates one case's real data into a single typed model the PDF
// document renders from. Built once (async, since evidence hashing uses
// Web Crypto) so the report, preview, and downstream ZIP/complaint package
// all read the exact same numbers (SIH26106 §38 data-consistency rule).
//
// Nothing here invents data. Fields that can't be derived from real case
// data are explicitly "Not available" / "NOT AVAILABLE" with a stated
// reason, never silently blank and never guessed.

import { sha256Hex } from "@/lib/hash"
import { buildArtifacts, buildHeadersText, buildIndicatorsJson, buildInfrastructureJson, buildThreatIntelJson } from "@/lib/mock/report-data"
import { TOOL_LABELS } from "@/lib/mock/tools"
import type { CaseFeedbackEntry, EvidenceGraph, FraudCase, InputType, RiskLevel, TimelineEvent, ToolId, TransactionFields } from "@/types/fraud"

const NOT_AVAILABLE = "Not available in submitted email."

export interface ArtifactHash {
  name: string
  sha256: string
  sizeBytes: number
}

export interface FindingRow {
  finding: string
  severity: string
  evidence: string
  source: string
  confidence: string
  explanation: string
}

export interface RankedFinding extends FindingRow {
  rank: number
  impact: string
  recommendation: string
}

export interface HeaderField {
  label: string
  value: string
  source: string
  status: "Present" | "Missing" | "Not Applicable"
}

export interface UrlDetail {
  url: string
  hostname: string
  domain: string
  protocol: string
  path: string
  query: string
  length: number
  https: boolean
  ipBasedHostname: boolean
  hasAtSymbol: boolean
  punycode: boolean
  subdomainCount: number
  shortener: boolean
  characteristics: { label: string; detected: boolean }[]
}

export interface DomainIntel {
  domain: string
  tld: string
  subdomainCount: number
  https: string
  registrar: string
  age: string
  reputation: string
}

export interface EvidenceInventoryRow {
  id: string
  type: string
  value: string
  source: string
  severity: string
  confidence: string
  timestamp: string
}

export interface ToolAuditRow {
  tool: string
  executed: boolean
  status: string
  reason: string
  result: string
}

export interface InvestigationScopeRow {
  module: string
  executed: boolean
  reason: string
}

export interface RecommendationGroup {
  category: "IMMEDIATE" | "INVESTIGATIVE" | "CONTAINMENT" | "FOLLOW-UP"
  items: string[]
}

export interface AtAGlance {
  sender: string
  domain: string
  urlCount: number
  ipCount: number
  threatIntelMatches: number
  findingCount: number
  evidenceCount: number
}

export interface ReportModel {
  investigationType: InputType
  caseId: string
  investigationToken: string
  riskScore: number
  riskLevel: RiskLevel
  confidence: string
  threatType: string
  status: string
  createdAt: string
  generatedAt: string
  reportVersion: string

  emailFormat: string
  parsingNote: string

  atAGlance: AtAGlance

  executiveAssessment: string
  topFindings: RankedFinding[]
  investigationScope: InvestigationScopeRow[]

  emailFields: HeaderField[]
  senderDisplayName: string
  senderAddress: string
  senderDomain: string
  replyToDomain: string
  returnPathDomain: string
  identityConsistency: "Consistent" | "Suspicious" | "Mismatch" | "Not Available"
  identityMismatchDetail: string
  identityFindings: FindingRow[]
  bodySummary: string

  authRows: { mechanism: string; result: string; evidence: string; alignment: string; interpretation: string; confidence: string }[]
  receivedChain: { hop: number; sourceIp: string; raw: string }[]
  headerFindings: FindingRow[]
  rawHeaderBlock: string

  contentFindings: FindingRow[]
  mlContent: { model: string; prediction: string; source: string } | null

  urls: UrlDetail[]
  urlFindings: FindingRow[]
  domainIntelligence: DomainIntel[]

  threatIntelFindings: FindingRow[]

  infraNodes: { ip: string; asn: string; organization: string; country: string }[]
  infraFindings: FindingRow[]

  evidenceGraph?: EvidenceGraph
  evidenceInventory: EvidenceInventoryRow[]

  riskBreakdown: { source: string; points: number }[]
  riskInterpretation: string

  timeline: TimelineEvent[]
  toolAudit: ToolAuditRow[]

  recommendationGroups: RecommendationGroup[]

  artifactHashes: ArtifactHash[]

  feedback: CaseFeedbackEntry[]

  demoComplaintReference?: string
  demoComplaintGeneratedAt?: string

  appendixRawHeaders: string
  appendixUrls: string[]
  appendixIndicatorsJson: string
  appendixThreatIntelJson: string
  appendixInfrastructureJson: string
  appendixEventLog: TimelineEvent[]
  appendixManifestJson: string

  // Populated only for non-EMAIL investigation types (URL / MESSAGE / TRANSACTION).
  genericInputLabel: string
  genericInputValue: string
  genericFindings: FindingRow[]
  transactionFields?: TransactionFields
}

function str(v: unknown): string {
  if (v === undefined || v === null) return NOT_AVAILABLE
  if (Array.isArray(v)) return v.length > 0 ? v.join(", ") : NOT_AVAILABLE
  const s = String(v).trim()
  return s === "" ? NOT_AVAILABLE : s
}

function displayNameFromAddress(from: string | undefined): { name: string; address: string } {
  if (!from) return { name: NOT_AVAILABLE, address: NOT_AVAILABLE }
  const match = from.match(/^"?([^"<]*)"?\s*<([^>]+)>$/)
  if (match) return { name: match[1].trim() || NOT_AVAILABLE, address: match[2].trim() }
  return { name: NOT_AVAILABLE, address: from.trim() }
}

function domainOf(address: string): string {
  if (address === NOT_AVAILABLE) return NOT_AVAILABLE
  const at = address.lastIndexOf("@")
  return at === -1 ? NOT_AVAILABLE : address.slice(at + 1).toLowerCase()
}

const SOURCE_LABEL: Record<string, string> = {
  sender_analysis: "Sender Analysis",
  domain_analysis: "Domain Analysis",
  authentication: "Authentication",
  received_chain: "Received Chain",
  timestamp_analysis: "Timestamp Analysis",
  message_id: "Message-ID Analysis",
  content_analysis: "Content Analysis",
  url_analysis: "URL Analysis",
  threat_intelligence: "Threat Intelligence",
  ip_geolocation: "IP Geolocation",
  ml_model: "NetraX ML Model",
}

function humanSource(source: string): string {
  return SOURCE_LABEL[source] ?? source.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function toFindingRow(f: { finding: string; severity: string; evidence: string; source: string; confidence: string; explanation: string }): FindingRow {
  return { finding: f.finding, severity: f.severity.toUpperCase(), evidence: f.evidence, source: humanSource(f.source), confidence: f.confidence.toUpperCase(), explanation: f.explanation }
}

function nextReportVersion(current: string | undefined): string {
  if (!current) return "1.0"
  const match = current.match(/^(\d+)\.(\d+)$/)
  if (!match) return "1.0"
  return `${match[1]}.${Number(match[2]) + 1}`
}

/** One line explaining what format this submission was actually parsed as, and why headers may be sparse. */
function buildParsingNote(format: string, warnings: string[]): string {
  if (format === "eml") {
    return warnings.length > 0
      ? `Parsed as a raw email (.eml/MIME). Parser notes: ${warnings.join(" ")}`
      : "Parsed as a raw email (.eml/MIME) — header fields below come from the actual RFC headers of the submitted message."
  }
  if (format === "json") {
    return "Submitted as structured metadata (not a raw .eml) — header fields below reflect only the fields actually included in that submission."
  }
  return warnings.length > 0
    ? `This submission was NOT recognized as a raw RFC822 email and was treated as plain text. ${warnings.join(" ")} Any "From:"/"To:"/"Date:"-looking lines below are part of the message BODY, not verified headers — they are shown only in the Body Summary, never promoted to the header table.`
    : "This submission was treated as plain text (no email header block detected)."
}

function headerField(label: string, value: string | string[] | undefined, format: string): HeaderField {
  const text = Array.isArray(value) ? (value.length > 0 ? value.join(", ") : undefined) : value
  if (text && text.trim() !== "") {
    return { label, value: text, source: format === "eml" ? "RFC Header (parsed from raw email)" : "Submitted email metadata", status: "Present" }
  }
  if (format !== "eml" && format !== "json") {
    return { label, value: "Not available — no header block detected in this submission", source: "N/A — plain text submission", status: "Not Applicable" }
  }
  return { label, value: NOT_AVAILABLE, source: "Submitted email", status: "Missing" }
}

const KNOWN_SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly"])

function analyzeUrl(url: string): UrlDetail {
  let hostname = NOT_AVAILABLE
  let protocol = NOT_AVAILABLE
  let path = ""
  let query = ""
  let https = false
  let ipBasedHostname = false
  let punycode = false
  let subdomainCount = 0
  try {
    const parsed = new URL(url)
    hostname = parsed.hostname
    protocol = parsed.protocol.replace(":", "")
    path = parsed.pathname
    query = parsed.search
    https = parsed.protocol === "https:"
    ipBasedHostname = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":")
    punycode = hostname.includes("xn--")
    subdomainCount = Math.max(0, hostname.split(".").length - 2)
  } catch {
    // leave defaults — this URL couldn't be parsed structurally, characteristics below reflect that honestly
  }
  const shortener = hostname !== NOT_AVAILABLE && KNOWN_SHORTENERS.has(hostname.toLowerCase())
  const hasAtSymbol = url.includes("@")

  const characteristics = [
    { label: "IP-based hostname instead of a domain name", detected: ipBasedHostname },
    { label: "Contains an @ symbol (potential credential-in-URL trick)", detected: hasAtSymbol },
    { label: "Does not use HTTPS", detected: !https && hostname !== NOT_AVAILABLE },
    { label: "Uses Punycode (xn--) encoding", detected: punycode },
    { label: "Known URL-shortener domain", detected: shortener },
    { label: "Unusually long URL (>90 characters)", detected: url.length > 90 },
    { label: "Multiple subdomains (3+)", detected: subdomainCount >= 3 },
  ].filter((c) => c.detected)

  return {
    url,
    hostname,
    domain: hostname,
    protocol,
    path: path || "/",
    query: query || NOT_AVAILABLE,
    length: url.length,
    https,
    ipBasedHostname,
    hasAtSymbol,
    punycode,
    subdomainCount,
    shortener,
    characteristics,
  }
}

const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/

function domainIntelFor(domain: string): DomainIntel {
  if (IPV4_PATTERN.test(domain)) {
    return { domain, tld: "N/A — IP address", subdomainCount: 0, https: "NOT AVAILABLE", registrar: "N/A — IP address, not a domain", age: "NOT AVAILABLE", reputation: "NOT AVAILABLE" }
  }
  const parts = domain.split(".")
  const tld = parts.length > 1 ? parts[parts.length - 1] : "NOT AVAILABLE"
  return {
    domain,
    tld,
    subdomainCount: Math.max(0, parts.length - 2),
    https: "NOT AVAILABLE",
    registrar: "NOT AVAILABLE",
    age: "NOT AVAILABLE",
    reputation: "NOT AVAILABLE",
  }
}

function checkIdentityConsistency(
  senderDomain: string,
  replyToDomain: string,
  returnPathDomain: string,
): { consistency: ReportModel["identityConsistency"]; detail: string } {
  const known = [senderDomain, replyToDomain, returnPathDomain].filter((d) => d !== NOT_AVAILABLE)
  if (known.length <= 1) return { consistency: "Not Available", detail: "Not enough header data present to compare domains." }
  const unique = new Set(known)
  if (unique.size === 1) return { consistency: "Consistent", detail: "Sender, Reply-To, and Return-Path domains all match." }
  const diffs: string[] = []
  if (replyToDomain !== NOT_AVAILABLE && replyToDomain !== senderDomain) diffs.push(`Reply-To (${replyToDomain}) differs from From (${senderDomain})`)
  if (returnPathDomain !== NOT_AVAILABLE && returnPathDomain !== senderDomain) diffs.push(`Return-Path (${returnPathDomain}) differs from From (${senderDomain})`)
  return { consistency: "Mismatch", detail: diffs.join("; ") }
}

const RECOMMENDATION_CATEGORY: { pattern: RegExp; category: RecommendationGroup["category"] }[] = [
  { pattern: /preserve|do not (act|click|reply|share|download)/i, category: "IMMEDIATE" },
  { pattern: /escalate|block|report the message/i, category: "CONTAINMENT" },
  { pattern: /verify|confirm|contact the organization/i, category: "INVESTIGATIVE" },
  { pattern: /monitor|cybercrime\.gov\.in|follow.?up/i, category: "FOLLOW-UP" },
]

function categorizeRecommendations(recs: string[]): RecommendationGroup[] {
  const buckets = new Map<RecommendationGroup["category"], string[]>()
  for (const rec of recs) {
    const match = RECOMMENDATION_CATEGORY.find((c) => c.pattern.test(rec))
    const category = match?.category ?? "INVESTIGATIVE"
    if (!buckets.has(category)) buckets.set(category, [])
    buckets.get(category)!.push(rec)
  }
  const order: RecommendationGroup["category"][] = ["IMMEDIATE", "CONTAINMENT", "INVESTIGATIVE", "FOLLOW-UP"]
  return order.filter((c) => buckets.has(c)).map((category) => ({ category, items: buckets.get(category)! }))
}

function impactAndRecommendationFor(source: string, severity: string): { impact: string; recommendation: string } {
  const s = severity.toLowerCase()
  const table: Record<string, { impact: string; recommendation: string }> = {
    sender_analysis: { impact: "Indicates the visible sender identity may not be trustworthy, increasing the chance of impersonation.", recommendation: "Verify the sender through a separate, known-good channel before acting on this message." },
    domain_analysis: { impact: "A suspicious or lookalike domain increases the likelihood this message originates from outside the claimed organization.", recommendation: "Do not treat this domain as equivalent to the legitimate organization's domain." },
    authentication: { impact: "Authentication results affect how much the receiving mail system trusts the sender's claimed domain.", recommendation: "Treat authentication failures as a strong signal; treat missing results as inconclusive, not exculpatory." },
    received_chain: { impact: "Relay-path anomalies can indicate the message was routed through unexpected infrastructure.", recommendation: "Cross-reference the relay path with the organization's known mail infrastructure." },
    timestamp_analysis: { impact: "Clock-skew or relay-delay anomalies can indicate header manipulation or unusual routing.", recommendation: "Treat as corroborating evidence alongside other findings, not conclusive alone." },
    message_id: { impact: "An unusual Message-ID can indicate the message did not originate from a standard mail client.", recommendation: "Weigh alongside stronger signals — this alone is weak evidence." },
    content_analysis: { impact: "Language patterns associated with social engineering increase the likelihood of a manipulation attempt.", recommendation: "Do not act on urgency or financial requests in this message without independent verification." },
    url_analysis: { impact: "Structural URL characteristics associated with phishing/malware distribution increase risk if the link is followed.", recommendation: "Do not click the flagged URL(s); do not enter credentials on any page they lead to." },
    threat_intelligence: { impact: "A confirmed match against known-malicious infrastructure significantly increases confidence this is a real threat.", recommendation: "Treat matched indicators as confirmed malicious; block/report them through your organization's process." },
    ip_geolocation: { impact: "Infrastructure location can add context but does not by itself establish intent or identity.", recommendation: "Use only as corroborating context alongside stronger findings." },
    ml_model: { impact: "A trained-model prediction adds a data-driven signal alongside the rule-based findings above.", recommendation: "Weigh alongside rule-based findings — do not treat a single model score as conclusive on its own." },
    behavior: { impact: "A deviation from the account's usual transaction pattern increases the likelihood this transaction was not authorized by the account holder.", recommendation: "Verify the transaction directly with the account holder before treating it as legitimate." },
    scam_pattern: { impact: "Matches a known scam communication pattern, increasing confidence this is a deliberate fraud attempt rather than an isolated red flag.", recommendation: "Treat as a known scam pattern; do not respond to or act on the request." },
  }
  const entry = table[source] ?? { impact: "Contributes to the overall risk assessment for this message.", recommendation: "Review alongside the other findings in this report before deciding on action." }
  if (s === "info") return { impact: "Informational — does not by itself indicate risk.", recommendation: "No action required based on this finding alone." }
  return entry
}

export async function buildReportModel(fraudCase: FraudCase): Promise<ReportModel> {
  if (fraudCase.inputType !== "EMAIL") return buildGenericReportModel(fraudCase)
  return buildEmailReportModel(fraudCase)
}

async function buildEmailReportModel(fraudCase: FraudCase): Promise<ReportModel> {
  const findings = fraudCase.allFindings ?? []
  const h = fraudCase.parsedEmail?.headers
  const format = fraudCase.parsedEmail?.format ?? "unknown"
  const warnings = fraudCase.parsedEmail?.warnings ?? []
  const parsingNote = buildParsingNote(format, warnings)

  const { name: senderDisplayName, address: senderAddress } = displayNameFromAddress(h?.from as string | undefined)
  const senderDomain = senderAddress !== NOT_AVAILABLE ? domainOf(senderAddress) : NOT_AVAILABLE
  const replyToDomain = h?.["replyTo"] ? domainOf(String(h["replyTo"])) : NOT_AVAILABLE
  const returnPathDomain = h?.["returnPath"] ? domainOf(String(h["returnPath"])) : NOT_AVAILABLE
  const { consistency: identityConsistency, detail: identityMismatchDetail } = checkIdentityConsistency(senderDomain, replyToDomain, returnPathDomain)

  const emailFields: HeaderField[] = [
    headerField("From", h?.from as string | undefined, format),
    headerField("Display Name", senderDisplayName !== NOT_AVAILABLE ? senderDisplayName : undefined, format),
    headerField("To", h?.["to"] as string[] | undefined, format),
    headerField("Cc", h?.["cc"] as string[] | undefined, format),
    headerField("Bcc", h?.["bcc"] as string[] | undefined, format),
    headerField("Reply-To", h?.["replyTo"] as string | undefined, format),
    headerField("Return-Path", h?.["returnPath"] as string | undefined, format),
    headerField("Subject", h?.subject, format),
    headerField("Date", h?.["date"] as string | undefined, format),
    headerField("Message-ID", h?.["messageId"] as string | undefined, format),
    headerField("MIME-Version", h?.["mimeVersion"] as string | undefined, format),
    headerField("Content-Type", h?.["contentType"] as string | undefined, format),
    headerField("Mailer / User-Agent", (h?.["xMailer"] as string | undefined) ?? (h?.["userAgent"] as string | undefined), format),
  ]

  const receivedRaw = ((h?.["received"] as string[] | undefined) ?? []).slice().reverse()
  const receivedChain = receivedRaw.map((raw, i) => ({
    hop: i + 1,
    sourceIp: raw.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/)?.[1] ?? "—",
    raw,
  }))

  const spf = str(h?.spf).toUpperCase()
  const dkim = str(h?.dkim).toUpperCase()
  const dmarc = str(h?.dmarc).toUpperCase()
  const authRows = [
    { mechanism: "SPF", result: spf, evidence: spf === NOT_AVAILABLE.toUpperCase() ? "No SPF result in Authentication-Results" : spf, alignment: "N/A", interpretation: interpretAuth("SPF", spf), confidence: spf === NOT_AVAILABLE.toUpperCase() ? "N/A" : "HIGH" },
    { mechanism: "DKIM", result: dkim, evidence: dkim === NOT_AVAILABLE.toUpperCase() ? "No DKIM result in Authentication-Results" : dkim, alignment: "N/A", interpretation: interpretAuth("DKIM", dkim), confidence: dkim === NOT_AVAILABLE.toUpperCase() ? "N/A" : "HIGH" },
    { mechanism: "DMARC", result: dmarc, evidence: dmarc === NOT_AVAILABLE.toUpperCase() ? "No DMARC result in Authentication-Results" : dmarc, alignment: "N/A", interpretation: interpretAuth("DMARC", dmarc), confidence: dmarc === NOT_AVAILABLE.toUpperCase() ? "N/A" : "HIGH" },
  ]

  const urls = (fraudCase.parsedEmail?.indicators.urls ?? []).map(analyzeUrl)
  const domainsToProfile = new Set<string>([...(senderDomain !== NOT_AVAILABLE ? [senderDomain] : []), ...urls.map((u) => u.domain).filter((d) => d !== NOT_AVAILABLE)])
  const domainIntelligence = Array.from(domainsToProfile).map(domainIntelFor)

  const infraNodes = (fraudCase.evidenceGraph?.nodes ?? [])
    .filter((n) => n.type === "ip")
    .map((ipNode) => {
      const asnNode = fraudCase.evidenceGraph?.nodes.find((n) => n.type === "asn" && fraudCase.evidenceGraph?.edges.some((e) => e.from === ipNode.id && e.to === n.id))
      const countryNode = asnNode
        ? fraudCase.evidenceGraph?.nodes.find((n) => n.type === "country" && fraudCase.evidenceGraph?.edges.some((e) => e.from === asnNode.id && e.to === n.id))
        : fraudCase.evidenceGraph?.nodes.find((n) => n.type === "country" && fraudCase.evidenceGraph?.edges.some((e) => e.from === ipNode.id && e.to === n.id))
      return {
        ip: String(ipNode.data.ip ?? ipNode.label),
        asn: asnNode ? String(asnNode.data.asn ?? "NOT AVAILABLE") : "NOT AVAILABLE",
        organization: asnNode ? String(asnNode.data.organization ?? "NOT AVAILABLE") : "NOT AVAILABLE",
        country: countryNode ? String(countryNode.data.country ?? "NOT AVAILABLE") : "NOT AVAILABLE",
      }
    })

  // Evidence inventory: attribute each finding's timestamp to the timeline entry of the tool that produced it.
  const toolForSource: Record<string, ToolId> = {
    sender_analysis: "header_forensics",
    domain_analysis: "header_forensics",
    authentication: "header_forensics",
    received_chain: "header_forensics",
    timestamp_analysis: "header_forensics",
    message_id: "header_forensics",
    content_analysis: "content_analysis",
    url_analysis: "url_analysis",
    threat_intelligence: "threat_intelligence",
    ip_geolocation: "geolocation",
  }
  const timelineByLabel = new Map(fraudCase.timeline.map((t) => [t.label, t.timestamp]))
  const evidenceInventory: EvidenceInventoryRow[] = findings
    .filter((f) => f.severity !== "info")
    .map((f, i) => {
      // ml_model findings are tagged with the tool that actually produced them via id prefix, not `source`.
      const toolId = f.id.startsWith("ml_email_model") ? "content_analysis" : f.id.startsWith("ml_url_model") ? "url_analysis" : toolForSource[f.source]
      const toolLabel = toolId ? TOOL_LABELS[toolId] : undefined
      const timestamp = (toolLabel && (timelineByLabel.get(`${toolLabel} success`) ?? timelineByLabel.get(`${toolLabel} skipped`))) || new Date(fraudCase.createdAt).toLocaleTimeString()
      return {
        id: `EV-${String(i + 1).padStart(3, "0")}`,
        type: f.source.replaceAll("_", " ").toUpperCase(),
        value: f.finding,
        source: TOOL_LABELS[toolId] ?? f.source,
        severity: f.severity.toUpperCase(),
        confidence: f.confidence.toUpperCase(),
        timestamp,
      }
    })

  const toolAudit: ToolAuditRow[] = fraudCase.toolsUsed
    .filter((t) => t.id !== "risk-engine")
    .map((t) => {
      const summary = t.summary ?? ""
      const skipped = summary.startsWith("Skipped")
      const errored = summary.startsWith("Error")
      const executed = !skipped && !errored
      return {
        tool: t.label,
        executed,
        status: skipped ? "SKIPPED" : errored ? "ERROR" : "SUCCESS",
        reason: skipped || errored ? summary.replace(/^(Skipped|Error)\s*—\s*/, "") : "—",
        result: executed ? summary : "—",
      }
    })

  const investigationScope: InvestigationScopeRow[] = toolAudit.map((t) => ({ module: t.tool, executed: t.executed, reason: t.executed ? "" : t.reason }))

  const rankedFindingSource = findings.filter((f) => f.severity !== "info")
  const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 }
  const topFindings: RankedFinding[] = [...rankedFindingSource]
    .sort((a, b) => (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0))
    .slice(0, 5)
    .map((f, i) => {
      const { impact, recommendation } = impactAndRecommendationFor(f.source, f.severity)
      return { rank: i + 1, ...toFindingRow(f), impact, recommendation }
    })

  const contentModelFinding = findings.find((f) => f.id.startsWith("ml_email_model") || f.id.startsWith("ml_url_model"))
  const mlContent = contentModelFinding
    ? { model: contentModelFinding.evidence.split(":")[0] ?? "NetraX ML Model", prediction: contentModelFinding.finding, source: "Email body text" }
    : null

  const artifacts = buildArtifacts(fraudCase)
  const artifactHashes: ArtifactHash[] = await Promise.all(
    artifacts.map(async (a) => ({ name: a.name, sha256: await sha256Hex(a.content), sizeBytes: new TextEncoder().encode(a.content).length })),
  )

  const threatIntelFindingsAll = findings.filter((f) => f.source === "threat_intelligence")
  const threatIntelMatches = threatIntelFindingsAll.filter((f) => f.severity !== "info" && /match/i.test(f.finding) && !/no match|unavailable/i.test(f.finding)).length

  const atAGlance: AtAGlance = {
    sender: senderAddress,
    domain: senderDomain,
    urlCount: urls.length,
    ipCount: infraNodes.length,
    threatIntelMatches,
    findingCount: rankedFindingSource.length,
    evidenceCount: evidenceInventory.length,
  }

  return {
    investigationType: "EMAIL",
    caseId: fraudCase.id,
    investigationToken: fraudCase.investigationToken ?? NOT_AVAILABLE,
    riskScore: fraudCase.riskScore,
    riskLevel: fraudCase.riskLevel,
    confidence: fraudCase.confidence,
    threatType: fraudCase.category,
    status: fraudCase.status,
    createdAt: fraudCase.createdAt,
    generatedAt: new Date().toISOString(),
    reportVersion: nextReportVersion(fraudCase.reportVersion),

    emailFormat: format,
    parsingNote,

    atAGlance,

    executiveAssessment: fraudCase.explanation,
    topFindings,
    investigationScope,

    emailFields,
    senderDisplayName,
    senderAddress,
    senderDomain,
    replyToDomain,
    returnPathDomain,
    identityConsistency,
    identityMismatchDetail,
    identityFindings: findings.filter((f) => ["sender_analysis", "domain_analysis"].includes(f.source)).map(toFindingRow),
    bodySummary: (fraudCase.parsedEmail?.body.text || fraudCase.parsedEmail?.body.htmlAsText || "").slice(0, 1200) || NOT_AVAILABLE,

    authRows,
    receivedChain,
    headerFindings: findings.filter((f) => ["authentication", "received_chain", "timestamp_analysis", "message_id"].includes(f.source)).map(toFindingRow),
    rawHeaderBlock: buildHeadersText(fraudCase),

    contentFindings: findings.filter((f) => f.source === "content_analysis").map(toFindingRow),
    mlContent,

    urls,
    urlFindings: findings.filter((f) => f.source === "url_analysis" || f.id.startsWith("ml_url_model")).map(toFindingRow),
    domainIntelligence,

    threatIntelFindings: threatIntelFindingsAll.map(toFindingRow),

    infraNodes,
    infraFindings: findings.filter((f) => f.source === "ip_geolocation").map(toFindingRow),

    evidenceGraph: fraudCase.evidenceGraph,
    evidenceInventory,

    riskBreakdown: (fraudCase.riskBreakdown ?? []).filter((b) => b.cappedPoints > 0).map((b) => ({ source: b.source.replaceAll("_", " "), points: b.cappedPoints })),
    riskInterpretation: fraudCase.explanation,

    timeline: fraudCase.timeline,
    toolAudit,

    recommendationGroups: categorizeRecommendations(fraudCase.recommendation),

    artifactHashes,

    feedback: fraudCase.feedback ?? [],

    demoComplaintReference: fraudCase.demoComplaintReference,
    demoComplaintGeneratedAt: fraudCase.demoComplaintGeneratedAt,

    appendixRawHeaders: buildHeadersText(fraudCase),
    appendixUrls: fraudCase.parsedEmail?.indicators.urls ?? [],
    appendixIndicatorsJson: buildIndicatorsJson(fraudCase),
    appendixThreatIntelJson: buildThreatIntelJson(fraudCase),
    appendixInfrastructureJson: buildInfrastructureJson(fraudCase),
    appendixEventLog: fraudCase.timeline,
    appendixManifestJson: JSON.stringify(
      { case_id: fraudCase.id, investigation_token: fraudCase.investigationToken, artifacts: artifactHashes.map((a) => ({ name: a.name, sha256: a.sha256, size_bytes: a.sizeBytes })) },
      null,
      2,
    ),

    genericInputLabel: "N/A",
    genericInputValue: "N/A",
    genericFindings: [],
  }
}

const GENERIC_INPUT_LABEL: Record<string, string> = {
  URL: "Submitted URL",
  SMS: "Submitted Message",
  MESSAGE: "Submitted Message",
  TRANSACTION: "Submitted Transaction",
  PHONE: "Submitted Number",
  GENERAL: "Submitted Input",
}

const GENERIC_EVIDENCE_SOURCE_MAP: Record<string, string> = {
  "Message Analyzer": "content_analysis",
  "URL Intelligence": "url_analysis",
  "Scam Pattern Search": "scam_pattern",
  "Behavioral Analyzer": "behavior",
}

/**
 * Report model for non-EMAIL investigation types (URL / MESSAGE / TRANSACTION).
 * These run through the legacy rule-based analyzers (analyzers.ts) — no
 * header forensics, no threat-intel/geo integrations exist for them, so
 * those sections are honestly reported as not applicable rather than
 * fabricated. Structural URL decomposition is real (computed directly from
 * the URL string via the same analyzeUrl() used for email-embedded URLs).
 */
async function buildGenericReportModel(fraudCase: FraudCase): Promise<ReportModel> {
  const genericInputLabel = GENERIC_INPUT_LABEL[fraudCase.inputType] ?? "Submitted Input"
  const genericInputValue = fraudCase.input

  // These placeholder "nothing found" labels (from analyzers.ts) aren't real findings —
  // ranking them alongside genuine findings would misrepresent a null result as evidence.
  const NULL_RESULT_LABELS = new Set([
    "No fraud indicators detected in message text",
    "No structural red flags in URL",
    "No match against known scam patterns",
    "Transaction is consistent with normal behavior",
  ])
  const genericFindings: FindingRow[] = fraudCase.evidence
    .filter((e) => !NULL_RESULT_LABELS.has(e.label))
    .map((e) => ({
      finding: e.label,
      severity: e.severity,
      evidence: e.detail ?? e.label,
      source: e.source,
      confidence: "N/A",
      explanation: e.detail ?? "",
    }))

  const severityRank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
  const topFindings: RankedFinding[] = [...genericFindings]
    .sort((a, b) => (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0))
    .slice(0, 5)
    .map((f, i) => {
      const { impact, recommendation } = impactAndRecommendationFor(GENERIC_EVIDENCE_SOURCE_MAP[f.source] ?? "content_analysis", f.severity)
      return { rank: i + 1, ...f, impact, recommendation }
    })

  const urls = fraudCase.inputType === "URL" ? [analyzeUrl(fraudCase.input)] : []
  const domainIntelligence = urls.length > 0 && urls[0].domain !== NOT_AVAILABLE ? [domainIntelFor(urls[0].domain)] : []

  const toolAudit: ToolAuditRow[] = fraudCase.toolsUsed
    .filter((t) => t.id !== "risk-engine")
    .map((t) => {
      const summary = t.summary ?? ""
      return { tool: t.label, executed: true, status: "SUCCESS", reason: "—", result: summary }
    })
  const investigationScope: InvestigationScopeRow[] = toolAudit.map((t) => ({ module: t.tool, executed: true, reason: "" }))

  const evidenceInventory: EvidenceInventoryRow[] = genericFindings.map((f, i) => ({
    id: `EV-${String(i + 1).padStart(3, "0")}`,
    type: f.source.toUpperCase(),
    value: f.finding,
    source: f.source,
    severity: f.severity,
    confidence: "N/A",
    timestamp: new Date(fraudCase.createdAt).toLocaleTimeString(),
  }))

  const artifacts = buildArtifacts(fraudCase)
  const artifactHashes: ArtifactHash[] = await Promise.all(
    artifacts.map(async (a) => ({ name: a.name, sha256: await sha256Hex(a.content), sizeBytes: new TextEncoder().encode(a.content).length })),
  )

  const atAGlance: AtAGlance = {
    sender: "N/A",
    domain: domainIntelligence[0]?.domain ?? "N/A",
    urlCount: urls.length,
    ipCount: 0,
    threatIntelMatches: 0,
    findingCount: genericFindings.length,
    evidenceCount: evidenceInventory.length,
  }

  return {
    investigationType: fraudCase.inputType,
    caseId: fraudCase.id,
    investigationToken: fraudCase.investigationToken ?? NOT_AVAILABLE,
    riskScore: fraudCase.riskScore,
    riskLevel: fraudCase.riskLevel,
    confidence: fraudCase.confidence,
    threatType: fraudCase.category,
    status: fraudCase.status,
    createdAt: fraudCase.createdAt,
    generatedAt: new Date().toISOString(),
    reportVersion: nextReportVersion(fraudCase.reportVersion),

    emailFormat: "n/a",
    parsingNote: "This investigation type does not parse email headers — see the module-specific section for the actual analysis performed.",

    atAGlance,

    executiveAssessment: fraudCase.explanation,
    topFindings,
    investigationScope,

    emailFields: [],
    senderDisplayName: NOT_AVAILABLE,
    senderAddress: NOT_AVAILABLE,
    senderDomain: NOT_AVAILABLE,
    replyToDomain: NOT_AVAILABLE,
    returnPathDomain: NOT_AVAILABLE,
    identityConsistency: "Not Available",
    identityMismatchDetail: "",
    identityFindings: [],
    bodySummary: NOT_AVAILABLE,

    authRows: [],
    receivedChain: [],
    headerFindings: [],
    rawHeaderBlock: "Not applicable — this investigation type does not include email headers.",

    contentFindings: genericFindings,
    mlContent: null,

    urls,
    urlFindings: [],
    domainIntelligence,

    threatIntelFindings: [],

    infraNodes: [],
    infraFindings: [],

    evidenceGraph: fraudCase.evidenceGraph,
    evidenceInventory,

    riskBreakdown: [],
    riskInterpretation: fraudCase.explanation,

    timeline: fraudCase.timeline,
    toolAudit,

    recommendationGroups: categorizeRecommendations(fraudCase.recommendation),

    artifactHashes,

    feedback: fraudCase.feedback ?? [],

    demoComplaintReference: fraudCase.demoComplaintReference,
    demoComplaintGeneratedAt: fraudCase.demoComplaintGeneratedAt,

    appendixRawHeaders: "Not applicable.",
    appendixUrls: urls.map((u) => u.url),
    appendixIndicatorsJson: JSON.stringify({ note: "Not applicable for this investigation type." }, null, 2),
    appendixThreatIntelJson: JSON.stringify({ note: "Not applicable — threat-intelligence lookups are integrated for the email investigation pipeline only in this build." }, null, 2),
    appendixInfrastructureJson: JSON.stringify({ note: "Not applicable — infrastructure/geolocation enrichment is integrated for the email investigation pipeline only in this build." }, null, 2),
    appendixEventLog: fraudCase.timeline,
    appendixManifestJson: JSON.stringify(
      { case_id: fraudCase.id, investigation_token: fraudCase.investigationToken, artifacts: artifactHashes.map((a) => ({ name: a.name, sha256: a.sha256, size_bytes: a.sizeBytes })) },
      null,
      2,
    ),

    genericInputLabel,
    genericInputValue,
    genericFindings,
    transactionFields: fraudCase.transactionFields,
  }
}

function interpretAuth(mechanism: string, result: string): string {
  const r = result.toUpperCase()
  if (r === NOT_AVAILABLE.toUpperCase() || r === "NONE" || r === "UNKNOWN") return "No result present in the submitted email — cannot be evaluated. Missing is not the same as failing."
  if (r === "PASS") return `${mechanism} authentication passed for this message.`
  if (r === "FAIL") return `${mechanism} authentication failed — the sending server was not authorized for this domain.`
  if (r === "SOFTFAIL") return `${mechanism} soft-failed — the sending server is questionable but not conclusively rejected.`
  if (r === "NEUTRAL") return `${mechanism} returned a neutral result — no policy assertion was made.`
  return `${mechanism} result: ${result}.`
}
