import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

import { SlideShell } from "../slide-shell"

const BEFORE = ["Suspicious Email", "Manual Investigation", "Multiple Tools", "Slow Correlation", "Delayed Decision"]
const AFTER = ["Suspicious Email", "Agentic Investigation", "Correlated Evidence", "Explainable Risk", "Faster Action"]

function Row({ items, tone, delayBase }: { items: string[]; tone: "muted" | "primary"; delayBase: number }) {
  return (
    <div className="flex items-center gap-3.5">
      {items.map((item, i) => (
        <motion.div key={item} className="flex items-center gap-3.5">
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: delayBase + i * 0.18 }}
            className={`rounded-lg border px-6 py-4 font-mono text-[17px] whitespace-nowrap ${
              tone === "primary" ? "border-primary/40 bg-primary/10 text-foreground" : "border-border bg-surface text-muted-foreground"
            }`}
          >
            {item}
          </motion.span>
          {i < items.length - 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delayBase + i * 0.18 + 0.1 }}>
              <ArrowRight className="size-5 text-muted-foreground/40" />
            </motion.div>
          )}
        </motion.div>
      ))}
    </div>
  )
}

export function Slide9Impact() {
  return (
    <SlideShell eyebrow="The Impact">
      <div className="flex h-full flex-col items-center justify-center gap-16">
        <div className="flex flex-col items-start gap-5">
          <span className="font-mono text-[15px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">Before</span>
          <Row items={BEFORE} tone="muted" delayBase={0.3} />
        </div>

        <div className="flex flex-col items-start gap-5">
          <span className="font-mono text-[15px] font-semibold tracking-[0.2em] text-primary uppercase">After</span>
          <Row items={AFTER} tone="primary" delayBase={1.5} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 2.9 }}
          className="mt-4 flex items-center gap-20"
        >
          {["DETECT", "INVESTIGATE", "EXPLAIN"].map((word, i) => (
            <motion.span
              key={word}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.9 + i * 0.2 }}
              className="text-[64px] font-bold tracking-tight text-foreground"
            >
              {word}
            </motion.span>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3.6 }}
          className="text-[17px] text-muted-foreground"
        >
          Every step backed by real code, real models, and 203 passing tests — not a roadmap.
        </motion.p>
      </div>
    </SlideShell>
  )
}
