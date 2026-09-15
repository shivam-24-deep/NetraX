import { motion } from "framer-motion"
import { Bell, CheckCircle2, Mail, RefreshCw, Share2, Smartphone } from "lucide-react"

import { SlideShell } from "../slide-shell"

const SHARE_STEPS = [
  { label: "Open suspicious email in Gmail", icon: Mail },
  { label: "Tap Share → NetraX", icon: Share2 },
  { label: "Real investigation starts instantly", icon: CheckCircle2 },
]

export function Slide12MobileGmail() {
  return (
    <SlideShell eyebrow="Beyond The Browser">
      <div className="grid h-full grid-cols-2 items-center gap-16">
        {/* Mobile share */}
        <div>
          <motion.h2
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-3 text-[38px] leading-tight font-bold tracking-tight text-foreground"
          >
            Share it, don&apos;t
            <br />
            copy-paste it.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-7 text-[16px] text-muted-foreground"
          >
            NetraX registers as a real Android share target — the same "Share" button already on every phone.
          </motion.p>

          <div className="flex flex-col gap-3">
            {SHARE_STEPS.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.5 + i * 0.18 }}
                className="flex items-center gap-4 rounded-lg border border-border bg-surface px-5 py-3.5"
              >
                <step.icon className="size-5 shrink-0 text-primary" />
                <span className="font-mono text-[15px] text-foreground">{step.label}</span>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.3 }}
            className="mt-7 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-5 py-4"
          >
            <Smartphone className="size-6 shrink-0 text-primary" />
            <p className="text-[13px] text-muted-foreground">
              Same real pipeline as the web app — header forensics, URL analysis, threat intel, risk score. No separate
              "mobile version" with weaker analysis.
            </p>
          </motion.div>
        </div>

        {/* Gmail auto-detect */}
        <div>
          <motion.h2
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mb-3 text-[38px] leading-tight font-bold tracking-tight text-foreground"
          >
            NetraX watches.
            <br />
            You don&apos;t have to.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mb-7 text-[16px] text-muted-foreground"
          >
            Connect Gmail once — real OAuth, read-only. NetraX investigates new mail the moment it arrives.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="rounded-xl border border-border bg-surface p-7"
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Mail className="size-5 text-primary" />
                <span className="font-mono text-sm tracking-wide text-muted-foreground uppercase">Gmail Auto-Detect</span>
              </div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "linear", delay: 1.5 }}
              >
                <RefreshCw className="size-4 text-primary/60" />
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.6 }}
              className="flex items-center gap-3 rounded-lg bg-risk-critical-bg px-4 py-3"
            >
              <Bell className="size-5 shrink-0 text-risk-critical" />
              <div>
                <p className="font-mono text-[13px] font-semibold text-risk-critical">New email auto-detected</p>
                <p className="text-[12px] text-muted-foreground">CRITICAL risk — investigated with zero manual action</p>
              </div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.1 }}
              className="mt-5 rounded-md bg-muted/40 px-4 py-3 font-mono text-[12px] text-muted-foreground"
            >
              Only mail that arrives after connecting is ever scanned — never a bulk scan of your mailbox history.
            </motion.p>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5 }}
            className="mt-6 text-[14px] text-muted-foreground"
          >
            From a one-time tool to something that protects continuously — this is the shift from an analyzer to a
            product.
          </motion.p>
        </div>
      </div>
    </SlideShell>
  )
}
