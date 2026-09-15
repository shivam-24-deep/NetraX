import { motion } from "framer-motion"
import { AlertTriangle, Briefcase, CreditCard, KeyRound, Landmark, Package } from "lucide-react"

import { SlideShell } from "../slide-shell"

const INBOX = [
  { icon: Briefcase, label: "CEO request", preview: "Need this handled today, urgent." },
  { icon: CreditCard, label: "Invoice #88213", preview: "Payment overdue — review attached." },
  { icon: AlertTriangle, label: "Security alert", preview: "Unusual sign-in detected." },
  { icon: Landmark, label: "Bank notification", preview: "Statement ready to view." },
  { icon: KeyRound, label: "Password reset", preview: "Reset requested for your account." },
  { icon: Package, label: "Delivery notice", preview: "Package could not be delivered." },
]

const SIGNALS = [
  { label: "Sender spoofing", detail: "Display name says one thing, address says another" },
  { label: "Lookalike domain", detail: "micr0soft-security.com, not microsoft.com" },
  { label: "Reply-To mismatch", detail: "Replies route to a different domain entirely" },
  { label: "Urgent language", detail: "Manufactured time pressure to short-circuit judgment" },
  { label: "Suspicious link", detail: "Destination hides behind display text" },
]

export function Slide2Threat() {
  return (
    <SlideShell eyebrow="The Threat">
      <div className="grid h-full grid-cols-[620px_1fr] items-center gap-20">
        {/* Inbox mock */}
        <div className="flex flex-col gap-2.5">
          {INBOX.map((item, i) => {
            const isSuspicious = i === 2
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
                className={`flex items-center gap-3.5 rounded-lg border px-5 py-4 ${
                  isSuspicious ? "border-risk-high/50 bg-risk-high-bg" : "border-border bg-surface"
                }`}
              >
                <item.icon className={`size-5 shrink-0 ${isSuspicious ? "text-risk-high" : "text-muted-foreground"}`} />
                <div className="min-w-0">
                  <p className={`font-mono text-[15px] font-medium ${isSuspicious ? "text-risk-high" : "text-foreground"}`}>{item.label}</p>
                  <p className="truncate text-[13px] text-muted-foreground">{item.preview}</p>
                </div>
                {isSuspicious && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.3 }}
                    className="ml-auto shrink-0 font-mono text-[11px] font-semibold tracking-wide text-risk-high uppercase"
                  >
                    Flagged
                  </motion.span>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Statement + signals */}
        <div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}>
            <h2 className="text-[54px] leading-[1.12] font-bold tracking-tight text-foreground">
              Today's attacks don't
              <br />
              always <span className="text-risk-high">look malicious.</span>
            </h2>
            <p className="mt-7 max-w-lg text-[22px] leading-snug text-muted-foreground">
              Attackers exploit identity, infrastructure and human trust — not just malicious keywords.
            </p>
          </motion.div>

          <div className="mt-10 flex flex-col gap-2.5">
            {SIGNALS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 1.6 + i * 0.15 }}
                className="flex items-baseline gap-3 rounded-lg border border-risk-high/25 bg-risk-high-bg/60 px-4 py-2.5"
              >
                <span className="font-mono text-[13px] font-semibold whitespace-nowrap text-risk-high">{s.label}</span>
                <span className="text-[13px] text-muted-foreground">{s.detail}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </SlideShell>
  )
}
