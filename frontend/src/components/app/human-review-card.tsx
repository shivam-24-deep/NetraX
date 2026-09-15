import { AlertTriangle, MessageSquarePlus, ShieldCheck, ShieldX, TrendingUp } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { addCaseFeedback } from "@/lib/mock/store"
import type { CaseFeedbackAction, FraudCase } from "@/types/fraud"

const ACTION_LABEL: Record<CaseFeedbackAction, string> = {
  CONFIRM_THREAT: "Confirmed as threat",
  FALSE_POSITIVE: "Marked false positive",
  ESCALATE: "Escalated",
  NOTE: "Note added",
}

/** SIH26106 §25 — only for HIGH/CRITICAL cases. Records analyst feedback; never performs a destructive action automatically. */
export function HumanReviewCard({ fraudCase }: { fraudCase: FraudCase }) {
  const [note, setNote] = useState("")

  function record(action: CaseFeedbackAction, noteText?: string) {
    addCaseFeedback(fraudCase.id, action, noteText)
    toast.success(ACTION_LABEL[action])
    if (action === "NOTE") setNote("")
  }

  return (
    <Card className="border-risk-high/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-risk-high" />
          Human-in-the-Loop Review
        </CardTitle>
        <CardDescription>This case scored {fraudCase.riskLevel} — an analyst decision is recorded here, nothing is done automatically.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => record("CONFIRM_THREAT")}>
            <ShieldCheck className="size-3.5" />
            Confirm Threat
          </Button>
          <Button variant="outline" size="sm" onClick={() => record("FALSE_POSITIVE")}>
            <ShieldX className="size-3.5" />
            False Positive
          </Button>
          <Button variant="outline" size="sm" onClick={() => record("ESCALATE")}>
            <TrendingUp className="size-3.5" />
            Escalate
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <Textarea
            placeholder="Add an analyst note…"
            className="min-h-20 text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button variant="secondary" size="sm" disabled={note.trim() === ""} onClick={() => record("NOTE", note.trim())} className="self-start">
            <MessageSquarePlus className="size-3.5" />
            Add Note
          </Button>
        </div>

        {fraudCase.feedback && fraudCase.feedback.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">Review history</p>
            {fraudCase.feedback
              .slice()
              .reverse()
              .map((f, i) => (
                <div key={i} className="text-xs">
                  <span className="font-medium">{ACTION_LABEL[f.action]}</span>
                  <span className="text-muted-foreground"> — {new Date(f.timestamp).toLocaleString()}</span>
                  {f.note && <p className="mt-0.5 text-muted-foreground">{f.note}</p>}
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
