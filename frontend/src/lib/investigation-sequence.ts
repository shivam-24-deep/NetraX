import { useEffect, useState } from "react"

/**
 * The demo investigation walkthrough shown on the login screen's left panel.
 * One step is "active" at a time; each has a status label (shown with a
 * pulsing indicator) and a fixed dwell duration before advancing. This is
 * the single timer driving the whole sequence — every visual reveal within
 * a step (checklists, graph nodes, etc.) is driven declaratively off the
 * current step id via Framer Motion stagger/variants, not separate timers.
 */
export const INVESTIGATION_STEPS = [
  { id: "email", status: "Email received", dwellMs: 1000 },
  { id: "headers", status: "Parsing MIME structure…", dwellMs: 1600 },
  { id: "sender", status: "Analyzing sender identity…", dwellMs: 1700 },
  { id: "url", status: "Analyzing URL…", dwellMs: 1800 },
  { id: "threat-intel", status: "Checking threat intelligence…", dwellMs: 2000 },
  { id: "infrastructure", status: "Extracting infrastructure…", dwellMs: 1800 },
  { id: "evidence", status: "Correlating evidence graph…", dwellMs: 2200 },
  { id: "risk", status: "Calculating forensic risk…", dwellMs: 1800 },
  { id: "report", status: "Investigation complete", dwellMs: Infinity },
] as const

export type InvestigationStepId = (typeof INVESTIGATION_STEPS)[number]["id"]

export function useInvestigationSequence(startDelayMs: number, enabled: boolean) {
  const [index, setIndex] = useState(enabled ? 0 : INVESTIGATION_STEPS.length - 1)

  useEffect(() => {
    if (!enabled) {
      setIndex(INVESTIGATION_STEPS.length - 1)
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    function scheduleNext(nextIndex: number, delay: number) {
      timer = setTimeout(() => {
        if (cancelled) return
        setIndex(nextIndex)
        const step = INVESTIGATION_STEPS[nextIndex]
        if (nextIndex < INVESTIGATION_STEPS.length - 1 && Number.isFinite(step.dwellMs)) {
          scheduleNext(nextIndex + 1, step.dwellMs)
        }
      }, delay)
    }

    setIndex(0)
    scheduleNext(1, startDelayMs + INVESTIGATION_STEPS[0].dwellMs)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [enabled, startDelayMs])

  return INVESTIGATION_STEPS[index]
}
