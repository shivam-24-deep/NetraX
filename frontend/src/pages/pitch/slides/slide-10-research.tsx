import { motion } from "framer-motion"

import { SlideShell } from "../slide-shell"

const RESEARCH_GROUPS = [
  { category: "Email Security", sources: ["Enron", "SpamAssassin"], note: "423MB + real spam/ham corpus" },
  { category: "Phishing Intelligence", sources: ["UCI Phishing Websites", "PhishTank"], note: "11,055 rows, lexical features" },
  { category: "Malware URL Intelligence", sources: ["URLhaus"], note: "Live abuse.ch feed" },
  { category: "GeoLocation", sources: ["MaxMind GeoLite"], note: "Approximate, never exact" },
  { category: "Email Authentication", sources: ["SPF", "DKIM", "DMARC"], note: "Header-level standards" },
]

export function Slide10Research() {
  return (
    <SlideShell eyebrow="Research & Sources">
      <div className="flex h-full flex-col items-center justify-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-lg text-muted-foreground"
        >
          Official sources only — every download checksummed and dated, never a random mirror.
        </motion.p>

        <div className="mb-14 grid grid-cols-5 gap-6">
          {RESEARCH_GROUPS.map((group, i) => (
            <motion.div
              key={group.category}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.4 + i * 0.12 }}
              className="flex w-[320px] flex-col gap-2.5 rounded-xl border border-border bg-surface p-6"
            >
              <p className="font-mono text-[13px] font-semibold tracking-wide text-primary uppercase">{group.category}</p>
              <div className="flex flex-col gap-1">
                {group.sources.map((s) => (
                  <span key={s} className="text-[16px] text-foreground">
                    {s}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">{group.note}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 1.3 }}
          className="mb-14 h-px w-[1100px] bg-gradient-to-r from-transparent via-primary/50 to-transparent"
        />

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.6 }}
          className="text-[72px] font-bold tracking-tight text-foreground"
        >
          NETRAX
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.9 }}
          className="mt-3 text-2xl text-muted-foreground"
        >
          Investigate beyond the inbox.
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 2.2 }}
          className="mt-9 font-mono text-sm tracking-[0.3em] text-muted-foreground/60 uppercase"
        >
          SIH 2026 · SIH26106 · AICTE Cyber Security Cell
        </motion.p>
      </div>
    </SlideShell>
  )
}
