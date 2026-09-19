import { motion, useReducedMotion } from "framer-motion"
import { CheckCircle2, FileText } from "lucide-react"

const items = ["Evidence correlated", "Case intelligence generated"]

export function ForensicReportPreview() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <motion.div
          animate={prefersReducedMotion ? undefined : { opacity: [1, 0.55, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <CheckCircle2 className="text-risk-low size-4 shrink-0" />
        </motion.div>
        <span className="text-sm font-medium">Investigation complete</span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <motion.li
            key={item}
            initial={prefersReducedMotion ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.15 * i, duration: 0.3 }}
            className="text-muted-foreground text-sm"
          >
            {item}
          </motion.li>
        ))}
      </ul>

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: prefersReducedMotion ? 0 : 0.4, duration: 0.35 }}
        className="border-border/60 mt-1 flex items-center gap-2.5 rounded-lg border bg-primary/5 px-3 py-2.5"
      >
        <FileText className="text-primary size-4 shrink-0" />
        <span className="text-sm font-semibold">Forensic report ready</span>
      </motion.div>
    </div>
  )
}
