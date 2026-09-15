import { motion } from "framer-motion"
import { ArrowDown, X } from "lucide-react"

import { SlideShell } from "../slide-shell"

const NETRAX_STEPS = [
  { label: "Email", detail: "Raw .eml, pasted text, or JSON" },
  { label: "Agent", detail: "Decides which tools this email actually needs" },
  { label: "Investigate", detail: "Headers, domain, URL, IP, threat intel" },
  { label: "Correlate", detail: "Deterministic evidence fusion, no guessing" },
  { label: "Explain", detail: "Every reason traces to real evidence" },
  { label: "Act", detail: "Recommended action, analyst review for high risk" },
]

function StepColumn({
  title,
  subtitle,
  steps,
  tone,
  delayBase,
  endBadge,
}: {
  title: string
  subtitle: string
  steps: { label: string; detail: string }[]
  tone: "muted" | "primary"
  delayBase: number
  endBadge?: { label: string; variant: "stop" | "go" }
}) {
  return (
    <div className="flex flex-col items-center">
      <p
        className={`font-mono text-base font-semibold tracking-[0.25em] uppercase ${
          tone === "primary" ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {title}
      </p>
      <p className="mt-2 mb-5 text-[13px] text-muted-foreground/70">{subtitle}</p>
      <div className="flex flex-col items-center gap-2">
        {steps.map((step, i) => (
          <motion.div key={step.label} className="flex flex-col items-center gap-2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: delayBase + i * 0.35 }}
              className={`flex flex-col items-center rounded-lg border px-9 py-2.5 ${
                tone === "primary" ? "border-primary/40 bg-primary/10 text-foreground" : "border-border bg-surface text-muted-foreground"
              }`}
            >
              <span className="font-mono text-[18px]">{step.label}</span>
              <span className="mt-0.5 text-[11px] text-muted-foreground/70">{step.detail}</span>
            </motion.div>
            {i < steps.length - 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: delayBase + i * 0.35 + 0.2 }}
              >
                <ArrowDown className="size-4 text-muted-foreground/50" />
              </motion.div>
            )}
          </motion.div>
        ))}
        {endBadge && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: delayBase + steps.length * 0.35 + 0.1 }}
            className={`mt-2.5 flex items-center gap-2 rounded-full px-5 py-2 font-mono text-[13px] font-semibold tracking-wide uppercase ${
              endBadge.variant === "stop" ? "bg-risk-medium-bg text-risk-medium" : "bg-risk-low-bg text-risk-low"
            }`}
          >
            {endBadge.variant === "stop" && <X className="size-3.5" />}
            {endBadge.label}
          </motion.div>
        )}
      </div>
    </div>
  )
}

export function Slide3Shift() {
  return (
    <SlideShell eyebrow="The Shift">
      <div className="flex h-full flex-col justify-center">
        <div className="grid grid-cols-2 gap-24">
          <StepColumn
            title="Traditional Detection"
            subtitle="One model, one label, done"
            steps={[
              { label: "Email", detail: "Free text in" },
              { label: "Classifier", detail: "A single probability score" },
            ]}
            tone="muted"
            delayBase={0.3}
            endBadge={{ label: "“Suspicious” — then what?", variant: "stop" }}
          />
          <StepColumn
            title="NetraX"
            subtitle="An agent that investigates, not just scores"
            steps={NETRAX_STEPS}
            tone="primary"
            delayBase={0.5}
            endBadge={{ label: "Explained, evidence-backed action", variant: "go" }}
          />
        </div>

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 3.2 }}
          className="mt-8 text-center text-[46px] leading-tight font-bold tracking-tight text-foreground"
        >
          Detection tells you <span className="text-muted-foreground">WHAT</span>.
          <br />
          NetraX investigates <span className="text-primary">WHY</span>.
        </motion.h2>
      </div>
    </SlideShell>
  )
}
