import { motion } from "framer-motion"

import { useCountUp } from "@/lib/use-count-up"
import { cn } from "@/lib/utils"
import type { RiskLevel } from "@/types/fraud"

const RISK_COLOR: Record<RiskLevel, string> = {
  HIGH: "var(--color-risk-high)",
  MEDIUM: "var(--color-risk-medium)",
  LOW: "var(--color-risk-low)",
}

const RISK_TEXT: Record<RiskLevel, string> = {
  HIGH: "text-risk-high",
  MEDIUM: "text-risk-medium",
  LOW: "text-risk-low",
}

export function RiskGauge({ score, level, size = 176 }: { score: number; level: RiskLevel; size?: number }) {
  const animated = useCountUp(score, 1000)
  const radius = (size - 20) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={10}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={RISK_COLOR[level]}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn("text-4xl font-bold tabular-nums", RISK_TEXT[level])}>{animated}%</span>
        <span className={cn("mt-1 text-xs font-semibold tracking-wide uppercase", RISK_TEXT[level])}>{level} risk</span>
      </div>
    </div>
  )
}
