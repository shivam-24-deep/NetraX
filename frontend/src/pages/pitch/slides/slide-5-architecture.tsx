import { motion } from "framer-motion"

import { SlideShell } from "../slide-shell"

const LAYERS = [
  { label: "Email Input", tech: ".eml · pasted text · JSON" },
  { label: "Agentic Orchestration", tech: "TypeScript · Supabase Edge Functions" },
  { label: "Dynamic Tools", tech: "Forensics · URL · Threat Intel · Geo" },
  { label: "Forensic Analysis", tech: "SPF/DKIM/DMARC · Homoglyph · Received-chain" },
  { label: "Threat Intelligence", tech: "PhishTank · URLhaus" },
  { label: "IP / ASN / GeoLocation", tech: "MaxMind GeoLite" },
  { label: "ML + Rule Engine", tech: "Python · scikit-learn · 2 trained models" },
  { label: "Evidence Fusion", tech: "Normalized findings, one shared schema" },
  { label: "Risk Engine → Case / Report", tech: "Deterministic 0-100 score" },
]

export function Slide5Architecture() {
  const delayBase = 0.35
  const step = 0.15

  return (
    <SlideShell eyebrow="Technical Architecture">
      <div className="flex h-full flex-col items-center justify-center">
        <motion.h2
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-[46px] font-bold tracking-tight text-foreground"
        >
          One pipeline, every signal correlated.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-3 mb-9 text-lg text-muted-foreground"
        >
          Nine layers, each with real code behind it — not a diagram of a plan.
        </motion.p>

        <div className="flex flex-col items-center">
          {LAYERS.map((layer, i) => (
            <div key={layer.label} className="flex flex-col items-center">
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: delayBase + i * step }}
                className="flex w-[1080px] items-center justify-between rounded-lg border border-border bg-surface px-7 py-4"
              >
                <span className="font-mono text-[18px] font-medium text-foreground">{layer.label}</span>
                {layer.tech && <span className="font-mono text-[13px] text-muted-foreground">{layer.tech}</span>}
              </motion.div>
              {i < LAYERS.length - 1 && (
                <svg width="2" height="20" className="overflow-visible">
                  <motion.line
                    x1="1"
                    y1="0"
                    x2="1"
                    y2="20"
                    stroke="var(--color-primary)"
                    strokeWidth="2"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.3, delay: delayBase + i * step + 0.15 }}
                  />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  )
}
