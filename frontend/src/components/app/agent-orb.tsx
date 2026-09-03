import { motion } from "framer-motion"
import { Bot } from "lucide-react"

import { AGENT_STAGE_LABELS } from "@/lib/mock/tools"
import { cn } from "@/lib/utils"

export function AgentOrb({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative flex size-40 items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--accent-grad-from)] to-[var(--accent-grad-to)] opacity-20 blur-xl"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute inset-2 rounded-full border-2 border-dashed border-primary/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />
        <div className="glass-panel relative flex size-24 items-center justify-center rounded-full">
          <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
            <Bot className="size-9 text-primary" />
          </motion.div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {AGENT_STAGE_LABELS.map((label, i) => (
          <span
            key={label}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide transition-colors",
              i === activeIndex
                ? "border-primary bg-primary/10 text-primary"
                : i < activeIndex
                  ? "border-risk-low/40 bg-risk-low-bg text-risk-low"
                  : "border-border text-muted-foreground",
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
