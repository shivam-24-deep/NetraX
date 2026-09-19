import { useReducedMotion } from "framer-motion"

import { EmailInvestigationCard } from "@/components/auth/email-investigation-card"
import { SystemStatusPanel } from "@/components/auth/system-status-panel"
import { useInvestigationSequence } from "@/lib/investigation-sequence"

const SEQUENCE_START_DELAY_MS = 2300

export function InvestigationPreview() {
  const prefersReducedMotion = useReducedMotion()
  const currentStep = useInvestigationSequence(SEQUENCE_START_DELAY_MS, !prefersReducedMotion)

  return (
    <div className="flex h-full flex-col justify-center gap-5 px-8 py-6 lg:px-16">
      <div className="flex max-w-md flex-col gap-2.5">
        <span className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
          AI-Powered Communication Forensics
        </span>
        <h1 className="text-2xl leading-tight font-semibold text-balance lg:text-3xl">
          Investigate Suspicious Communications with{" "}
          <span className="text-gradient">Clarity</span>
        </h1>
        <p className="text-muted-foreground text-balance text-sm">
          Detect threats, correlate digital evidence, and generate investigator-ready forensic
          intelligence.
        </p>
      </div>

      <div className="flex w-full max-w-3xl items-start gap-6">
        <div className="w-full max-w-sm shrink-0">
          <EmailInvestigationCard step={currentStep.id} />
        </div>
        <div className="hidden min-w-0 flex-1 2xl:block">
          <SystemStatusPanel />
        </div>
      </div>

      <p className="text-muted-foreground max-w-md text-sm">
        Others detect the threat.{" "}
        <span className="text-foreground font-medium">NetraX investigates the threat.</span>
      </p>
    </div>
  )
}
