import { motion } from "framer-motion"
import { Code2, Mail, Radar } from "lucide-react"

import { SlideShell } from "../slide-shell"

const TEAM_LINKS = [
  { icon: Mail, label: "Team contact on request" },
  { icon: Code2, label: "Source available for review" },
]

export function Slide11ThankYou() {
  return (
    <SlideShell>
      <div className="flex h-full flex-col items-center justify-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 180, damping: 16 }}
          className="mb-8 flex size-20 items-center justify-center rounded-full border border-primary/40 bg-primary/10"
        >
          <Radar className="size-9 text-primary" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-[84px] leading-none font-bold tracking-tight text-foreground"
        >
          Thank you.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="mt-8 max-w-2xl text-[24px] leading-snug text-muted-foreground"
        >
          NetraX — agentic AI for email threat detection &amp; forensic intelligence, built for SIH26106.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-12 flex items-center gap-10"
        >
          {[
            { value: "203", label: "Real tests" },
            { value: "10", label: "Real pipeline layers" },
            { value: "6", label: "Real investigation tools" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-mono text-[36px] leading-none font-bold text-primary">{s.value}</p>
              <p className="mt-2 font-mono text-[12px] tracking-wide text-muted-foreground uppercase">{s.label}</p>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.1 }}
          className="mt-14 flex items-center gap-8 text-[14px] text-muted-foreground/70"
        >
          {TEAM_LINKS.map((link) => (
            <span key={link.label} className="flex items-center gap-2">
              <link.icon className="size-4" />
              {link.label}
            </span>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.4 }}
          className="mt-10 font-mono text-sm tracking-[0.3em] text-muted-foreground/50 uppercase"
        >
          Questions welcome — SIH 2026 · SIH26106
        </motion.p>
      </div>
    </SlideShell>
  )
}
