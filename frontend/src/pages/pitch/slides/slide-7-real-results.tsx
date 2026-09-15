import { motion } from "framer-motion"
import { Bug, CheckCircle2, Database } from "lucide-react"

import { SlideShell } from "../slide-shell"

const MODELS = [
  {
    name: "Email Content Classifier",
    algo: "LinearSVM",
    dataset: "5,967 real SpamAssassin emails",
    f1: "0.961",
    roc: "0.998",
    precision: "0.961",
    recall: "0.961",
  },
  {
    name: "URL Phishing Classifier",
    algo: "HistGradientBoosting",
    dataset: "5,849 UCI Phishing rows",
    f1: "0.954",
    roc: "0.993",
    precision: "0.960",
    recall: "0.949",
  },
]

const BUGS_FOUND = [
  "CRLF header-parsing bug — found by a real corpus email, not a hypothetical",
  "IPv6 \"::\" compression mishandled — found by testing real address formats",
  "Short-domain typosquat false positive (aol.com flagged as a dhl.com lookalike) — fixed before it could mislead an analyst",
  "Mis-tagged evidence source in the content-analysis module — caught while wiring the real frontend, not left in",
]

const DATASETS = [
  { label: "Enron corpus", detail: "423MB, real download, checksum recorded" },
  { label: "SpamAssassin", detail: "9 files, spam + ham, real headers" },
  { label: "UCI Phishing", detail: "11,055 rows, 47% dupes found & handled" },
]

export function Slide7RealResults() {
  return (
    <SlideShell eyebrow="Real Results">
      <div className="flex h-full flex-col justify-center">
        <motion.h2
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-9 text-[50px] font-bold tracking-tight text-foreground"
        >
          Not a mockup. <span className="text-primary">Real numbers.</span>
        </motion.h2>

        <div className="grid grid-cols-[1fr_1fr_460px] gap-6">
          {MODELS.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.3 + i * 0.15 }}
              className="rounded-xl border border-border bg-surface p-7"
            >
              <p className="mb-1 font-mono text-[13px] tracking-wide text-primary uppercase">{m.name}</p>
              <p className="mb-6 text-[14px] text-muted-foreground">{m.algo} · trained on {m.dataset}</p>
              <div className="grid grid-cols-2 gap-y-5">
                <div>
                  <p className="font-mono text-[46px] leading-none font-bold text-foreground">{m.f1}</p>
                  <p className="mt-1.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">F1 Score</p>
                </div>
                <div>
                  <p className="font-mono text-[46px] leading-none font-bold text-foreground">{m.roc}</p>
                  <p className="mt-1.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">ROC-AUC</p>
                </div>
                <div>
                  <p className="font-mono text-[24px] leading-none font-semibold text-muted-foreground">{m.precision}</p>
                  <p className="mt-1.5 font-mono text-[11px] tracking-wide text-muted-foreground/70 uppercase">Precision</p>
                </div>
                <div>
                  <p className="font-mono text-[24px] leading-none font-semibold text-muted-foreground">{m.recall}</p>
                  <p className="mt-1.5 font-mono text-[11px] tracking-wide text-muted-foreground/70 uppercase">Recall</p>
                </div>
              </div>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.6 }}
            className="flex flex-col items-center justify-center rounded-xl border border-primary/30 bg-primary/5 p-7 text-center"
          >
            <p className="font-mono text-[72px] leading-none font-bold text-primary">203</p>
            <p className="mt-3 font-mono text-[13px] tracking-wide text-muted-foreground uppercase">Automated tests passing</p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">169 TypeScript · 34 Python</p>
          </motion.div>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_1fr] gap-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.1 }}
            className="rounded-xl border border-border bg-surface p-6"
          >
            <div className="mb-3 flex items-center gap-2">
              <Bug className="size-4 text-muted-foreground" />
              <p className="font-mono text-[12px] tracking-wide text-muted-foreground uppercase">Real bugs found while testing against real data</p>
            </div>
            <div className="flex flex-col gap-2.5">
              {BUGS_FOUND.map((bug, i) => (
                <motion.div
                  key={bug}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: 1.4 + i * 0.15 }}
                  className="flex items-start gap-2.5"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-risk-low" />
                  <p className="text-[13px] leading-snug text-foreground/80">{bug}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.3 }}
            className="rounded-xl border border-border bg-surface p-6"
          >
            <div className="mb-3 flex items-center gap-2">
              <Database className="size-4 text-muted-foreground" />
              <p className="font-mono text-[12px] tracking-wide text-muted-foreground uppercase">Real datasets, real provenance</p>
            </div>
            <div className="flex flex-col gap-2.5">
              {DATASETS.map((d, i) => (
                <motion.div
                  key={d.label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: 1.9 + i * 0.15 }}
                  className="flex items-baseline gap-2.5"
                >
                  <span className="font-mono text-[13px] font-semibold whitespace-nowrap text-foreground">{d.label}</span>
                  <span className="text-[13px] text-muted-foreground">{d.detail}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </SlideShell>
  )
}
