import type { FraudCase } from "@/types/fraud"

// Everything here is computed from the signed-in user's own cases — no
// generated or placeholder numbers. No cases in => zeros out.

export type TrendRange = "24H" | "7D" | "30D" | "90D"

const HOUR = 3_600_000
const DAY = 24 * HOUR

const RANGES: Record<TrendRange, { buckets: number; size: number }> = {
  "24H": { buckets: 12, size: 2 * HOUR },
  "7D": { buckets: 7, size: DAY },
  "30D": { buckets: 10, size: 3 * DAY },
  "90D": { buckets: 12, size: 7.5 * DAY },
}

export interface TrendPoint {
  label: string
  scans: number
  highRisk: number
}

export function isHighOrCritical(c: Pick<FraudCase, "riskLevel">): boolean {
  return c.riskLevel === "HIGH" || c.riskLevel === "CRITICAL"
}

function bucketLabel(date: Date, range: TrendRange): string {
  if (range === "24H") return `${String(date.getHours()).padStart(2, "0")}:00`
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

export function getTrend(cases: FraudCase[], range: TrendRange, now: number = Date.now()): TrendPoint[] {
  const { buckets, size } = RANGES[range]
  const start = now - buckets * size
  const points: TrendPoint[] = Array.from({ length: buckets }, (_, i) => ({
    label: bucketLabel(new Date(start + i * size), range),
    scans: 0,
    highRisk: 0,
  }))
  for (const c of cases) {
    const t = Date.parse(c.createdAt)
    if (!(t >= start && t <= now)) continue
    const point = points[Math.min(buckets - 1, Math.floor((t - start) / size))]
    point.scans += 1
    if (isHighOrCritical(c)) point.highRisk += 1
  }
  return points
}

/** Oldest → newest counts over the last `days` rolling 24h windows. */
export function dailyCounts(
  cases: FraudCase[],
  days = 7,
  predicate: (c: FraudCase) => boolean = () => true,
  now: number = Date.now(),
): number[] {
  const counts = new Array<number>(days).fill(0)
  const start = now - days * DAY
  for (const c of cases) {
    if (!predicate(c)) continue
    const t = Date.parse(c.createdAt)
    if (!(t >= start && t <= now)) continue
    counts[Math.min(days - 1, Math.floor((t - start) / DAY))] += 1
  }
  return counts
}

/** Last 7 days vs the 7 before. Undefined when there is no prior week to compare against. */
export function weekOverWeek(
  cases: FraudCase[],
  predicate: (c: FraudCase) => boolean = () => true,
  now: number = Date.now(),
): { value: number; direction: "up" | "down" } | undefined {
  let current = 0
  let previous = 0
  for (const c of cases) {
    if (!predicate(c)) continue
    const t = Date.parse(c.createdAt)
    if (t > now - 7 * DAY && t <= now) current += 1
    else if (t > now - 14 * DAY && t <= now - 7 * DAY) previous += 1
  }
  if (previous === 0) return undefined
  const pct = Math.round(((current - previous) / previous) * 1000) / 10
  if (pct === 0) return undefined
  return { value: Math.abs(pct), direction: pct > 0 ? "up" : "down" }
}
