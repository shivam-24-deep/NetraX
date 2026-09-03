export type TrendRange = "24H" | "7D" | "30D" | "90D"

const RANGE_CONFIG: Record<TrendRange, { points: number; labelFn: (i: number) => string }> = {
  "24H": { points: 12, labelFn: (i) => `${i * 2}:00` },
  "7D": { points: 7, labelFn: (i) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i] },
  "30D": { points: 10, labelFn: (i) => `D${i * 3 + 1}` },
  "90D": { points: 12, labelFn: (i) => `W${i + 1}` },
}

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

export function getTrendData(range: TrendRange): { label: string; scans: number; highRisk: number }[] {
  const config = RANGE_CONFIG[range]
  return Array.from({ length: config.points }, (_, i) => {
    const base = 18 + seededRandom(i + range.length) * 22
    const scans = Math.round(base)
    const highRisk = Math.round(scans * (0.18 + seededRandom(i * 3) * 0.12))
    return { label: config.labelFn(i), scans, highRisk }
  })
}
