import { motion } from "framer-motion"
import { Bot, Check, FileSearch, Globe, Link2, Mail, ShieldAlert, X } from "lucide-react"

import { SlideShell } from "../slide-shell"

const TOOLS = [
  { label: "Email Parser", icon: Mail, angle: -90 },
  { label: "Header Forensics", icon: FileSearch, angle: -30 },
  { label: "URL Analysis", icon: Link2, angle: 30 },
  { label: "Threat Intelligence", icon: ShieldAlert, angle: 90 },
  { label: "IP Geolocation", icon: Globe, angle: 150 },
  { label: "Content Analysis", icon: Mail, angle: 210 },
]

const RADIUS = 320

function polarPos(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: Math.cos(rad) * RADIUS, y: Math.sin(rad) * RADIUS }
}

const RULES = [
  { condition: "URL found in email", action: "URL Analysis + Threat Intelligence run", positive: true },
  { condition: "No URL found", action: "URL Analysis + Threat Intelligence SKIPPED — not called-and-ignored", positive: false },
  { condition: "Public source IP found", action: "Geolocation runs against MaxMind", positive: true },
  { condition: "No public IP (private/reserved filtered)", action: "Geolocation SKIPPED entirely", positive: false },
  { condition: "Sender domain present", action: "Domain intelligence check always runs", positive: true },
]

export function Slide4DynamicInvestigation() {
  return (
    <SlideShell eyebrow="How It Investigates">
      <div className="grid h-full grid-cols-[880px_1fr] items-center gap-14">
        {/* Orbit diagram */}
        <div className="relative flex h-[820px] w-[880px] items-center justify-center">
          <svg className="absolute inset-0" viewBox="-440 -410 880 820">
            {TOOLS.map((tool, i) => {
              const pos = polarPos(tool.angle)
              return (
                <motion.line
                  key={tool.label}
                  x1={0}
                  y1={0}
                  x2={pos.x}
                  y2={pos.y}
                  stroke="var(--color-border)"
                  strokeWidth={2}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.5 + i * 0.12 }}
                />
              )
            })}
          </svg>

          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2, type: "spring", stiffness: 200, damping: 18 }}
            className="relative z-10 flex flex-col items-center gap-2.5 rounded-full border border-primary/40 bg-primary/10 px-10 py-8"
          >
            <Bot className="size-9 text-primary" />
            <span className="font-mono text-sm font-semibold tracking-wide text-primary">NETRAX AGENT</span>
          </motion.div>

          {TOOLS.map((tool, i) => {
            const pos = polarPos(tool.angle)
            return (
              <motion.div
                key={tool.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.7 + i * 0.12 }}
                className="absolute z-10 flex flex-col items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3.5"
                style={{ left: `calc(50% + ${pos.x}px)`, top: `calc(50% + ${pos.y}px)`, transform: "translate(-50%, -50%)" }}
              >
                <tool.icon className="size-5 text-muted-foreground" />
                <span className="font-mono text-[13px] whitespace-nowrap text-muted-foreground">{tool.label}</span>
              </motion.div>
            )
          })}
        </div>

        {/* Rules */}
        <div className="flex flex-col gap-3">
          <motion.h2
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-3 text-[38px] leading-[1.15] font-bold tracking-tight text-foreground"
          >
            Dynamic tool selection —<br />not everything, every time.
          </motion.h2>
          {RULES.map((rule, i) => (
            <motion.div
              key={rule.condition}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 1.9 + i * 0.18 }}
              className="flex items-start gap-3 rounded-lg border border-border bg-surface px-5 py-3.5"
            >
              {rule.positive ? (
                <Check className="mt-0.5 size-5 shrink-0 text-risk-low" />
              ) : (
                <X className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              )}
              <div>
                <p className="font-mono text-[15px] font-medium text-foreground">{rule.condition}</p>
                <p className="text-[13px] text-muted-foreground">{rule.action}</p>
              </div>
            </motion.div>
          ))}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.9 }}
            className="mt-3 font-mono text-[13px] tracking-wide text-muted-foreground/70"
          >
            Verified by automated tests — every skip is logged with a reason, not silent.
          </motion.p>
        </div>
      </div>
    </SlideShell>
  )
}
