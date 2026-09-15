import { motion } from "framer-motion"
import { Bot, Mail } from "lucide-react"

import { SlideShell } from "../slide-shell"

const MARKERS = [
  { label: "DISPLAY NAME MISMATCH", delay: 0.9 },
  { label: "LOOKALIKE DOMAIN", delay: 1.05 },
  { label: "SUSPICIOUS URL", delay: 1.2 },
  { label: "AUTH ANOMALY", delay: 1.35 },
]

const AGENT_STEPS = ["HEADER", "DOMAIN", "URL", "IP", "THREAT INTEL", "GEO"]

const STATS = [
  { value: "203", label: "Automated tests" },
  { value: "0.961", label: "Model F1 score" },
  { value: "6", label: "Real investigation tools" },
]

export function Slide1Hero() {
  return (
    <SlideShell>
      <div className="grid h-full grid-cols-[1fr_900px] items-center gap-16">
        {/* Left: statement */}
        <div className="flex flex-col justify-center">
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-7 font-mono text-[17px] font-semibold tracking-[0.3em] text-primary uppercase"
          >
            NetraX · SIH 2026 · SIH26106
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-[80px] leading-[1.05] font-bold tracking-tight text-foreground"
          >
            From suspicious
            <br />
            email to <span className="text-primary">forensic
            <br />
            intelligence.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-9 max-w-xl text-[26px] leading-snug text-muted-foreground"
          >
            Agentic AI for email threat detection &amp; forensic intelligence — built for AICTE's Cyber Security Cell.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="mt-12 flex gap-10"
          >
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="font-mono text-[34px] leading-none font-bold text-foreground">{s.value}</p>
                <p className="mt-2 font-mono text-[12px] tracking-wide text-muted-foreground uppercase">{s.label}</p>
              </div>
            ))}
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.8 }}
            className="mt-14 font-mono text-base tracking-[0.15em] text-muted-foreground/70 uppercase"
          >
            Explore Investigation →
          </motion.p>
        </div>

        {/* Right: email -> agent -> risk visual */}
        <div className="relative flex h-[900px] w-[900px] flex-col items-center justify-center">
          {/* Email card */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative w-full rounded-2xl border border-border bg-surface/90 p-8 shadow-2xl backdrop-blur"
          >
            <div className="mb-5 flex items-center gap-2.5 border-b border-border pb-4">
              <Mail className="size-5 text-muted-foreground" />
              <span className="font-mono text-sm text-muted-foreground">Incoming Message</span>
            </div>
            <div className="flex flex-col gap-3 font-mono text-[16px]">
              <p>
                <span className="text-muted-foreground">From:</span>{" "}
                <span className="text-foreground">Microsoft Support</span>{" "}
                <span className="rounded bg-risk-high-bg px-1.5 py-0.5 text-risk-high">support@micr0soft-security.com</span>
              </p>
              <p>
                <span className="text-muted-foreground">Subject:</span>{" "}
                <span className="text-foreground">URGENT: Account Verification Required</span>
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground/80">
                "Your account will be suspended. Verify immediately: {" "}
                <span className="rounded bg-risk-high-bg px-1 text-risk-high">secure-verify-0ffice365.com/reset</span>"
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5">
              {MARKERS.map((m) => (
                <motion.span
                  key={m.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: m.delay }}
                  className="rounded-full border border-risk-high/30 bg-risk-high-bg px-3 py-1.5 font-mono text-[12px] font-semibold tracking-wide text-risk-high"
                >
                  {m.label}
                </motion.span>
              ))}
            </div>
          </motion.div>

          {/* Connector line */}
          <svg className="h-20 w-2 overflow-visible" viewBox="0 0 2 80">
            <motion.line
              x1="1"
              y1="0"
              x2="1"
              y2="80"
              stroke="var(--color-primary)"
              strokeWidth="2"
              strokeDasharray="1 1"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 1.5 }}
            />
          </svg>

          {/* Agent node */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 1.6, type: "spring", stiffness: 200, damping: 18 }}
            className="relative flex items-center gap-3 rounded-full border border-primary/40 bg-primary/10 px-7 py-3.5"
          >
            <Bot className="size-5 text-primary" />
            <span className="font-mono text-sm font-semibold tracking-wide text-primary">NETRAX AGENT</span>
          </motion.div>

          {/* Tool chips */}
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            {AGENT_STEPS.map((step, i) => (
              <motion.span
                key={step}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 1.9 + i * 0.08 }}
                className="rounded-full border border-border bg-surface px-3.5 py-1.5 font-mono text-[12px] tracking-wide text-muted-foreground"
              >
                {step}
              </motion.span>
            ))}
          </div>

          {/* Risk reveal */}
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 2.5 }}
            className="mt-8 flex items-center gap-4 rounded-xl border border-risk-critical/40 bg-risk-critical-bg px-7 py-4"
          >
            <span className="font-mono text-5xl font-bold tabular-nums text-risk-critical">87</span>
            <span className="font-mono text-sm font-semibold tracking-[0.2em] text-risk-critical uppercase">High Risk</span>
          </motion.div>
        </div>
      </div>
    </SlideShell>
  )
}
