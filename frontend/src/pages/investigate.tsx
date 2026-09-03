import { AnimatePresence, motion } from "framer-motion"
import { Bot, CheckCircle2, Flag, RotateCcw, ShieldCheck, Sparkles } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { AgentOrb } from "@/components/app/agent-orb"
import { EvidenceCard } from "@/components/app/evidence-card"
import { PipelineStepper } from "@/components/app/pipeline-stepper"
import { RiskBreakdown } from "@/components/app/risk-breakdown"
import { RiskGauge } from "@/components/app/risk-gauge"
import { ToolStatusRow } from "@/components/app/tool-status"
import { RiskBadge } from "@/components/risk-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { INPUT_TYPE_ICONS, INPUT_TYPE_LABELS } from "@/lib/input-type"
import { runInvestigation } from "@/lib/mock/engine"
import { addCase, toggleSaved, updateCaseStatus } from "@/lib/mock/store"
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGE_ORDER } from "@/lib/mock/tools"
import { cn } from "@/lib/utils"
import type { FraudCase, InputType, PipelineStage, PipelineStageId, ToolExecution, TransactionFields } from "@/types/fraud"

const TYPES: InputType[] = ["SMS", "EMAIL", "URL", "PHONE", "TRANSACTION"]

const STAGE_TO_AGENT_INDEX: Record<PipelineStageId, number> = {
  input: 0,
  classification: 0,
  "tool-selection": 1,
  "evidence-collection": 2,
  "risk-analysis": 3,
  "final-assessment": 4,
}

const QUICK_EXAMPLES: { label: string; type: InputType; content: string }[] = [
  { label: "Try phishing SMS", type: "SMS", content: "Congratulations! You have won ₹50,000 in the HDFC Lucky Draw. Click here immediately to claim: bit.ly/xyz123" },
  { label: "Try KYC scam", type: "SMS", content: "Your KYC will expire today. Verify immediately at secure-kyc-update.info to avoid account suspension." },
  { label: "Try suspicious URL", type: "URL", content: "http://secure-login-verify-account.paym3nt-update.info/reset" },
  { label: "Try normal message", type: "GENERAL" as InputType, content: "Hey, are we still meeting for lunch at 1pm tomorrow?" },
]

const EMPTY_TX: TransactionFields = { amount: "", merchant: "", location: "", time: "", device: "" }

function initialStages(): PipelineStage[] {
  return PIPELINE_STAGE_ORDER.map((id) => ({ id, label: PIPELINE_STAGE_LABELS[id], status: "waiting" as const }))
}

