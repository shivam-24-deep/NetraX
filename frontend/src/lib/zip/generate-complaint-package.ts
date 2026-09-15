import JSZip from "jszip"

import { sha256Hex } from "@/lib/hash"
import { generateDemoComplaintReference } from "@/lib/case-id"
import { generateForensicPdf } from "@/lib/pdf/generate-report"
import { buildArtifacts } from "@/lib/mock/report-data"
import { updateCase } from "@/lib/mock/store"
import type { FraudCase } from "@/types/fraud"

export interface ComplaintInput {
  incidentType: string
  incidentDate: string
  description: string
  affectedEmail: string
  includeOriginalEmail: boolean
  includeForensicPdf: boolean
  includeHeaders: boolean
  includeIndicators: boolean
  includeThreatIntel: boolean
  includeHashes: boolean
}

export interface GeneratedComplaintPackage {
  blob: Blob
  filename: string
  demoReference: string
  generatedAt: string
}

interface HashedFile {
  name: string
  bytes: Uint8Array
  sha256: string
}

async function hashText(name: string, content: string): Promise<HashedFile> {
  const bytes = new TextEncoder().encode(content)
  return { name, bytes, sha256: await sha256Hex(bytes) }
}

async function hashBlob(name: string, blob: Blob): Promise<HashedFile> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return { name, bytes, sha256: await sha256Hex(bytes) }
}

function buildComplaintSummary(fraudCase: FraudCase, input: ComplaintInput, demoReference: string, generatedAt: string): string {
  const indicators = [
    ...(fraudCase.parsedEmail?.indicators.urls ?? []).map((u) => `  - URL: ${u}`),
    ...(fraudCase.parsedEmail?.indicators.domains ?? []).map((d) => `  - Domain: ${d}`),
    ...(fraudCase.parsedEmail?.indicators.ipAddresses ?? []).map((ip) => `  - IP: ${ip}`),
  ]
  return [
    "NETRAX DEMO COMPLAINT SUMMARY",
    "DEMO PACKAGE — NOT AN OFFICIAL CYBERCRIME SUBMISSION",
    "",
    `Demo Reference: ${demoReference}`,
    `Generated At: ${generatedAt}`,
    "",
    `Incident Type: ${input.incidentType}`,
    `Incident Date: ${input.incidentDate}`,
    `Affected Email Account: ${input.affectedEmail}`,
    "",
    "Description:",
    input.description,
    "",
    `Case ID: ${fraudCase.id}`,
    `Investigation Token: ${fraudCase.investigationToken ?? "Not available"}`,
    "",
    "Executive Summary:",
    fraudCase.explanation,
    "",
    `Risk Score: ${fraudCase.riskScore}/100 (${fraudCase.riskLevel})`,
    `Threat Classification: ${fraudCase.category}`,
    "",
    "Key Indicators:",
    indicators.length > 0 ? indicators.join("\n") : "  (none extracted)",
    "",
    "Recommended Actions:",
    fraudCase.recommendation.map((r) => `  - ${r}`).join("\n"),
    "",
    "Evidence manifest and SHA-256 hashes are included in this package (evidence_manifest.json, hashes.sha256).",
  ].join("\n")
}

/**
 * NETRAX_COMPLAINT_PACKAGE_<CASE_ID>.zip — demo-only. Never a real Cyber
 * Cell submission; the reference generated here is explicitly labeled and
 * never presented as an official acknowledgement number.
 */
export async function generateComplaintPackage(fraudCase: FraudCase, input: ComplaintInput): Promise<GeneratedComplaintPackage> {
  const demoReference = generateDemoComplaintReference()
  const generatedAt = new Date().toISOString()

  const files: HashedFile[] = []

  if (input.includeForensicPdf) {
    const { blob } = await generateForensicPdf(fraudCase)
    files.push(await hashBlob("forensic_report.pdf", blob))
  }
  if (input.includeOriginalEmail && fraudCase.rawEmailContent) {
    files.push(await hashText("original_email.eml", fraudCase.rawEmailContent))
  }
  const artifacts = buildArtifacts(fraudCase)
  if (input.includeHeaders) {
    const headers = artifacts.find((a) => a.name === "headers.txt")
    if (headers) files.push(await hashText(headers.name, headers.content))
  }
  if (input.includeIndicators) {
    const indicators = artifacts.find((a) => a.name === "indicators.json")
    if (indicators) files.push(await hashText(indicators.name, indicators.content))
  }
  if (input.includeThreatIntel) {
    const ti = artifacts.find((a) => a.name === "threat_intelligence.json")
    if (ti) files.push(await hashText(ti.name, ti.content))
    const infra = artifacts.find((a) => a.name === "infrastructure_analysis.json")
    if (infra) files.push(await hashText(infra.name, infra.content))
  }

  const complaintSummary = buildComplaintSummary(fraudCase, input, demoReference, generatedAt)
  files.push(await hashText("complaint_summary.txt", complaintSummary))

  const manifest = {
    case_id: fraudCase.id,
    investigation_token: fraudCase.investigationToken,
    demo_reference: demoReference,
    generated_at: generatedAt,
    label: "DEMO PACKAGE — NOT AN OFFICIAL CYBERCRIME ACKNOWLEDGEMENT",
    artifacts: files.map((f) => ({ name: f.name, sha256: f.sha256, size_bytes: f.bytes.length })),
  }
  const manifestFile = await hashText("evidence_manifest.json", JSON.stringify(manifest, null, 2))
  files.push(manifestFile)

  // hashes.sha256 is always included — a forensic package without integrity hashes isn't meaningful.
  const hashesSha256 = files.map((f) => `${f.sha256}  ${f.name}`).join("\n") + "\n"

  const folder = `NETRAX_COMPLAINT_PACKAGE_${fraudCase.id}`
  const zip = new JSZip()
  const root = zip.folder(folder)!
  for (const f of files) root.file(f.name, f.bytes)
  root.file("hashes.sha256", hashesSha256)

  const blob = await zip.generateAsync({ type: "blob" })

  updateCase(fraudCase.id, {
    demoComplaintReference: demoReference,
    demoComplaintGeneratedAt: generatedAt,
    status: "DEMO_PACKAGE_GENERATED",
  })

  return { blob, filename: `${folder}.zip`, demoReference, generatedAt }
}
