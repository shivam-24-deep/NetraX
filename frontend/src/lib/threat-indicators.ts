import type { FraudCase, RiskLevel } from "@/types/fraud"

// Indicators are extracted from the evidence graphs of the signed-in user's own
// MEDIUM-or-worse investigations. Nothing here is a shared or pre-loaded feed:
// a new account has no indicators until it investigates something.

export type IndicatorType = "URL" | "Domain" | "IP" | "Sender"

export interface ThreatIndicator {
  id: string
  type: IndicatorType
  value: string
  category: string
  riskLevel: RiskLevel
  caseCount: number
  lastSeen: string
  latestCaseId: string
}

const RISK_RANK: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }

const NODE_TYPE_TO_INDICATOR: Record<string, IndicatorType | undefined> = {
  url: "URL",
  domain: "Domain",
  ip: "IP",
  sender: "Sender",
}

export function deriveIndicators(cases: FraudCase[]): ThreatIndicator[] {
  const found = new Map<string, ThreatIndicator>()

  for (const c of cases) {
    if (RISK_RANK[c.riskLevel] < RISK_RANK.MEDIUM) continue
    const seenInThisCase = new Set<string>()

    for (const node of c.evidenceGraph?.nodes ?? []) {
      const type = NODE_TYPE_TO_INDICATOR[node.type]
      const value = node.label?.trim()
      if (!type || !value) continue
      const key = `${type}:${value.toLowerCase()}`
      if (seenInThisCase.has(key)) continue
      seenInThisCase.add(key)

      const existing = found.get(key)
      if (!existing) {
        found.set(key, {
          id: key,
          type,
          value,
          category: c.category,
          riskLevel: c.riskLevel,
          caseCount: 1,
          lastSeen: c.createdAt,
          latestCaseId: c.id,
        })
        continue
      }
      existing.caseCount += 1
      if (RISK_RANK[c.riskLevel] > RISK_RANK[existing.riskLevel]) existing.riskLevel = c.riskLevel
      if (Date.parse(c.createdAt) > Date.parse(existing.lastSeen)) {
        existing.lastSeen = c.createdAt
        existing.latestCaseId = c.id
        existing.category = c.category
      }
    }
  }

  return [...found.values()].sort((a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen))
}
