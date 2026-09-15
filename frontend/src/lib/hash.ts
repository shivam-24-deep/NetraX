// SHA-256 over actual artifact bytes (Web Crypto), used for evidence-integrity
// hashes shown in the forensic report/evidence package — never hashes of
// displayed/formatted text unless that text IS the artifact being shipped.

export async function sha256Hex(input: string | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input)
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
}
