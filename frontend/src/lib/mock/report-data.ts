// Shared artifact builders for the forensic report, evidence package, and
// complaint package (SIH26106 §10/§17/§19/§21) — one canonical serialization
// per artifact so the PDF, ZIP, and in-app Evidence Integrity hashes always
// match byte-for-byte. Every function here reads only real case data already
// returned by the investigation backend; nothing is invented.

import type { RemoteFinding } from "@/lib/mock/email-investigation-client"
import type { FraudCase } from "@/types/fraud"

export interface ReportArtifact {
  name: string
  content: string
}

const NOT_AVAILABLE = "Not available in submitted email."

function headerLine(label: string, value: string | string[] | undefined | null): string {
  const text = Array.isArray(value) ? value.join(", ") : value
  return `${label}: ${text && text.trim() !== "" ? text : NOT_AVAILABLE}`
}

/** headers.txt — the exact text shown/hashed for header forensics. */
export function buildHeadersText(fraudCase: FraudCase): string {
  const h = fraudCase.parsedEmail?.headers
  if (!h) return "No parsed header data available for this case."
  const lines = [
    headerLine("From", h.from as string | undefined),
    headerLine("To", h["to"] as string[] | undefined),
    headerLine("Cc", h["cc"] as string[] | undefined),
    headerLine("Bcc", h["bcc"] as string[] | undefined),
    headerLine("Reply-To", h["replyTo"] as string | undefined),
    headerLine("Return-Path", h["returnPath"] as string | undefined),
    headerLine("Subject", h.subject),
    headerLine("Date", h["date"] as string | undefined),
    headerLine("Message-ID", h["messageId"] as string | undefined),
    headerLine("MIME-Version", h["mimeVersion"] as string | undefined),
    headerLine("Content-Type", h["contentType"] as string | undefined),
    headerLine("SPF", h.spf),
    headerLine("DKIM", h.dkim),
    headerLine("DMARC", h.dmarc),
    headerLine("X-Mailer", h["xMailer"] as string | undefined),
    headerLine("User-Agent", h["userAgent"] as string | undefined),
  ]
  return lines.join("\n")
}

/** indicators.json */
export function buildIndicatorsJson(fraudCase: FraudCase): string {
  return JSON.stringify(fraudCase.parsedEmail?.indicators ?? {}, null, 2)
}

function findingsBySource(fraudCase: FraudCase, sources: string[]): RemoteFinding[] {
  return (fraudCase.allFindings ?? []).filter((f) => sources.includes(f.source))
}

/** threat_intelligence.json */
export function buildThreatIntelJson(fraudCase: FraudCase): string {
  const findings = findingsBySource(fraudCase, ["threat_intelligence"])
  return JSON.stringify(
    {
      caseId: fraudCase.id,
      note: "NO MATCH does not mean safe. UNAVAILABLE means the provider was not reachable/configured — never fabricated.",
      findings,
    },
    null,
    2,
  )
}

/** infrastructure_analysis.json */
export function buildInfrastructureJson(fraudCase: FraudCase): string {
  const findings = findingsBySource(fraudCase, ["ip_geolocation"])
  const ipNodes = fraudCase.evidenceGraph?.nodes.filter((n) => n.type === "ip" || n.type === "asn" || n.type === "country") ?? []
  return JSON.stringify(
    {
      caseId: fraudCase.id,
      disclaimer: "IP geolocation is approximate and does not establish the attacker's exact physical location or identity.",
      findings,
      infrastructureNodes: ipNodes,
    },
    null,
    2,
  )
}

export function buildEvidenceManifest(fraudCase: FraudCase, artifactHashes: { name: string; sha256: string; sizeBytes: number }[]): string {
  return JSON.stringify(
    {
      case_id: fraudCase.id,
      investigation_token: fraudCase.investigationToken,
      generated_at: new Date().toISOString(),
      artifacts: artifactHashes.map((a) => ({ name: a.name, sha256: a.sha256, size_bytes: a.sizeBytes })),
    },
    null,
    2,
  )
}

/** original_input.txt — for non-email cases, the exact submitted input (message text / URL / transaction fields). */
export function buildOriginalInputText(fraudCase: FraudCase): string {
  if (fraudCase.inputType === "TRANSACTION" && fraudCase.transactionFields) {
    return JSON.stringify(fraudCase.transactionFields, null, 2)
  }
  return fraudCase.input
}

/** evidence.json — the case's Evidence[] (label/severity/source/detail), used for non-email input types where allFindings isn't populated. */
export function buildEvidenceJson(fraudCase: FraudCase): string {
  return JSON.stringify(fraudCase.evidence, null, 2)
}

/**
 * All hashable artifacts for a case, built from real case data only.
 * Email cases get the full RFC-artifact set; other input types only get the
 * artifacts that are actually applicable to them (no fabricated threat-intel
 * or infrastructure files for input types that never ran those tools).
 */
export function buildArtifacts(fraudCase: FraudCase): ReportArtifact[] {
  const artifacts: ReportArtifact[] = []
  if (fraudCase.inputType === "EMAIL") {
    if (fraudCase.rawEmailContent) artifacts.push({ name: "original_email.eml", content: fraudCase.rawEmailContent })
    artifacts.push({ name: "headers.txt", content: buildHeadersText(fraudCase) })
    artifacts.push({ name: "indicators.json", content: buildIndicatorsJson(fraudCase) })
    artifacts.push({ name: "threat_intelligence.json", content: buildThreatIntelJson(fraudCase) })
    artifacts.push({ name: "infrastructure_analysis.json", content: buildInfrastructureJson(fraudCase) })
  } else {
    artifacts.push({ name: "original_input.txt", content: buildOriginalInputText(fraudCase) })
    artifacts.push({ name: "evidence.json", content: buildEvidenceJson(fraudCase) })
  }
  return artifacts
}
