import { motion } from "framer-motion"
import { CheckCircle2, Loader2 } from "lucide-react"

import { TOOL_ICONS } from "@/lib/mock/tools"
import { cn } from "@/lib/utils"
import type { ToolExecution } from "@/types/fraud"

export function ToolStatusRow({ tool, onClick }: { tool: ToolExecution; onClick?: () => void }) {
  const Icon = TOOL_ICONS[tool.id]

  return (
    <motion.button
      type="button"
      onClick={tool.status === "completed" ? onClick : undefined}
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-3 text-left transition-colors",
        tool.status === "completed" && "hover:bg-surface-2",
      )}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          tool.status === "completed" && "bg-risk-low-bg text-risk-low",
          tool.status === "running" && "bg-primary/10 text-primary",
          tool.status === "pending" && "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{tool.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {tool.status === "pending" && "Waiting"}
          {tool.status === "running" && "Executing…"}
          {tool.status === "completed" && tool.summary}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {tool.status === "completed" && tool.durationMs !== undefined && (
          <span className="font-mono text-[11px] text-muted-foreground">{tool.durationMs}ms</span>
        )}
        {tool.status === "running" && <Loader2 className="size-4 animate-spin text-primary" />}
        {tool.status === "completed" && <CheckCircle2 className="size-4 text-risk-low" />}
      </div>
    </motion.button>
  )
}
