import { describe, expect, it } from "vitest"

import { generateCaseId, generateDemoComplaintReference, generateInvestigationToken } from "@/lib/case-id"

describe("generateCaseId", () => {
  it("matches NX-YYYY-MMDD-XXXXXX", () => {
    const id = generateCaseId(new Date("2026-09-15T00:00:00Z"))
    expect(id).toMatch(/^NX-2026-0915-[A-Z0-9]{6}$/)
  })

  it("produces different suffixes across calls", () => {
    const a = generateCaseId()
    const b = generateCaseId()
    expect(a).not.toBe(b)
  })
})

describe("generateInvestigationToken", () => {
  it("matches NTX-XXXX-XXXX-XXXX", () => {
    expect(generateInvestigationToken()).toMatch(/^NTX-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
  })
})

describe("generateDemoComplaintReference", () => {
  it("matches DEMO-CC-YYYY-XXXXXX and is never mistaken for a real ack number", () => {
    const ref = generateDemoComplaintReference(new Date("2026-09-15T00:00:00Z"))
    expect(ref).toMatch(/^DEMO-CC-2026-[A-Z0-9]{6}$/)
    expect(ref.startsWith("DEMO-")).toBe(true)
  })
})
