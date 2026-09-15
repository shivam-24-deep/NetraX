import { AlertTriangle, ChevronDown, Info, ShieldAlert } from "lucide-react"
import { useState } from "react"

import { RiskBadge } from "@/components/risk-badge"
import { cn } from "@/lib/utils"
import type { Evidence } from "@/types/fraud"

const SEVERITY_ICON = {
  CRITICAL: ShieldAlert,
  HIGH: ShieldAlert,
  MEDIUM: AlertTriangle,
  LOW: Info,
} as const

export function EvidenceCard({ evidence }: { evidence: Evidence }) {
  const [open, setOpen] = useState(false)
  const Icon = SEVERITY_ICON[evidence.severity]

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
      >
        <Icon
          className={cn(
            "size-4 shrink-0",
            evidence.severity === "HIGH" && "text-risk-high",
            evidence.severity === "MEDIUM" && "text-risk-medium",
            evidence.severity === "LOW" && "text-risk-low",
          )}
        />
        <span className="min-w-0 flex-1 text-sm">{evidence.label}</span>
        <RiskBadge level={evidence.severity} />
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex flex-col gap-1 border-t border-border px-3.5 py-3 text-xs text-muted-foreground">
          <p>
            Source: <span className="text-foreground">{evidence.source}</span>
          </p>
          <p>{evidence.detail ?? `Detected by ${evidence.source} during automated evidence collection.`}</p>
        </div>
      )}
    </div>
  )
}
