import { motion } from "framer-motion"
import { Globe, HelpCircle, MapPin, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react"

import { SlideShell } from "../slide-shell"

const STATES = [
  { label: "MATCH", detail: "Confirmed by the provider — treated as high-confidence evidence", icon: ShieldX, tone: "text-risk-critical bg-risk-critical-bg border-risk-critical/30" },
  { label: "NOT FOUND", detail: "This source has no record — not a clean bill of health", icon: HelpCircle, tone: "text-muted-foreground bg-muted/40 border-border" },
  { label: "UNAVAILABLE", detail: "Credentials missing or provider unreachable — reported honestly", icon: ShieldAlert, tone: "text-risk-medium bg-risk-medium-bg border-risk-medium/30" },
]

export function Slide8ThreatIntelGeo() {
  return (
    <SlideShell eyebrow="Threat Intelligence & Geolocation">
      <div className="grid h-full grid-cols-2 gap-16 items-center">
        {/* Threat intel */}
        <div>
          <motion.h2
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-3 text-[38px] leading-tight font-bold tracking-tight text-foreground"
          >
            External confirmation,
            <br />
            honestly reported.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-7 text-[16px] text-muted-foreground"
          >
            Two live threat-intelligence providers, three possible outcomes — never a fabricated fourth.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-7 flex items-center gap-3 font-mono text-base text-muted-foreground"
          >
            <span className="rounded-md border border-border bg-surface px-4 py-2">PhishTank</span>
            <span className="rounded-md border border-border bg-surface px-4 py-2">URLhaus</span>
          </motion.div>

          <div className="flex flex-col gap-3">
            {STATES.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.6 + i * 0.15 }}
                className={`flex items-center gap-4 rounded-lg border px-5 py-3.5 ${s.tone}`}
              >
                <s.icon className="size-5 shrink-0" />
                <div>
                  <span className="font-mono text-sm font-semibold tracking-wide">{s.label}</span>
                  <p className="text-[12px] opacity-80">{s.detail}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.3 }}
            className="mt-7 rounded-lg border border-primary/30 bg-primary/5 px-5 py-4"
          >
            <p className="font-mono text-lg font-semibold text-primary">"NOT FOUND" ≠ "SAFE"</p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              A missing match means this source has no record — never presented as a clean bill of health.
            </p>
          </motion.div>
        </div>

        {/* Geolocation */}
        <div>
          <motion.h2
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mb-3 text-[38px] leading-tight font-bold tracking-tight text-foreground"
          >
            Infrastructure,
            <br />
            not identity.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mb-7 text-[16px] text-muted-foreground"
          >
            Every public IP found in the delivery chain gets enriched — approximately, honestly.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="rounded-xl border border-border bg-surface p-7"
          >
            <div className="mb-5 flex items-center gap-2.5">
              <Globe className="size-5 text-primary" />
              <span className="font-mono text-sm tracking-wide text-muted-foreground uppercase">MaxMind GeoLite</span>
            </div>
            <div className="flex items-center gap-4">
              <MapPin className="size-10 text-primary" />
              <div>
                <p className="font-mono text-lg text-foreground">185.220.101.7</p>
                <p className="text-[14px] text-muted-foreground">AS-EXAMPLE-NET · Region: Eastern Europe (approx.)</p>
              </div>
            </div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3 }}
              className="mt-5 rounded-md bg-muted/40 px-4 py-3 font-mono text-[13px] text-muted-foreground"
            >
              "Approximate infrastructure geolocation" — never an exact address, never an attacker's identity.
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.7 }}
            className="mt-6 flex items-center gap-2.5 text-[14px] text-muted-foreground"
          >
            <ShieldCheck className="size-5 shrink-0 text-risk-low" />
            Private/reserved/loopback IPs are filtered by real CIDR classification before any lookup runs.
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.0 }}
            className="mt-3 flex items-center gap-2.5 text-[14px] text-muted-foreground"
          >
            <ShieldCheck className="size-5 shrink-0 text-risk-low" />
            No URL in the email is ever fetched — indicators are analyzed as strings only.
          </motion.div>
        </div>
      </div>
    </SlideShell>
  )
}
