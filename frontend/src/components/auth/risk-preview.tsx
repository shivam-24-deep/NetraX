import { motion } from "framer-motion"

import { useCountUp } from "@/lib/use-count-up"

const FINDINGS = [
  { label: "Critical", count: 1, className: "text-risk-critical" },
  { label: "High", count: 3, className: "text-risk-high" },
  { label: "Medium", count: 2, className: "text-risk-medium" },
]

export function RiskPreview() {
  const score = useCountUp(89, 900)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Forensic risk
          </span>
          <span className="text-risk-critical text-3xl font-bold tabular-nums">{score} / 100</span>
        </div>
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
          className="bg-risk-critical-bg text-risk-critical rounded-md px-2 py-1 text-xs font-semibold tracking-wide uppercase"
        >
          Critical
        </motion.span>
      </div>

      <div className="flex items-center gap-4">
        {FINDINGS.map((f) => (
          <div key={f.label} className="flex items-baseline gap-1.5">
            <span className={`text-lg font-semibold tabular-nums ${f.className}`}>{f.count}</span>
            <span className="text-muted-foreground text-xs">{f.label}</span>
          </div>
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        Demo / synthetic investigation — not a live model output.
      </p>
    </div>
  )
}
