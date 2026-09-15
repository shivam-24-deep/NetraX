import { describe, expect, it } from "vitest"

import { buildArtifacts, buildHeadersText, buildIndicatorsJson, buildThreatIntelJson } from "@/lib/mock/report-data"
import type { FraudCase } from "@/types/fraud"

function makeCase(overrides: Partial<FraudCase> = {}): FraudCase {
  return {
    id: "NX-2026-0915-ABCDEF",
    inputType: "EMAIL",
    input: "test",
    category: "Phishing",
    riskScore: 50,
    riskLevel: "MEDIUM",
    confidence: "HIGH",
    status: "INVESTIGATION_COMPLETE",
    toolsUsed: [],
    evidence: [],
    explanation: "test explanation",
    recommendation: [],
    timeline: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  } as FraudCase
}

describe("buildHeadersText", () => {
  it("shows 'Not available in submitted email.' for missing fields, never a blank line", () => {
    const text = buildHeadersText(makeCase({ parsedEmail: { format: "eml", headers: { from: "a@b.com" }, body: {}, indicators: { urls: [], domains: [], emailAddresses: [], ipAddresses: [], phoneNumbers: [], cryptoAddresses: [], attachments: [] }, warnings: [] } }))
    expect(text).toContain("From: a@b.com")
    expect(text).toContain("Subject: Not available in submitted email.")
    expect(text).toContain("SPF: Not available in submitted email.")
  })

  it("handles completely absent parsedEmail without throwing", () => {
    expect(() => buildHeadersText(makeCase())).not.toThrow()
  })

  it("joins array-valued headers (To/Cc/Bcc) instead of stringifying the array", () => {
    const text = buildHeadersText(
      makeCase({
        parsedEmail: {
          format: "eml",
          headers: { to: ["a@x.com", "b@x.com"] } as never,
          body: {},
          indicators: { urls: [], domains: [], emailAddresses: [], ipAddresses: [], phoneNumbers: [], cryptoAddresses: [], attachments: [] },
          warnings: [],
        },
      }),
    )
    expect(text).toContain("To: a@x.com, b@x.com")
    expect(text).not.toContain("[object Object]")
  })
})

describe("buildIndicatorsJson", () => {
  it("produces valid, real JSON (no fabricated fields)", () => {
    const fraudCase = makeCase({
      parsedEmail: {
        format: "eml",
        headers: {},
        body: {},
        indicators: { urls: ["http://evil.example"], domains: ["evil.example"], emailAddresses: [], ipAddresses: [], phoneNumbers: [], cryptoAddresses: [], attachments: [] },
        warnings: [],
      },
    })
    const parsed = JSON.parse(buildIndicatorsJson(fraudCase))
    expect(parsed.urls).toEqual(["http://evil.example"])
  })
})

describe("buildThreatIntelJson", () => {
  it("never fabricates a match — only includes findings actually returned by the backend", () => {
    const fraudCase = makeCase({ allFindings: [] })
    const parsed = JSON.parse(buildThreatIntelJson(fraudCase))
    expect(parsed.findings).toEqual([])
    expect(parsed.note).toContain("does not mean safe")
  })
})

describe("buildArtifacts", () => {
  it("only includes original_email.eml when raw content is actually present", () => {
    const withEmail = buildArtifacts(makeCase({ rawEmailContent: "From: a@b.com\n\nhi" }))
    expect(withEmail.some((a) => a.name === "original_email.eml")).toBe(true)

    const withoutEmail = buildArtifacts(makeCase())
    expect(withoutEmail.some((a) => a.name === "original_email.eml")).toBe(false)
  })
})
