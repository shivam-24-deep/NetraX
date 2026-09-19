import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { AlertTriangle, Check, Mail } from "lucide-react"
import type { ReactNode } from "react"

import { EvidenceGraphPreview } from "@/components/auth/evidence-graph-preview"
import { ForensicReportPreview } from "@/components/auth/forensic-report-preview"
import { InvestigationMiniStepper } from "@/components/auth/investigation-mini-stepper"
import { RiskPreview } from "@/components/auth/risk-preview"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { INVESTIGATION_STEPS, type InvestigationStepId } from "@/lib/investigation-sequence"
import { cn } from "@/lib/utils"

const stepFade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
}

const listStagger = {
  animate: { transition: { staggerChildren: 0.12 } },
}

const listItem = {
  initial: { opacity: 0, x: -6 },
  animate: { opacity: 1, x: 0 },
}

function Field({ label, value, mono, warn }: { label: string; value: ReactNode; mono?: boolean; warn?: boolean }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-start gap-x-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("truncate", mono && "font-mono text-xs", warn && "text-risk-high")}>{value}</dd>
    </div>
  )
}

function ChecklistLine({ children }: { children: ReactNode }) {
  return (
    <motion.li variants={listItem} className="text-risk-low flex items-center gap-2 text-sm">
      <Check className="size-3.5 shrink-0" />
      <span className="text-foreground">{children}</span>
    </motion.li>
  )
}

function ToolStatus({ name, state }: { name: string; state: "checking" | "no-match" | "match" }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground font-mono text-xs">{name}</span>
      {state === "checking" && (
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span className="bg-muted-foreground size-1.5 animate-pulse rounded-full" />
          Checking…
        </span>
      )}
      {state === "no-match" && <span className="text-risk-low text-xs font-medium">No match found</span>}
      {state === "match" && <span className="text-risk-critical text-xs font-medium">Match found</span>}
    </div>
  )
}

function StepDetail({ step }: { step: InvestigationStepId }) {
  switch (step) {
    case "email":
      return (
        <motion.div key="email" {...stepFade} className="text-muted-foreground text-sm">
          Awaiting analysis…
        </motion.div>
      )

    case "headers":
      return (
        <motion.ul key="headers" variants={listStagger} initial="initial" animate="animate" className="flex flex-col gap-1.5">
          <ChecklistLine>Headers extracted</ChecklistLine>
          <ChecklistLine>Body analyzed</ChecklistLine>
          <ChecklistLine>URLs extracted</ChecklistLine>
        </motion.ul>
      )

    case "sender":
      return (
        <motion.div key="sender" {...stepFade} className="flex flex-col gap-2">
          <Field label="From" mono value="security@paypa1-support.example" />
          <Field label="Reply-To" mono warn value="support@paypal-verify.example" />
          <Field label="Return-Path" mono value="bounce@mailrelay.example" />
          <p className="text-risk-high mt-1 flex items-center gap-1.5 text-xs">
            <AlertTriangle className="size-3.5 shrink-0" />
            Reply-To domain does not match From domain
          </p>
        </motion.div>
      )

    case "url":
      return (
        <motion.div key="url" {...stepFade} className="flex flex-col gap-2">
          <Field label="URL" mono value="paypa1-support.example/secure/verify" />
          <Field label="Domain" mono value="paypa1-support.example" />
          <Field label="HTTPS" value="Yes" />
          <Field label="Punycode" value="No" />
          <Field label="Similarity" warn value="83% similar to paypal.com" />
        </motion.div>
      )

    case "threat-intel":
      return (
        <motion.div key="threat-intel" {...stepFade} className="flex flex-col gap-2">
          <ToolStatus name="PhishTank" state="no-match" />
          <ToolStatus name="URLhaus" state="match" />
          <p className="text-muted-foreground text-xs">Demo/synthetic lookups — not live intelligence feeds.</p>
        </motion.div>
      )

    case "infrastructure":
      return (
        <motion.div key="infrastructure" {...stepFade} className="flex flex-col gap-2">
          <Field label="Public IP" mono value="203.0.113.42" />
          <Field label="ASN" mono value="AS64512" />
          <Field label="Organization" value="Example Hosting Ltd." />
          <Field label="Geo" value="Approximate infrastructure geolocation: Frankfurt, DE" />
        </motion.div>
      )

    case "evidence":
      return (
        <motion.div key="evidence" {...stepFade} className="h-full">
          <EvidenceGraphPreview />
        </motion.div>
      )

    case "risk":
      return (
        <motion.div key="risk" {...stepFade} className="h-full">
          <RiskPreview />
        </motion.div>
      )

    case "report":
      return (
        <motion.div key="report" {...stepFade} className="h-full">
          <ForensicReportPreview />
        </motion.div>
      )
  }
}

export function EmailInvestigationCard({ step }: { step: InvestigationStepId }) {
  const prefersReducedMotion = useReducedMotion()
  const stepMeta = INVESTIGATION_STEPS.find((s) => s.id === step)!
  const stepIndex = INVESTIGATION_STEPS.findIndex((s) => s.id === step)
  const isActive = step !== "report"

  return (
    <Card className="glass-panel relative gap-3 overflow-hidden py-4">
      {step === "report" && !prefersReducedMotion && (
        <motion.div
          aria-hidden
          className="via-primary/20 pointer-events-none absolute inset-x-0 h-10 bg-gradient-to-b from-transparent to-transparent blur-md"
          initial={{ top: "-15%" }}
          animate={{ top: "110%" }}
          transition={{ duration: 3.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 2.5 }}
        />
      )}
      <CardHeader className="flex-row items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-2">
          <div className="bg-risk-high-bg flex size-7 items-center justify-center rounded-md">
            <Mail className="text-risk-high size-3.5" />
          </div>
          <span className="text-xs font-semibold tracking-wide uppercase">Suspicious Email</span>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          Demo data
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 px-4">
        <dl className="flex flex-col gap-1.5">
          <Field label="From" mono value="security@paypa1-support.example" />
          <Field label="Subject" value="Urgent Account Verification Required" />
        </dl>

        <InvestigationMiniStepper currentIndex={stepIndex} />

        {step !== "report" && (
          <div className="border-border/60 flex items-center gap-2 border-t pt-3">
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                isActive ? "bg-primary animate-pulse" : "bg-risk-low",
              )}
            />
            <span className="text-xs font-medium">{stepMeta.status}</span>
          </div>
        )}

        <div className={cn("min-h-[11rem] overflow-hidden", step === "report" && "border-border/60 border-t pt-3")}>
          <AnimatePresence mode={prefersReducedMotion ? "sync" : "wait"} initial={!prefersReducedMotion}>
            <StepDetail step={step} />
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  )
}
