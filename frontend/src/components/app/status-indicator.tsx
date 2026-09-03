import { cn } from "@/lib/utils"

export type StatusTone = "good" | "warn" | "bad" | "neutral"

const TONE_DOT: Record<StatusTone, string> = {
  good: "bg-risk-low",
  warn: "bg-risk-medium",
  bad: "bg-risk-high",
  neutral: "bg-muted-foreground",
}

export function StatusIndicator({
  label,
  detail,
  tone = "good",
  pulse = true,
  className,
}: {
  label: string
  detail?: string
  tone?: StatusTone
  pulse?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="relative flex size-2">
        {pulse && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", TONE_DOT[tone])} />
        )}
        <span className={cn("relative inline-flex size-2 rounded-full", TONE_DOT[tone])} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{label}</p>
        {detail && <p className="truncate text-[11px] text-muted-foreground">{detail}</p>}
      </div>
    </div>
  )
}
