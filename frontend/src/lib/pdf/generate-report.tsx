import { pdf } from "@react-pdf/renderer"

import { updateCase } from "@/lib/mock/store"
import type { FraudCase } from "@/types/fraud"

import { ForensicReportDocument } from "./ForensicReportDocument"
import { buildReportModel, type ReportModel } from "./report-model"

export interface GeneratedReport {
  blob: Blob
  filename: string
  model: ReportModel
}

/** Builds the report model (real case data + fresh hashes), renders the PDF, and bumps the case's report version. Never touches case findings. */
export async function generateForensicPdf(fraudCase: FraudCase): Promise<GeneratedReport> {
  const model = await buildReportModel(fraudCase)
  const blob = await pdf(<ForensicReportDocument model={model} />).toBlob()
  const filename = `NetraX_Forensic_Report_${fraudCase.id}.pdf`

  updateCase(fraudCase.id, {
    reportVersion: model.reportVersion,
    reportGeneratedAt: model.generatedAt,
    status: fraudCase.status === "INVESTIGATION_COMPLETE" ? "REPORT_GENERATED" : fraudCase.status,
  })

  return { blob, filename, model }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
