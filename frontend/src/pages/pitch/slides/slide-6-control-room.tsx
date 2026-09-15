import { motion } from "framer-motion"
import { CheckCircle2, RotateCcw } from "lucide-react"
import { useEffect, useState } from "react"

import { useCountUp } from "@/lib/use-count-up"
import { SlideShell } from "../slide-shell"

const TIMELINE = [
  { tool: "Email Parser", summary: "Headers + body extracted" },
  { tool: "Header Forensics", summary: "SPF fail · DKIM fail · Reply-To mismatch" },
  { tool: "Domain Analysis", summary: "Lookalike domain detected" },
  { tool: "URL Analysis", summary: "Typosquat + non-HTTPS link" },
  { tool: "Threat Intelligence", summary: "URLhaus match found" },
  { tool: "IP / Geolocation", summary: "Approx. infrastructure region enriched" },
  { tool: "Evidence Correlated", summary: "9 findings fused across 6 sources" },
  { tool: "Risk Calculated", summary: "Deterministic risk engine — see right" },
]

const GRAPH_NODES = ["Email", "Sender", "Domain", "URL", "IP", "ASN", "Threat Intel", "Country"]

const REASONS = [
  "Reply-To differs from sender domain",
  "SPF authentication failed",
  "Domain resembles a trusted brand",
  "URLhaus match detected",
  "Content model flags 91% spam probability",
]

function RiskNumber() {
  const value = useCountUp(87, 1100)
  return <span className="font-mono text-[92px] leading-none font-bold tabular-nums text-risk-critical">{value}</span>
}

export function Slide6ControlRoom() {
  const [showRisk, setShowRisk] = useState(false)
  // Bumping this forces every motion.div below to remount (via key={replayKey}
  // on their shared wrapper), which replays every initial->animate transition
  // and the risk-score count-up from scratch — the "Replay" button's whole job.
  const [replayKey, setReplayKey] = useState(0)

  useEffect(() => {
    setShowRisk(false)
    const t = window.setTimeout(() => setShowRisk(true), 1600)
    return () => window.clearTimeout(t)
  }, [replayKey])

  return (
    <SlideShell eyebrow="Investigation Control Room">
      {/* display:contents keeps this a real, key-able DOM node without affecting layout */}
      <div key={replayKey} className="contents">
        <div className="grid h-[720px] grid-cols-[500px_680px_460px] gap-8">
          {/* Email panel */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col rounded-xl border border-border bg-surface p-7"
          >
            <p className="mb-4 font-mono text-[13px] tracking-wide text-muted-foreground uppercase">Submitted Email</p>
            <div className="flex flex-col gap-3 font-mono text-[15px]">
              <p><span className="text-muted-foreground">From:</span> <span className="rounded bg-risk-high-bg px-1.5 py-0.5 text-risk-high">security@totally-not-paypal.xyz</span></p>
              <p><span className="text-muted-foreground">Reply-To:</span> <span className="rounded bg-risk-medium-bg px-1.5 py-0.5 text-risk-medium">attacker@other.com</span></p>
              <p><span className="text-muted-foreground">Subject:</span> <span className="text-foreground">Urgent Account Verification</span></p>
              <p><span className="text-muted-foreground">Date:</span> <span className="text-foreground">Mon, 1 Sep 2025</span></p>
            </div>
            <div className="mt-6 rounded-lg bg-muted/40 p-4 text-[14px] leading-relaxed text-foreground/80">
              "Please verify your password immediately, urgent! Visit{" "}
              <span className="rounded bg-risk-high-bg px-1 text-risk-high">paypa1.com/login</span>"
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {["urgency", "credential_request"].map((sig) => (
                <span key={sig} className="rounded-full border border-risk-high/30 bg-risk-high-bg px-3 py-1 font-mono text-[11px] text-risk-high">
                  {sig}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Timeline */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="flex flex-col rounded-xl border border-border bg-surface p-7"
          >
            <p className="mb-4 font-mono text-[13px] tracking-wide text-muted-foreground uppercase">Investigation Timeline</p>
            <div className="flex flex-col gap-4">
              {TIMELINE.map((item, i) => (
                <motion.div
                  key={item.tool}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: 0.5 + i * 0.14 }}
                  className="flex items-start gap-3"
                >
                  <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-risk-low" />
                  <div>
                    <p className="font-mono text-[15px] font-medium text-foreground">{item.tool}</p>
                    <p className="text-[13px] text-muted-foreground">{item.summary}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Risk panel */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col items-center rounded-xl border border-risk-critical/30 bg-surface p-7"
          >
            <p className="mb-3 font-mono text-[13px] tracking-wide text-muted-foreground uppercase">Risk Score</p>
            {showRisk ? <RiskNumber /> : <span className="font-mono text-[92px] leading-none font-bold text-muted-foreground/30">00</span>}
            <span className="mt-2 mb-6 font-mono text-sm font-semibold tracking-[0.2em] text-risk-critical uppercase">High Risk</span>
            <div className="flex w-full flex-col gap-2">
              {REASONS.map((r, i) => (
                <motion.div
                  key={r}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 1.9 + i * 0.15 }}
                  className="rounded-md bg-muted/40 px-3.5 py-2.5 text-[13px] text-foreground/80"
                >
                  {r}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Evidence graph strip */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 2.8 }}
          className="mt-8 flex items-center justify-between rounded-xl border border-border bg-surface px-10 py-7"
        >
          {GRAPH_NODES.map((node, i) => (
            <div key={node} className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <span className="size-4 rounded-full bg-primary" />
                <span className="font-mono text-[13px] text-muted-foreground">{node}</span>
              </div>
              {i < GRAPH_NODES.length - 1 && <span className="h-px w-12 bg-border" />}
            </div>
          ))}
        </motion.div>
      </div>

      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={() => setReplayKey((k) => k + 1)}
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2 font-mono text-[12px] tracking-wide text-muted-foreground uppercase transition-colors hover:border-primary/40 hover:text-primary"
        >
          <RotateCcw className="size-3.5" />
          Replay Investigation
        </button>
      </div>
    </SlideShell>
  )
}
