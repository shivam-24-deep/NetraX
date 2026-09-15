import { describe, expect, it } from "vitest"

import { sha256Hex } from "@/lib/hash"

describe("sha256Hex", () => {
  it("matches the known SHA-256 vector for an empty string", async () => {
    expect(await sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
  })

  it("matches the known SHA-256 vector for 'abc'", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
  })

  it("is deterministic for the same input", async () => {
    const a = await sha256Hex("NetraX forensic evidence")
    const b = await sha256Hex("NetraX forensic evidence")
    expect(a).toBe(b)
  })

  it("produces different hashes for different bytes (Uint8Array input)", async () => {
    const a = await sha256Hex(new TextEncoder().encode("hello"))
    const b = await sha256Hex(new TextEncoder().encode("world"))
    expect(a).not.toBe(b)
  })
})
