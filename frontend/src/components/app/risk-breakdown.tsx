import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import type { Evidence } from "@/types/fraud"

const SEVERITY_WIDTH: Record<Evidence["severity"], number> = { CRITICAL: 100, HIGH: 92, MEDIUM: 58, LOW: 22 }
const SEVERITY_BAR: Record<Evidence["severity"], string> = {
  CRITICAL: "bg-risk-critical",
  HIGH: "bg-risk-high",
  MEDIUM: "bg-risk-medium",
  LOW: "bg-risk-low",
}
const SEVERITY_TEXT: Record<Evidence["severity"], string> = {
  CRITICAL: "text-risk-critical",
  HIGH: "text-risk-high",
  MEDIUM: "text-risk-medium",
  LOW: "text-risk-low",
}

export function RiskBreakdown({ evidence }: { evidence: Evidence[] }) {
  return (
    <div className="flex flex-col gap-3">
      {evidence.map((e, i) => (
        <div key={e.label} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate">{e.label}</span>
            <span className={cn("shrink-0 font-semibold", SEVERITY_TEXT[e.severity])}>{e.severity}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className={cn("h-full rounded-full", SEVERITY_BAR[e.severity])}
              initial={{ width: 0 }}
              animate={{ width: `${SEVERITY_WIDTH[e.severity]}%` }}
              transition={{ duration: 0.6, delay: i * 0.06, ease: "easeOut" }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
