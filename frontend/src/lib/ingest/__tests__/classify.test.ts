import { describe, expect, it } from "vitest"

import { classifyInput } from "@/lib/ingest/classify"

describe("classifyInput", () => {
  it("classifies raw RFC822 email text as EMAIL from header fields", () => {
    const text = "From: attacker@evil.com\nTo: victim@bank.com\nSubject: Urgent\nDate: Mon, 1 Jan 2026 00:00:00 +0000\n\nBody text here."
    const result = classifyInput({ text })
    expect(result.inputType).toBe("EMAIL")
  })

  it("classifies by .eml filename even when the body text alone would be ambiguous", () => {
    const result = classifyInput({ text: "just some plain text", filename: "suspicious.eml" })
    expect(result.inputType).toBe("EMAIL")
  })

  it("classifies by message/rfc822 MIME type", () => {
    const result = classifyInput({ text: "hello", mimeType: "message/rfc822" })
    expect(result.inputType).toBe("EMAIL")
  })

  it("does not classify a single stray header-like line as EMAIL", () => {
    const result = classifyInput({ text: "Date: whenever, let's meet up" })
    expect(result.inputType).not.toBe("EMAIL")
  })

  it("classifies a bare single URL as URL", () => {
    const result = classifyInput({ text: "https://example.com/login?next=/account" })
    expect(result.inputType).toBe("URL")
  })

  it("does not classify a URL embedded in surrounding text as URL type", () => {
    const result = classifyInput({ text: "Hey check this out https://example.com/login it's weird" })
    expect(result.inputType).not.toBe("URL")
  })

  it("classifies transaction-style content as TRANSACTION", () => {
    const result = classifyInput({ text: "Your transaction id TXN123456 for amount: ₹4500 at merchant: XYZ Store was flagged" })
    expect(result.inputType).toBe("TRANSACTION")
  })

  it("classifies plain free-form text as MESSAGE", () => {
    const result = classifyInput({ text: "Congratulations! You have won a lottery, click to claim your prize now." })
    expect(result.inputType).toBe("MESSAGE")
  })

  it("classifies empty content as UNKNOWN", () => {
    const result = classifyInput({ text: "" })
    expect(result.inputType).toBe("UNKNOWN")
  })

  it("classifies whitespace-only content as UNKNOWN", () => {
    const result = classifyInput({ text: "   \n\t  " })
    expect(result.inputType).toBe("UNKNOWN")
  })
})