export default function InvestigatePage() {
  const [phase, setPhase] = useState<"idle" | "running" | "result">("idle")
  const [inputType, setInputType] = useState<InputType>("SMS")
  const [content, setContent] = useState("")
  const [txFields, setTxFields] = useState<TransactionFields>(EMPTY_TX)

  const [stages, setStages] = useState<PipelineStage[]>(initialStages())
  const [tools, setTools] = useState<ToolExecution[]>([])
  const [selectedTool, setSelectedTool] = useState<ToolExecution | null>(null)
  const [resultCase, setResultCase] = useState<FraudCase | null>(null)

  const isTransaction = inputType === "TRANSACTION"
  const canInvestigate = isTransaction
    ? txFields.amount.trim() !== "" && txFields.merchant.trim() !== ""
    : content.trim() !== ""

  function applyExample(example: (typeof QUICK_EXAMPLES)[number]) {
    setInputType(example.type === ("GENERAL" as InputType) ? "SMS" : example.type)
    setContent(example.content)
  }

  async function start() {
    setPhase("running")
    setStages(initialStages())
    setTools([])
    setResultCase(null)

    const result = await runInvestigation(
      { type: inputType, content, transactionFields: isTransaction ? txFields : undefined },
      {
        onStage: (stage) => setStages((prev) => prev.map((s) => (s.id === stage.id ? stage : s))),
        onTool: (tool) =>
          setTools((prev) => {
            const idx = prev.findIndex((t) => t.id === tool.id)
            if (idx === -1) return [...prev, tool]
            const next = [...prev]
            next[idx] = tool
            return next
          }),
      },
    )

    addCase(result)
    setResultCase(result)
    setPhase("result")
  }

  function reset() {
    setPhase("idle")
    setContent("")
    setTxFields(EMPTY_TX)
    setResultCase(null)
  }

  const runningStage = stages.find((s) => s.status === "running") ?? [...stages].reverse().find((s) => s.status === "complete")
  const agentActiveIndex = runningStage ? STAGE_TO_AGENT_INDEX[runningStage.id] : 0

  return (
    <div className="flex flex-col gap-6">
      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
            <IdleView
              inputType={inputType}
              setInputType={setInputType}
              content={content}
              setContent={setContent}
              txFields={txFields}
              setTxFields={setTxFields}
              canInvestigate={canInvestigate}
              onStart={start}
              onExample={applyExample}
            />
          </motion.div>
        )}

        {phase === "running" && (
          <motion.div key="running" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
            <RunningView stages={stages} tools={tools} agentActiveIndex={agentActiveIndex} onSelectTool={setSelectedTool} />
          </motion.div>
        )}

        {phase === "result" && resultCase && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
            <ResultView
              fraudCase={resultCase}
              onReset={reset}
              onMarkReviewed={() => {
                updateCaseStatus(resultCase.id, "UNDER_REVIEW")
                setResultCase({ ...resultCase, status: "UNDER_REVIEW" })
                toast.success("Case marked as reviewed")
              }}
              onReport={() => toast.success("Reported for cybercrime follow-up (demo only)")}
              onSave={() => {
                toggleSaved(resultCase.id)
                setResultCase({ ...resultCase, savedByMe: !resultCase.savedByMe })
                toast.success(resultCase.savedByMe ? "Removed from saved cases" : "Saved to your cases")
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={!!selectedTool} onOpenChange={(open) => !open && setSelectedTool(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedTool?.label}</SheetTitle>
            <SheetDescription>
              Completed in {selectedTool?.durationMs}ms · Auditable evidence only, no hidden reasoning is shown.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4">
            {selectedTool?.evidence.length ? (
              selectedTool.evidence.map((e) => <EvidenceCard key={e.label} evidence={e} />)
            ) : (
              <p className="text-sm text-muted-foreground">This tool contributed to scoring but did not report standalone evidence items.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function IdleView({
  inputType,
  setInputType,
  content,
  setContent,
  txFields,
  setTxFields,
  canInvestigate,
  onStart,
  onExample,
}: {
  inputType: InputType
  setInputType: (t: InputType) => void
  content: string
  setContent: (v: string) => void
  txFields: TransactionFields
  setTxFields: (v: TransactionFields) => void
  canInvestigate: boolean
  onStart: () => void
  onExample: (example: (typeof QUICK_EXAMPLES)[number]) => void
}) {
  return (
    <>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">AI Fraud Investigation</h2>
        <p className="text-sm text-muted-foreground">Let the agent investigate suspicious activity.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {TYPES.map((type) => {
          const Icon = INPUT_TYPE_ICONS[type]
          const active = inputType === type
          return (
            <button
              key={type}
              type="button"
              onClick={() => setInputType(type)}
              className={cn(
                "glass-panel flex flex-col items-center gap-2 rounded-xl px-3 py-4 text-sm font-medium transition-colors",
                active ? "border-primary/60 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5" />
              {INPUT_TYPE_LABELS[type]}
            </button>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Input</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {inputType === "TRANSACTION" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["amount", "Amount (₹)", "48500"],
                  ["merchant", "Merchant", "Unknown Merchant"],
                  ["location", "Location", "Pune"],
                  ["time", "Time", "02:14"],
                  ["device", "Device", "unrecognized / new device"],
                ] as [keyof TransactionFields, string, string][]
              ).map(([key, label, placeholder]) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    placeholder={placeholder}
                    value={txFields[key]}
                    onChange={(e) => setTxFields({ ...txFields, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          ) : (
            <Textarea
              placeholder={inputType === "URL" ? "Enter suspicious URL…" : "Paste suspicious content here…"}
              className="min-h-40"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          )}

          <div className="flex flex-wrap gap-2">
            {QUICK_EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => onExample(ex)}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {ex.label}
              </button>
            ))}
          </div>

          <div className="flex items-start gap-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Never paste passwords, OTPs, bank credentials, or private keys. This is a prototype, not a substitute for
              official cybercrime reporting or your bank&apos;s security systems.
            </span>
          </div>

          <Button size="lg" disabled={!canInvestigate} onClick={onStart} className="self-start">
            <Bot className="size-4.5" />
            Start AI Investigation
          </Button>
        </CardContent>
      </Card>
    </>
  )
}

function RunningView({
  stages,
  tools,
  agentActiveIndex,
  onSelectTool,
}: {
  stages: PipelineStage[]
  tools: ToolExecution[]
  agentActiveIndex: number
  onSelectTool: (tool: ToolExecution) => void
}) {
  return (
    <>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">NetraX Agent is investigating…</h2>
        <p className="text-sm text-muted-foreground">Sit tight — this usually takes a few seconds.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex items-center justify-center py-10 lg:col-span-1">
          <AgentOrb activeIndex={agentActiveIndex} />
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Investigation Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <PipelineStepper stages={stages} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">AI Tools</CardTitle>
            <CardDescription>Only tools relevant to this input type are invoked.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {tools.length === 0 && <p className="text-xs text-muted-foreground">Waiting for tool selection…</p>}
            {tools.map((tool) => (
              <ToolStatusRow key={tool.id} tool={tool} onClick={() => onSelectTool(tool)} />
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function ResultView({
  fraudCase,
  onReset,
  onMarkReviewed,
  onReport,
  onSave,
}: {
  fraudCase: FraudCase
  onReset: () => void
  onMarkReviewed: () => void
  onReport: () => void
  onSave: () => void
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Investigation Result</h2>
          <p className="text-sm text-muted-foreground font-mono">{fraudCase.id}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="size-3.5" />
          New investigation
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col items-center justify-center gap-3 py-8 lg:col-span-1">
          <RiskGauge score={fraudCase.riskScore} level={fraudCase.riskLevel} />
          <p className="text-sm text-muted-foreground">
            {fraudCase.riskLevel === "LOW" ? "No fraud indicators found" : "Likely fraudulent activity"}
          </p>
          <Badge variant="outline">Confidence: {fraudCase.confidence}</Badge>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Risk Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <RiskBreakdown evidence={fraudCase.evidence} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Why Flagged</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {fraudCase.evidence.map((e) => (
            <EvidenceCard key={e.label} evidence={e} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Why This Matters</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{fraudCase.explanation}</p>
        </CardContent>
      </Card>

      <Card className={cn(fraudCase.riskLevel === "HIGH" && "border-risk-high/40")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RiskBadge level={fraudCase.riskLevel} />
            Recommended Action
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2">
            {fraudCase.recommendation.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                {r}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variant={fraudCase.status === "UNDER_REVIEW" ? "secondary" : "outline"} size="sm" onClick={onMarkReviewed}>
              <CheckCircle2 className="size-3.5" />
              {fraudCase.status === "UNDER_REVIEW" ? "Reviewed" : "Mark as Reviewed"}
            </Button>
            <Button variant="outline" size="sm" onClick={onReport}>
              <Flag className="size-3.5" />
              Report
            </Button>
            <Button variant={fraudCase.savedByMe ? "secondary" : "outline"} size="sm" onClick={onSave}>
              <Sparkles className="size-3.5" />
              {fraudCase.savedByMe ? "Saved" : "Save Case"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
