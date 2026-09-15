import { describe, expect, it } from "vitest"

import { addCase, findCaseByEmailHash, getCaseById } from "@/lib/mock/store"
import type { FraudCase } from "@/types/fraud"

function makeEmailCase(id: string, emailHash: string): FraudCase {
  return {
    id,
    investigationToken: `NTX-TEST-${id}`,
    emailHash,
    inputType: "EMAIL",
    input: "test",
    category: "Phishing",
    riskScore: 80,
    riskLevel: "HIGH",
    confidence: "HIGH",
    status: "INVESTIGATION_COMPLETE",
    toolsUsed: [],
    evidence: [],
    explanation: "test",
    recommendation: [],
    timeline: [],
    createdAt: new Date().toISOString(),
  }
}

describe("case idempotency", () => {
  it("does not find a case for a hash that hasn't been submitted", () => {
    expect(findCaseByEmailHash("nonexistent-hash-xyz")).toBeUndefined()
  })

  it("finds the exact same case for a repeated submission hash, never a duplicate", () => {
    const hash = "unique-test-hash-12345"
    const fraudCase = makeEmailCase("NX-TEST-0001", hash)
    addCase(fraudCase)

    const found = findCaseByEmailHash(hash)
    expect(found?.id).toBe("NX-TEST-0001")
    expect(getCaseById("NX-TEST-0001")).toBeDefined()

    // A second submission with the same hash should resolve to the SAME case
    // (the app-level idempotency check short-circuits before calling addCase
    // again) — this test guards the lookup half of that contract.
    const secondLookup = findCaseByEmailHash(hash)
    expect(secondLookup?.id).toBe(found?.id)
  })
})
