import JSZip from "jszip"

import { sha256Hex } from "@/lib/hash"
import { generateForensicPdf } from "@/lib/pdf/generate-report"
import { buildArtifacts } from "@/lib/mock/report-data"
import type { FraudCase } from "@/types/fraud"

export interface GeneratedPackage {
  blob: Blob
  filename: string
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
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  return { name, bytes, sha256: await sha256Hex(bytes) }
}

/**
 * NETRAX_CASE_<CASE_ID>.zip — forensic_report.pdf, original_email.eml,
 * headers.txt, indicators.json, threat_intelligence.json,
 * infrastructure_analysis.json, evidence_manifest.json, hashes.sha256.
 * Every byte inside is real case data; the PDF is generated fresh so the
 * package always reflects the current report version.
 */
export async function generateEvidencePackage(fraudCase: FraudCase): Promise<GeneratedPackage> {
  const { blob: pdfBlob } = await generateForensicPdf(fraudCase)
  const textArtifacts = buildArtifacts(fraudCase).filter((a) => a.name !== "original_email.eml")
  const originalEmail = fraudCase.rawEmailContent

  const files: HashedFile[] = []
  files.push(await hashBlob("forensic_report.pdf", pdfBlob))
  if (originalEmail) files.push(await hashText("original_email.eml", originalEmail))
  for (const artifact of textArtifacts) {
    files.push(await hashText(artifact.name, artifact.content))
  }

  const manifest = {
    case_id: fraudCase.id,
    investigation_token: fraudCase.investigationToken,
    generated_at: new Date().toISOString(),
    artifacts: files.map((f) => ({ name: f.name, sha256: f.sha256, size_bytes: f.bytes.length })),
  }
  const manifestFile = await hashText("evidence_manifest.json", JSON.stringify(manifest, null, 2))
  files.push(manifestFile)

  const hashesSha256 = files.map((f) => `${f.sha256}  ${f.name}`).join("\n") + "\n"

  const folder = `NETRAX_CASE_${fraudCase.id}`
  const zip = new JSZip()
  const root = zip.folder(folder)!
  for (const f of files) root.file(f.name, f.bytes)
  root.file("hashes.sha256", hashesSha256)

  const blob = await zip.generateAsync({ type: "blob" })
  return { blob, filename: `${folder}.zip` }
}
