import { motion } from "framer-motion"
import { Check, ExternalLink, X } from "lucide-react"
import { Link } from "react-router-dom"

import { RiskBadge } from "@/components/risk-badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { FraudCase } from "@/types/fraud"

const BORDER_TONE: Record<FraudCase["riskLevel"], string> = {
  HIGH: "border-l-risk-high",
  MEDIUM: "border-l-risk-medium",
  LOW: "border-l-risk-low",
}

export function AlertCard({
  fraudCase,
  onDismiss,
  onReview,
}: {
  fraudCase: FraudCase
  onDismiss?: () => void
  onReview?: () => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className={cn("glass-panel flex flex-col gap-3 rounded-xl border-l-4 p-4 sm:flex-row sm:items-center", BORDER_TONE[fraudCase.riskLevel])}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <RiskBadge level={fraudCase.riskLevel} />
          <span className="text-xs text-muted-foreground">{fraudCase.category}</span>
        </div>
        <p className="truncate text-sm font-medium">{fraudCase.input}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {fraudCase.inputType} · {new Date(fraudCase.createdAt).toLocaleString()} ·{" "}
          <span className="font-mono">{fraudCase.id}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onReview && fraudCase.status === "OPEN" && (
          <Button variant="outline" size="sm" onClick={onReview}>
            <Check className="size-3.5" />
            Mark reviewed
          </Button>
        )}
        {onDismiss && (
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            <X className="size-3.5" />
            Dismiss
          </Button>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link to={`/cases/${fraudCase.id}`}>
            <ExternalLink className="size-3.5" />
            Open
          </Link>
        </Button>
      </div>
    </motion.div>
  )
}
