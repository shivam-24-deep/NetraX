import { Loader2, Mail, Network, ShieldAlert } from "lucide-react"

import { EvidenceGraphView } from "@/components/app/evidence-graph-view"
import { InvestigationTimeline } from "@/components/app/investigation-timeline"
import { PipelineStepper } from "@/components/app/pipeline-stepper"
import { RiskGauge } from "@/components/app/risk-gauge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { EvidenceGraph, PipelineStage, RiskLevel, TimelineEvent, ToolExecution } from "@/types/fraud"

interface InvestigationControlRoomProps {
  submittedEmail: string
  emailSubject?: string
  stages: PipelineStage[]
  events: TimelineEvent[]
  tools: ToolExecution[]
  risk: { score: number; level: RiskLevel } | null
  evidenceGraph?: EvidenceGraph
}

/** SOC-style control room: left = submitted email, center = timeline, right = risk summary, bottom = evidence graph. */
export function InvestigationControlRoom({ submittedEmail, emailSubject, stages, events, tools, risk, evidenceGraph }: InvestigationControlRoomProps) {
  const findingCount = tools.reduce((sum, t) => sum + t.evidence.length, 0)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="py-4">
          <PipelineStepper stages={stages} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="size-4 text-muted-foreground" />
              Submitted Email
            </CardTitle>
            {emailSubject && <CardDescription className="truncate">{emailSubject}</CardDescription>}
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-[11px] whitespace-pre-wrap break-all">{submittedEmail}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Investigation Timeline</CardTitle>
            <CardDescription>Auditable actions and results only — no internal reasoning is shown.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-96 overflow-auto">
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground">Waiting for the first event…</p>
            ) : (
              <InvestigationTimeline events={events} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="size-4 text-muted-foreground" />
              Risk &amp; Threat Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 py-2">
            {risk ? (
              <RiskGauge score={risk.score} level={risk.level} size={120} />
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
                <p className="text-xs">Calculating risk score…</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{findingCount} finding(s) collected so far</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="size-4 text-muted-foreground" />
            Evidence Graph
          </CardTitle>
          <CardDescription>Built only from evidence actually correlated in this investigation.</CardDescription>
        </CardHeader>
        <CardContent>
          {evidenceGraph ? (
            <EvidenceGraphView graph={evidenceGraph} />
          ) : (
            <p className="text-sm text-muted-foreground">Evidence graph will appear once correlation completes.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
