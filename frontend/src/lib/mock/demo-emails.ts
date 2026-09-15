// Synthetic demo emails (data/demo/*.eml, mirrored into frontend/public/demo-emails/
// so the browser can fetch them). SYNTHETIC DEMO DATA — see data/demo/README.md.
// The "expectedTier" label is just a hint for the picker UI; the actual score
// shown after investigation always comes from the real risk engine, never this file.

export interface DemoEmail {
  file: string
  label: string
  scenario: string
  expectedTier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
}

export const DEMO_EMAILS: DemoEmail[] = [
  { file: "01-legitimate-corporate.eml", label: "Legitimate corporate email", scenario: "Ordinary internal email, no anomalies", expectedTier: "LOW" },
  { file: "02-phishing-generic.eml", label: "Generic phishing", scenario: "Urgency + credential request + typosquat URL", expectedTier: "HIGH" },
  { file: "03-ceo-impersonation-bec.eml", label: "CEO impersonation (BEC)", scenario: "Display-name spoofing + wire-transfer request", expectedTier: "CRITICAL" },
  { file: "04-credential-theft.eml", label: "Credential theft", scenario: "Fake login page behind a homoglyph domain", expectedTier: "HIGH" },
  { file: "05-suspicious-invoice.eml", label: "Suspicious invoice", scenario: "Financial-language signals + shortened URL", expectedTier: "MEDIUM" },
  { file: "06-malware-link.eml", label: "Malware link", scenario: "Links to a raw-IP malware-hosting URL", expectedTier: "HIGH" },
  { file: "07-incomplete-headers.eml", label: "Incomplete headers", scenario: "Minimal headers — tests graceful “not available” handling", expectedTier: "LOW" },
  { file: "08-benign-with-url.eml", label: "Benign email with a URL", scenario: "Legitimate email that happens to contain a URL", expectedTier: "LOW" },
]

export async function fetchDemoEmail(file: string): Promise<string> {
  const res = await fetch(`/demo-emails/${file}`)
  if (!res.ok) throw new Error(`Could not load demo email ${file}`)
  return res.text()
}
