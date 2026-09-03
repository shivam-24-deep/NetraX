import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import { TrendingDown, TrendingUp } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"

import { useCountUp } from "@/lib/use-count-up"
import { cn } from "@/lib/utils"

export interface MetricCardProps {
  icon: LucideIcon
  label: string
  value: number
  suffix?: string
  trend?: { value: number; direction: "up" | "down" }
  sparkline?: number[]
  tone?: "default" | "high" | "medium" | "low"
}

const TONE_CLASSES: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "text-primary bg-primary/10",
  high: "text-risk-high bg-risk-high-bg",
  medium: "text-risk-medium bg-risk-medium-bg",
  low: "text-risk-low bg-risk-low-bg",
}

const SPARK_COLORS: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "var(--color-primary)",
  high: "var(--color-risk-high)",
  medium: "var(--color-risk-medium)",
  low: "var(--color-risk-low)",
}

export function MetricCard({ icon: Icon, label, value, suffix, trend, sparkline, tone = "default" }: MetricCardProps) {
  const animated = useCountUp(value)
  const gradId = `spark-${label.replace(/\s+/g, "-")}`

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="glass-panel relative flex flex-col gap-3 overflow-hidden rounded-xl p-4"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums">
            {animated.toLocaleString("en-IN")}
            {suffix}
          </p>
        </div>
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONE_CLASSES[tone])}>
          <Icon className="size-4.5" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {trend ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              trend.direction === "up" ? "text-risk-low" : "text-risk-high",
            )}
          >
            {trend.direction === "up" ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {trend.value}%
          </span>
        ) : (
          <span />
        )}
        {sparkline && sparkline.length > 1 && (
          <div className="h-8 w-20">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline.map((v, i) => ({ i, v }))} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SPARK_COLORS[tone]} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={SPARK_COLORS[tone]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={SPARK_COLORS[tone]} strokeWidth={1.5} fill={`url(#${gradId})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  )
}
