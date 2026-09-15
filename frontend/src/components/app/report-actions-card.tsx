import { Download, FileText, Loader2, ShieldAlert } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { downloadBlob, generateForensicPdf } from "@/lib/pdf/generate-report"
import { generateEvidencePackage } from "@/lib/zip/generate-package"
import type { FraudCase } from "@/types/fraud"

type GenerationState = "idle" | "pdf" | "zip"

/** Real generation only — no placeholder buttons. Failures show a genuine error, never a fake success. */
export function ReportActionsCard({ fraudCase, onOpenComplaint }: { fraudCase: FraudCase; onOpenComplaint: () => void }) {
  const [state, setState] = useState<GenerationState>("idle")

  async function handleDownloadPdf() {
    setState("pdf")
    try {
      const { blob, filename } = await generateForensicPdf(fraudCase)
      downloadBlob(blob, filename)
      toast.success("Forensic PDF generated")
    } catch (err) {
      toast.error(err instanceof Error ? `Unable to generate forensic report: ${err.message}` : "Unable to generate forensic report.")
    } finally {
      setState("idle")
    }
  }

  async function handleDownloadZip() {
    setState("zip")
    try {
      const { blob, filename } = await generateEvidencePackage(fraudCase)
      downloadBlob(blob, filename)
      toast.success("Evidence package generated")
    } catch (err) {
      toast.error(err instanceof Error ? `Unable to generate evidence package: ${err.message}` : "Unable to generate evidence package.")
    } finally {
      setState("idle")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Forensic Report</CardTitle>
        <CardDescription>
          {fraudCase.reportVersion ? `Report v${fraudCase.reportVersion} generated ${new Date(fraudCase.reportGeneratedAt!).toLocaleString()}` : "Not yet generated"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button size="sm" onClick={handleDownloadPdf} disabled={state !== "idle"}>
          {state === "pdf" ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
          Download Full Forensic PDF
        </Button>
        <Button size="sm" variant="outline" onClick={handleDownloadZip} disabled={state !== "idle"}>
          {state === "zip" ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          Download Evidence Package
        </Button>
        <Button size="sm" variant="outline" onClick={onOpenComplaint} disabled={state !== "idle"}>
          <ShieldAlert className="size-3.5" />
          Report to Cyber Cell
        </Button>
      </CardContent>
    </Card>
  )
}
