// NetraX forensic case identifiers — see docs/RISK_SCORING.md and the SIH26106
// spec's case-creation requirements. Formats are fixed and must not change
// without updating every place that parses/displays them (PDF, ZIP, dashboard).

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

function randomChars(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALPHANUMERIC[b % ALPHANUMERIC.length]).join("")
}

/** NX-YYYY-MMDD-XXXXXX, e.g. NX-2026-0915-A7F4K2 */
export function generateCaseId(date: Date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `NX-${yyyy}-${mm}${dd}-${randomChars(6)}`
}

/** NTX-XXXX-XXXX-XXXX, e.g. NTX-A7F4-91K2-83M6 */
export function generateInvestigationToken(): string {
  return `NTX-${randomChars(4)}-${randomChars(4)}-${randomChars(4)}`
}

/** DEMO-CC-YYYY-XXXXXX — demo-only Cyber Cell reference, never a real acknowledgement number. */
export function generateDemoComplaintReference(date: Date = new Date()): string {
  return `DEMO-CC-${date.getFullYear()}-${randomChars(6)}`
}
