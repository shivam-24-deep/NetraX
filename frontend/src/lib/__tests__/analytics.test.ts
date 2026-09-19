import { describe, expect, it } from "vitest"

import { dailyCounts, getTrend, weekOverWeek } from "@/lib/analytics"
import { deriveIndicators } from "@/lib/threat-indicators"
import type { FraudCase, RiskLevel } from "@/types/fraud"

const NOW = Date.parse("2026-09-19T12:00:00Z")
const DAY = 24 * 3_600_000

function makeCase(id: string, riskLevel: RiskLevel, ageMs: number, extra: Partial<FraudCase> = {}): FraudCase {
  return {
    id,
    inputType: "EMAIL",
    input: id,
    category: "Phishing",
    riskScore: 50,
    riskLevel,
    confidence: "MEDIUM",
    status: "INVESTIGATION_COMPLETE",
    toolsUsed: [],
    evidence: [],
    explanation: "",
    recommendation: [],
    timeline: [],
    createdAt: new Date(NOW - ageMs).toISOString(),
    ...extra,
  }
}

describe("analytics with no cases", () => {
  it("returns all-zero series, never generated data", () => {
    for (const range of ["24H", "7D", "30D", "90D"] as const) {
      const trend = getTrend([], range, NOW)
      expect(trend.length).toBeGreaterThan(0)
      expect(trend.every((p) => p.scans === 0 && p.highRisk === 0)).toBe(true)
    }
    expect(dailyCounts([], 7, () => true, NOW)).toEqual([0, 0, 0, 0, 0, 0, 0])
    expect(weekOverWeek([], () => true, NOW)).toBeUndefined()
    expect(deriveIndicators([])).toEqual([])
  })
})

describe("getTrend", () => {
  it("buckets real cases and counts HIGH and CRITICAL as high risk", () => {
    const cases = [
      makeCase("a", "LOW", 1 * DAY),
      makeCase("b", "HIGH", 1 * DAY),
      makeCase("c", "CRITICAL", 1 * DAY),
      makeCase("old", "HIGH", 40 * DAY),
    ]
    const trend = getTrend(cases, "7D", NOW)
    expect(trend.reduce((n, p) => n + p.scans, 0)).toBe(3)
    expect(trend.reduce((n, p) => n + p.highRisk, 0)).toBe(2)
  })
})

describe("weekOverWeek", () => {
  it("compares the last 7 days against the 7 before", () => {
    const cases = [makeCase("p1", "LOW", 10 * DAY), makeCase("p2", "LOW", 9 * DAY), makeCase("c1", "LOW", 1 * DAY), makeCase("c2", "LOW", 2 * DAY), makeCase("c3", "LOW", 3 * DAY)]
    expect(weekOverWeek(cases, () => true, NOW)).toEqual({ value: 50, direction: "up" })
  })

  it("is undefined when there was no previous week (no divide-by-zero fake percentage)", () => {
    expect(weekOverWeek([makeCase("c1", "LOW", 1 * DAY)], () => true, NOW)).toBeUndefined()
  })
})

describe("deriveIndicators", () => {
  const graph = {
    nodes: [
      { id: "e", type: "email", label: "Subject", data: {} },
      { id: "d", type: "domain", label: "evil.example", data: {} },
      { id: "u", type: "url", label: "http://evil.example/login", data: {} },
      { id: "c", type: "country", label: "Russia", data: {} },
    ],
    edges: [],
  }

  it("extracts URL/domain indicators from MEDIUM+ cases only and merges repeats", () => {
    const cases = [
      makeCase("new", "HIGH", 1 * DAY, { evidenceGraph: graph }),
      makeCase("old", "MEDIUM", 5 * DAY, { evidenceGraph: graph }),
      makeCase("benign", "LOW", 1 * DAY, { evidenceGraph: { nodes: [{ id: "d2", type: "domain", label: "fine.example", data: {} }], edges: [] } }),
    ]
    const indicators = deriveIndicators(cases)
    expect(indicators.map((i) => i.value).sort()).toEqual(["evil.example", "http://evil.example/login"])
    const domain = indicators.find((i) => i.type === "Domain")!
    expect(domain.caseCount).toBe(2)
    expect(domain.riskLevel).toBe("HIGH")
    expect(domain.latestCaseId).toBe("new")
  })
})
