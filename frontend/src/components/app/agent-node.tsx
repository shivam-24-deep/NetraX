import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type AgentNodeStatus = "idle" | "active" | "complete"

export function AgentNode({
  icon: Icon,
  label,
  sublabel,
  status,
  onClick,
  size = "md",
}: {
  icon: LucideIcon
  label: string
  sublabel?: string
  status: AgentNodeStatus
  onClick?: () => void
  size?: "md" | "lg"
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "glass-panel relative flex flex-col items-center gap-1.5 rounded-xl px-4 py-3 text-center transition-colors",
        size === "lg" ? "min-w-40" : "min-w-32",
        status === "active" && "border-primary/50 ring-2 ring-primary/30",
        status === "complete" && "border-risk-low/40",
      )}
    >
      {status === "active" && (
        <span className="absolute inset-0 -z-10 animate-pulse rounded-xl bg-primary/10" />
      )}
      <div
        className={cn(
          "flex items-center justify-center rounded-lg",
          size === "lg" ? "size-11" : "size-9",
          status === "idle" && "bg-muted text-muted-foreground",
          status === "active" && "bg-primary/15 text-primary",
          status === "complete" && "bg-risk-low-bg text-risk-low",
        )}
      >
        <Icon className={size === "lg" ? "size-5.5" : "size-4.5"} />
      </div>
      <div>
        <p className="text-xs font-semibold">{label}</p>
        {sublabel && <p className="text-[10px] text-muted-foreground">{sublabel}</p>}
      </div>
    </motion.button>
  )
}
