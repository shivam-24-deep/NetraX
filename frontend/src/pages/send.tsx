// "Send to NetraX" — the web fallback + mobile-share landing page (SIH26106
// mobile-ingest spec, §7 and §41). Content arrives one of three ways:
//   1. Pasted or dropped directly on this page (web fallback).
//   2. Query params (?text=&url=&title=&source=mobile_share) — the landing
//      shape a PWA Web Share Target redirect will use once wired up; this
//      page already understands that shape so the PWA phase is a pure
//      manifest/service-worker addition, no page changes needed.
// Classification is automatic (lib/ingest/classify.ts) — the user never
// picks a content type here, unlike the manual-tab Investigate page.
import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, CheckCircle2, FileUp, Send, ShieldCheck, XCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { InvestigationControlRoom } from "@/components/app/investigation-control-room"
import { PipelineStepper } from "@/components/app/pipeline-stepper"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { classifyInput } from "@/lib/ingest/classify"
import { ingestSharedContent, type IngestOutcome, type IngestSource } from "@/lib/ingest/ingest-service"
import { readFileAsText } from "@/lib/mock/email-input-validation"
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGE_ORDER } from "@/lib/mock/tools"
import { cn } from "@/lib/utils"
import type { EvidenceGraph, FraudCase, PipelineStage, RiskLevel, TimelineEvent, ToolExecution } from "@/types/fraud"

import { MobileShareCard } from "@/components/app/mobile-share-card"

const UPLOAD_EXTENSIONS = [".eml", ".msg", ".txt", ".html", ".json"]
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

function initialStages(): PipelineStage[] {
  return PIPELINE_STAGE_ORDER.map((id) => ({ id, label: PIPELINE_STAGE_LABELS[id], status: "waiting" as const }))
}

type Phase = "idle" | "running" | "outcome"

