import { ArrowLeft, Bookmark, CheckCircle2, Eye, Flag, ShieldQuestion } from "lucide-react"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { EvidenceCard } from "@/components/app/evidence-card"
import { EvidenceGraphView } from "@/components/app/evidence-graph-view"
import { InvestigationTimeline } from "@/components/app/investigation-timeline"
import { RiskGauge } from "@/components/app/risk-gauge"
import { ToolStatusRow } from "@/components/app/tool-status"
import { RiskBadge } from "@/components/risk-badge"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { toggleSaved, toggleWatchlisted, updateCaseStatus, useCase } from "@/lib/mock/store"
import type { ToolExecution } from "@/types/fraud"

export default function CaseDetailPage() {
  const { id } = useParams()
  const fraudCase = useCase(id)
  const navigate = useNavigate()
  const [selectedTool, setSelectedTool] = useState<ToolExecution | null>(null)

  if (!fraudCase) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ShieldQuestion className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Case not found.</p>
        <Button size="sm" onClick={() => navigate("/cases")}>
          Back to cases
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link to="/cases">
            <ArrowLeft className="size-4" />
            Back to cases
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{fraudCase.id}</p>
            <h2 className="text-xl font-semibold tracking-tight">{fraudCase.category}</h2>
          </div>
          <div className="flex items-center gap-2">
            <RiskBadge level={fraudCase.riskLevel} />
            <StatusBadge status={fraudCase.status} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Input</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="rounded-md bg-muted p-3 font-mono text-sm">{fraudCase.input}</p>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>Type: {fraudCase.inputType}</span>
                <span>Created: {new Date(fraudCase.createdAt).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evidence</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {fraudCase.evidence.map((e) => (
                <EvidenceCard key={e.label} evidence={e} />
              ))}
            </CardContent>
          </Card>

          {fraudCase.evidenceGraph && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evidence Graph</CardTitle>
              </CardHeader>
              <CardContent>
                <EvidenceGraphView graph={fraudCase.evidenceGraph} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Investigation Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <InvestigationTimeline events={fraudCase.timeline} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tools Used</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {fraudCase.toolsUsed.map((tool) => (
                <ToolStatusRow key={tool.id} tool={tool} onClick={() => setSelectedTool(tool)} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{fraudCase.explanation}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="flex flex-col items-center gap-2 py-6">
            <RiskGauge score={fraudCase.riskScore} level={fraudCase.riskLevel} size={140} />
            <Badge variant="outline" className="mt-1">
              Confidence: {fraudCase.confidence}
            </Badge>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recommended Action</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ul className="flex flex-col gap-2">
                {fraudCase.recommendation.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    {r}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Case Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button
                variant={fraudCase.status === "RESOLVED" ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  updateCaseStatus(fraudCase.id, "RESOLVED")
                  toast.success("Case marked resolved")
                }}
              >
                <CheckCircle2 className="size-4" />
                Mark Resolved
              </Button>
              <Button
                variant={fraudCase.status === "FALSE_POSITIVE" ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  updateCaseStatus(fraudCase.id, "FALSE_POSITIVE")
                  toast.success("Case marked as false positive")
                }}
              >
                <ShieldQuestion className="size-4" />
                False Positive
              </Button>
              <Button
                variant={fraudCase.status === "UNDER_REVIEW" ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  updateCaseStatus(fraudCase.id, "UNDER_REVIEW")
                  toast.success("Case sent for review")
                }}
              >
                <Flag className="size-4" />
                Review
              </Button>
              <Button
                variant={fraudCase.savedByMe ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  toggleSaved(fraudCase.id)
                  toast.success(fraudCase.savedByMe ? "Removed from saved cases" : "Saved")
                }}
              >
                <Bookmark className="size-4" />
                {fraudCase.savedByMe ? "Saved" : "Save Case"}
              </Button>
              <Button
                variant={fraudCase.watchlisted ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  toggleWatchlisted(fraudCase.id)
                  toast.success(fraudCase.watchlisted ? "Removed from watchlist" : "Added to watchlist")
                }}
              >
                <Eye className="size-4" />
                {fraudCase.watchlisted ? "Watching" : "Add to Watchlist"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={!!selectedTool} onOpenChange={(open) => !open && setSelectedTool(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedTool?.label}</SheetTitle>
            <SheetDescription>Completed in {selectedTool?.durationMs}ms</SheetDescription>
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
