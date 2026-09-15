import { Download, ExternalLink, Loader2, ShieldAlert } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { downloadBlob } from "@/lib/pdf/generate-report"
import { generateComplaintPackage, type ComplaintInput } from "@/lib/zip/generate-complaint-package"
import { cn } from "@/lib/utils"
import type { FraudCase } from "@/types/fraud"

const INCIDENT_TYPES = ["Phishing", "Business Email Compromise", "Credential Theft", "Malware Distribution", "Other"]

const CYBERCRIME_PORTAL_URL = "https://cybercrime.gov.in"

interface EvidenceOption {
  key: keyof Pick<ComplaintInput, "includeOriginalEmail" | "includeForensicPdf" | "includeHeaders" | "includeIndicators" | "includeThreatIntel">
  label: string
}

const EVIDENCE_OPTIONS: EvidenceOption[] = [
  { key: "includeOriginalEmail", label: "Original Email" },
  { key: "includeForensicPdf", label: "Forensic PDF" },
  { key: "includeHeaders", label: "Headers" },
  { key: "includeIndicators", label: "Indicators" },
  { key: "includeThreatIntel", label: "Threat Intelligence" },
]

export function CyberCellDialog({ fraudCase, open, onOpenChange }: { fraudCase: FraudCase; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [incidentType, setIncidentType] = useState(INCIDENT_TYPES[0])
  const [incidentDate, setIncidentDate] = useState(() => new Date(fraudCase.createdAt).toISOString().slice(0, 10))
  const [description, setDescription] = useState(fraudCase.explanation)
  const [affectedEmail, setAffectedEmail] = useState(() => {
    const to = fraudCase.parsedEmail?.headers["to"]
    return Array.isArray(to) ? (to[0] ?? "") : ""
  })
  const [evidence, setEvidence] = useState<Record<EvidenceOption["key"], boolean>>({
    includeOriginalEmail: true,
    includeForensicPdf: true,
    includeHeaders: true,
    includeIndicators: true,
    includeThreatIntel: true,
  })
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ blob: Blob; filename: string; demoReference: string } | null>(null)

  async function handleGenerate() {
    setGenerating(true)
    try {
      const pkg = await generateComplaintPackage(fraudCase, {
        incidentType,
        incidentDate,
        description,
        affectedEmail,
        includeHashes: true,
        ...evidence,
      })
      setResult(pkg)
      toast.success("Demo complaint package generated")
    } catch (err) {
      toast.error(err instanceof Error ? `Unable to generate complaint package: ${err.message}` : "Unable to generate complaint package.")
    } finally {
      setGenerating(false)
    }
  }

  function handleClose(next: boolean) {
    if (!next) setResult(null)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-risk-high" />
            Report to Cyber Cell — Demo Only
          </DialogTitle>
          <DialogDescription>
            This is a demo workflow. NetraX does not submit to any government system — you'll get a downloadable package and a link to the
            official portal.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Incident Type</Label>
              <select
                className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value)}
              >
                {INCIDENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Incident Date</Label>
              <input
                type="date"
                className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Affected Email Account</Label>
              <input
                type="text"
                className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
                value={affectedEmail}
                onChange={(e) => setAffectedEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Description</Label>
              <Textarea className="min-h-24 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Evidence to include</Label>
              <div className="flex flex-col gap-1.5">
                {EVIDENCE_OPTIONS.map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={evidence[opt.key]}
                      onChange={(e) => setEvidence((prev) => ({ ...prev, [opt.key]: e.target.checked }))}
                    />
                    {opt.label}
                  </label>
                ))}
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" checked disabled />
                  Evidence Hashes (always included)
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldAlert className="size-3.5" />}
                Generate Complaint Package
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className={cn("rounded-lg border border-risk-medium/40 bg-risk-medium-bg/20 p-4")}>
              <p className="text-xs font-medium text-muted-foreground">Demo Reference</p>
              <p className="font-mono text-lg font-semibold">{result.demoReference}</p>
              <p className="mt-2 text-xs font-semibold text-risk-medium">DEMO REFERENCE — NOT AN OFFICIAL CYBERCRIME ACKNOWLEDGEMENT</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => downloadBlob(result.blob, result.filename)}>
                <Download className="size-3.5" />
                Download Complaint Package
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={CYBERCRIME_PORTAL_URL} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                  Open Official Cyber Crime Portal
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The portal link only opens cybercrime.gov.in in a new tab — nothing is submitted automatically on your behalf.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
