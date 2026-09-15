import { beforeEach, describe, expect, it, vi } from "vitest"

import type { FraudCase } from "@/types/fraud"

const { runEmailInvestigationMock, runUrlInvestigationMock, addCaseMock, findCaseByEmailHashMock } = vi.hoisted(() => ({
  runEmailInvestigationMock: vi.fn(),
  runUrlInvestigationMock: vi.fn(),
  addCaseMock: vi.fn(),
  findCaseByEmailHashMock: vi.fn(),
}))

vi.mock("@/lib/mock/engine", () => ({
  runEmailInvestigation: runEmailInvestigationMock,
  runUrlInvestigation: runUrlInvestigationMock,
}))
vi.mock("@/lib/mock/store", () => ({
  addCase: addCaseMock,
  findCaseByEmailHash: findCaseByEmailHashMock,
}))

const { ingestSharedContent } = await import("@/lib/ingest/ingest-service")

function makeCase(id: string): FraudCase {
  return {
    id,
    investigationToken: `NTX-${id}`,
    emailHash: "hash",
    inputType: "EMAIL",
    input: "test",
    category: "Phishing",
    riskScore: 50,
    riskLevel: "MEDIUM",
    confidence: "MEDIUM",
    status: "INVESTIGATION_COMPLETE",
    toolsUsed: [],
    evidence: [],
    explanation: "test",
    recommendation: [],
    timeline: [],
    createdAt: new Date().toISOString(),
  }
}

describe("ingestSharedContent", () => {
  beforeEach(() => {
    runEmailInvestigationMock.mockReset()
    runUrlInvestigationMock.mockReset()
    addCaseMock.mockReset()
    findCaseByEmailHashMock.mockReset()
    findCaseByEmailHashMock.mockReturnValue(undefined)
  })

  it("returns empty for blank input without calling any investigation", async () => {
    const result = await ingestSharedContent({ source: "web_upload", text: "   " })
    expect(result.status).toBe("empty")
    expect(runEmailInvestigationMock).not.toHaveBeenCalled()
    expect(runUrlInvestigationMock).not.toHaveBeenCalled()
  })

  it("routes EMAIL-classified content to runEmailInvestigation and creates a case", async () => {
    const fraudCase = makeCase("NX-EMAIL-1")
    runEmailInvestigationMock.mockResolvedValue(fraudCase)
    const result = await ingestSharedContent({ source: "web_upload", text: "From: a@b.com\nSubject: Hi\nDate: today\n\nBody" })
    expect(result.status).toBe("completed")
    expect(result.status === "completed" && result.inputType).toBe("EMAIL")
    expect(runUrlInvestigationMock).not.toHaveBeenCalled()
    // ingest-service tags the case with its source before storing it — same case, plus one field.
    expect(addCaseMock).toHaveBeenCalledWith({ ...fraudCase, source: "web_upload" })
  })

  it("routes URL-classified content to the real runUrlInvestigation, never the archived mock analyzer", async () => {
    const fraudCase = makeCase("NX-URL-1")
    runUrlInvestigationMock.mockResolvedValue(fraudCase)
    const result = await ingestSharedContent({ source: "web_upload", text: "https://example.com/login" })
    expect(result.status).toBe("completed")
    expect(result.status === "completed" && result.inputType).toBe("URL")
    expect(runUrlInvestigationMock).toHaveBeenCalledWith("https://example.com/login", expect.anything())
    expect(runEmailInvestigationMock).not.toHaveBeenCalled()
  })

  it("reports unsupported for MESSAGE content without calling any investigation", async () => {
    const result = await ingestSharedContent({ source: "web_upload", text: "Congratulations you won a prize, click now!" })
    expect(result.status).toBe("unsupported")
    expect(result.status === "unsupported" && result.inputType).toBe("MESSAGE")
    expect(runEmailInvestigationMock).not.toHaveBeenCalled()
    expect(runUrlInvestigationMock).not.toHaveBeenCalled()
  })

  it("short-circuits to duplicate when a case with the same content hash already exists", async () => {
    const existing = makeCase("NX-EXISTING")
    findCaseByEmailHashMock.mockReturnValue(existing)
    const result = await ingestSharedContent({ source: "web_upload", text: "https://example.com/dup" })
    expect(result.status).toBe("duplicate")
    expect(runUrlInvestigationMock).not.toHaveBeenCalled()
    expect(addCaseMock).not.toHaveBeenCalled()
  })

  it("reports backend_unavailable when the real pipeline returns null", async () => {
    runUrlInvestigationMock.mockResolvedValue(null)
    const result = await ingestSharedContent({ source: "web_upload", text: "https://example.com/unreachable" })
    expect(result.status).toBe("backend_unavailable")
    expect(addCaseMock).not.toHaveBeenCalled()
  })
})
