import { motion } from "framer-motion"
import { Check, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import type { PipelineStage } from "@/types/fraud"

export function PipelineStepper({ stages }: { stages: PipelineStage[] }) {
  return (
    <div className="flex flex-col gap-0">
      {stages.map((stage, i) => (
        <div key={stage.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors",
                stage.status === "complete" && "border-risk-low bg-risk-low-bg text-risk-low",
                stage.status === "running" && "border-primary bg-primary/10 text-primary",
                stage.status === "waiting" && "border-border text-muted-foreground",
              )}
            >
              {stage.status === "complete" && <Check className="size-3.5" />}
              {stage.status === "running" && <Loader2 className="size-3.5 animate-spin" />}
              {stage.status === "waiting" && i + 1}
            </div>
            {i < stages.length - 1 && (
              <div className="relative w-px flex-1 bg-border">
                {stage.status === "complete" && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "100%" }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-x-0 top-0 w-px bg-risk-low"
                  />
                )}
              </div>
            )}
          </div>
          <div className={cn("pb-5 text-sm", stage.status === "waiting" ? "text-muted-foreground" : "font-medium")}>
            {stage.label}
          </div>
        </div>
      ))}
    </div>
  )
}
