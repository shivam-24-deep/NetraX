import { motion } from "framer-motion"

import { INVESTIGATION_STEPS } from "@/lib/investigation-sequence"
import { cn } from "@/lib/utils"

export function InvestigationMiniStepper({ currentIndex }: { currentIndex: number }) {
  return (
    <div className="flex items-center gap-1">
      {INVESTIGATION_STEPS.map((step, i) => (
        <div
          key={step.id}
          className={cn(
            "h-1 flex-1 overflow-hidden rounded-full",
            i <= currentIndex ? "bg-primary/20" : "bg-border",
          )}
        >
          {i < currentIndex && <div className="bg-primary h-full w-full" />}
          {i === currentIndex && (
            <motion.div
              className="bg-primary h-full"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: step.dwellMs === Infinity ? 0.4 : step.dwellMs / 1000, ease: "linear" }}
            />
          )}
        </div>
      ))}
    </div>
  )
}