export default function SendPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [content, setContent] = useState("")
  const [phase, setPhase] = useState<Phase>("idle")
  const [source, setSource] = useState<IngestSource>("web_upload")
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [stages, setStages] = useState<PipelineStage[]>(initialStages())
  const [tools, setTools] = useState<ToolExecution[]>([])
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [liveRisk, setLiveRisk] = useState<{ score: number; level: RiskLevel } | null>(null)
  const [liveGraph, setLiveGraph] = useState<EvidenceGraph | undefined>(undefined)
  const [outcome, setOutcome] = useState<IngestOutcome | null>(null)
  const [showLivePipeline, setShowLivePipeline] = useState(false)

  // Arrival from the OS Share sheet: Android's Web Share Target API (see
  // public/manifest.webmanifest's share_target) redirects here as a GET with
  // ?title=&text=&url= — that shape, on its own, IS the "this came from a
  // phone share" signal (a real user wouldn't hand-type these query params).
  // Per the mobile-ingest spec's "no manual copy/paste after sharing" goal,
  // arrival with content auto-submits once rather than waiting for a click.
  const autoSubmitted = useRef(false)
  useEffect(() => {
    const sharedText = searchParams.get("text")
    const sharedUrl = searchParams.get("url")
    const prefill = [sharedText, sharedUrl].filter(Boolean).join("\n\n")
    if (!prefill || autoSubmitted.current) return
    autoSubmitted.current = true
    setContent(prefill)
    setSource("mobile_share")
    toast.message("Received shared content from your device — investigating…")
    void handleSend(prefill, "mobile_share")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function handleFile(file: File) {
    const name = file.name.toLowerCase()
    const hasAllowedExtension = UPLOAD_EXTENSIONS.some((ext) => name.endsWith(ext))
    if (!hasAllowedExtension) {
      toast.error(`Unsupported file type. Upload one of: ${UPLOAD_EXTENSIONS.join(", ")}.`)
      return
    }
    if (file.size === 0) {
      toast.error("The selected file is empty.")
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`)
      return
    }
    try {
      const text = await readFileAsText(file)
      setContent(text)
      setFileName(file.name)
      setSource("web_upload")
    } catch {
      toast.error("NetraX could not read this file.")
    }
  }

  async function handleSend(overrideText?: string, overrideSource?: IngestSource) {
    const trimmed = (overrideText ?? content).trim()
    const effectiveSource = overrideSource ?? source
    if (!trimmed) {
      toast.error("Paste content, a URL, or upload a file before sending to NetraX.")
      return
    }

    setPhase("running")
    setStages(initialStages())
    setTools([])
    setEvents([])
    setLiveRisk(null)
    setLiveGraph(undefined)
    setOutcome(null)
    setShowLivePipeline(false)

    const handlers = {
      onStage: (stage: PipelineStage) => {
        setStages((prev) => prev.map((s) => (s.id === stage.id ? stage : s)))
        // Only the real, real-backend EMAIL path reaches "tool-selection" — that's
        // our signal to switch from the generic receiving state to the full
        // live Control Room (submitted content + timeline + risk + graph).
        if (stage.id === "tool-selection" && stage.status === "running") setShowLivePipeline(true)
      },
      onTool: (tool: ToolExecution) =>
        setTools((prev) => {
          const idx = prev.findIndex((t) => t.id === tool.id)
          if (idx === -1) return [...prev, tool]
          const next = [...prev]
          next[idx] = tool
          return next
        }),
      onEvent: (event: { id: string; timestamp: string; message: string }) =>
        setEvents((prev) => [...prev, { label: event.message, timestamp: event.timestamp }]),
      onGraph: (graph: EvidenceGraph) => setLiveGraph(graph),
      onRisk: (risk: { score: number; level: RiskLevel }) => setLiveRisk(risk),
    }

    const result = await ingestSharedContent({ source: effectiveSource, text: trimmed, filename: fileName ?? undefined }, handlers)
    setOutcome(result)
    setPhase("outcome")
  }

  function reset() {
    setPhase("idle")
    setContent("")
    setFileName(null)
    setOutcome(null)
    setSource("web_upload")
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Send to NetraX</h2>
        <p className="text-sm text-muted-foreground">
          Paste suspicious content, drop a file, or share directly from your phone — NetraX identifies what it is and
          investigates automatically.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Evidence</CardTitle>
                  <CardDescription>Paste an email, a message, or a URL — or upload a file.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div
                    className={cn(
                      "rounded-lg border border-dashed transition-colors",
                      dragActive ? "border-primary bg-primary/5" : "border-border",
                    )}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragActive(true)
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragActive(false)
                      const file = e.dataTransfer.files[0]
                      if (file) handleFile(file)
                    }}
                  >
                    <Textarea
                      placeholder="Paste a raw email, a suspicious message, or a URL…"
                      className="min-h-48 resize-y border-0 font-mono text-xs shadow-none focus-visible:ring-0"
                      value={content}
                      onChange={(e) => {
                        setContent(e.target.value)
                        setFileName(null)
                        setSource("web_upload")
                      }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <FileUp className="size-4" />
                      Upload file
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={UPLOAD_EXTENSIONS.join(",")}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFile(file)
                        e.target.value = ""
                      }}
                    />
                    {fileName && <span className="text-xs text-muted-foreground">Loaded {fileName}</span>}
                    <span className="text-[11px] text-muted-foreground">{UPLOAD_EXTENSIONS.join(", ")} — up to 10 MB</span>
                  </div>

                  <div className="flex items-start gap-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      NetraX fully investigates EMAIL and URL content today — a message or transaction is identified
                      honestly, but routed to the Investigate page for manual analysis rather than faked.
                    </span>
                  </div>

                  <Button size="lg" disabled={!content.trim()} onClick={() => handleSend()} className="self-start">
                    <Send className="size-4" />
                    Send to NetraX
                  </Button>
                </CardContent>
              </Card>

              <MobileShareCard />
            </div>
          </motion.div>
        )}

        {phase === "running" && (
          <motion.div key="running" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
            {showLivePipeline ? (
              <>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">NetraX Investigation Control Room</h3>
                  <p className="text-sm text-muted-foreground">Live, auditable progress — every result shown is a real backend finding.</p>
                </div>
                <InvestigationControlRoom
                  submittedEmail={content}
                  submittedLabel={classifyInput({ text: content }).inputType === "URL" ? "Submitted URL" : "Submitted Email"}
                  stages={stages}
                  events={events}
                  tools={tools}
                  risk={liveRisk}
                  evidenceGraph={liveGraph}
                />
              </>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">NetraX is investigating this evidence…</CardTitle>
                  <CardDescription>Receiving evidence and identifying the content type.</CardDescription>
                </CardHeader>
                <CardContent>
                  <PipelineStepper stages={stages} />
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {phase === "outcome" && outcome && (
          <motion.div key="outcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <OutcomeCard outcome={outcome} onReset={reset} onOpen={(fraudCase) => navigate(`/cases/${fraudCase.id}`)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function OutcomeCard({
  outcome,
  onReset,
  onOpen,
}: {
  outcome: IngestOutcome
  onReset: () => void
  onOpen: (fraudCase: FraudCase) => void
}) {
  if (outcome.status === "empty") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertTriangle className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No content was received.</p>
          <Button variant="outline" onClick={onReset}>
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (outcome.status === "backend_unavailable") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <XCircle className="size-8 text-destructive" />
          <p className="text-sm font-medium">Investigation service temporarily unavailable.</p>
          <p className="max-w-md text-xs text-muted-foreground">
            NetraX identified this as EMAIL content but could not reach the investigation backend. Start it with{" "}
            <code className="rounded bg-muted px-1 py-0.5">node server/local-api.ts</code> and try again — your evidence
            was not lost.
          </p>
          <Button variant="outline" onClick={onReset}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (outcome.status === "unsupported") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertTriangle className="size-8 text-amber-500" />
          <p className="text-sm font-medium">NetraX identified this as {outcome.inputType}.</p>
          <p className="max-w-md text-xs text-muted-foreground">{outcome.reason}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onReset}>
              Send something else
            </Button>
            <Button onClick={() => (window.location.href = "/investigate")}>Open Investigate</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const fraudCase = outcome.fraudCase
  const isDuplicate = outcome.status === "duplicate"

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader className="items-center text-center">
        <CheckCircle2 className="size-10 text-emerald-500" />
        <CardTitle className="text-lg">Investigation {isDuplicate ? "Already On File" : "Received"}</CardTitle>
        <CardDescription>
          {isDuplicate
            ? "This exact evidence was already submitted — showing the existing case, no duplicate was created."
            : "NetraX received your evidence and completed a real investigation."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-1.5 text-sm">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" /> Evidence received
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" /> Input identified as {outcome.inputType}
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" /> {isDuplicate ? "Existing investigation located" : "Investigation created"}
          </li>
        </ul>

        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-3 text-xs">
          <div>
            <p className="text-muted-foreground">Case</p>
            <p className="font-mono font-medium">{fraudCase.id}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Token</p>
            <p className="font-mono font-medium">{fraudCase.investigationToken}</p>
          </div>
          <div className="col-span-2">
            <p className="text-muted-foreground">Status</p>
            <p className="font-medium">{fraudCase.riskLevel} risk — {fraudCase.status.replaceAll("_", " ")}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onReset}>
            Send another
          </Button>
          <Button className="flex-1" onClick={() => onOpen(fraudCase)}>
            Open Investigation
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
