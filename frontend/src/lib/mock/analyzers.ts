import type { Evidence, FraudCategory, TransactionFields } from "@/types/fraud"

function countMatches(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text))
}

const URGENCY = [/immediately/i, /urgent/i, /right away/i, /within \d+\s*(hour|min)/i, /act now/i, /expire[sd]?\s*(today|soon)/i]
const FINANCIAL = [/₹\s?[\d,]+/, /rs\.?\s?[\d,]+/i, /\$\s?[\d,]+/, /refund/i, /cashback/i, /reward/i, /prize/i]
const OTP = [/\botp\b/i, /one[-\s]?time password/i, /verification code/i]
const CREDENTIAL = [/\bpassword\b/i, /\bpin\b/i, /\bcvv\b/i, /card number/i, /\bupi pin\b/i]
const REWARD = [/congratulations/i, /you('| ha)ve won/i, /winner/i, /lottery/i, /lucky draw/i, /selected for/i]
const THREAT = [/suspend(ed)?/i, /block(ed)?/i, /legal action/i, /penalty/i, /account.*(closed|frozen)/i]
const IMPERSONATION = [/kyc/i, /income tax/i, /customs/i, /rbi\b/i, /bank of/i, /police/i, /government/i]
const CLICK_CTA = [/click\s*(here|this|the link|below)/i, /tap\s*(here|the link)/i, /verify now/i, /update now/i]

export interface MessageAnalysis {
  score: number
  evidence: Evidence[]
  categories: FraudCategory[]
}

export function analyzeMessage(text: string): MessageAnalysis {
  const evidence: Evidence[] = []
  const categories: FraudCategory[] = []
  let score = 0

  if (countMatches(text, URGENCY)) {
    evidence.push({ label: "Urgency language", severity: "MEDIUM", source: "Message Analyzer" })
    score += 0.16
  }
  if (countMatches(text, FINANCIAL)) {
    evidence.push({ label: "Unsolicited financial language", severity: "HIGH", source: "Message Analyzer" })
    score += 0.22
  }
  if (countMatches(text, OTP)) {
    evidence.push({ label: "Requests OTP / verification code", severity: "HIGH", source: "Message Analyzer" })
    score += 0.28
    categories.push("OTP Scam")
  }
  if (countMatches(text, CREDENTIAL)) {
    evidence.push({ label: "Requests credentials (PIN / CVV / password)", severity: "HIGH", source: "Message Analyzer" })
    score += 0.3
  }
  if (countMatches(text, REWARD)) {
    evidence.push({ label: "Unsolicited reward or lottery claim", severity: "HIGH", source: "Message Analyzer" })
    score += 0.24
    categories.push("Lottery Scam")
  }
  if (countMatches(text, THREAT)) {
    evidence.push({ label: "Threatening / account-suspension language", severity: "MEDIUM", source: "Message Analyzer" })
    score += 0.14
  }
  if (countMatches(text, IMPERSONATION)) {
    evidence.push({ label: "Impersonates an institution (bank / government / KYC)", severity: "HIGH", source: "Message Analyzer" })
    score += 0.2
    categories.push("KYC Scam")
  }
  if (countMatches(text, CLICK_CTA)) {
    evidence.push({ label: "Suspicious call-to-action", severity: "MEDIUM", source: "Message Analyzer" })
    score += 0.12
  }
  if (/upi|paytm|phonepe|gpay|google pay/i.test(text)) {
    categories.push("UPI Scam")
  }
  if (/invest|trading|returns of \d+%|double your/i.test(text)) {
    evidence.push({ label: "Unrealistic investment returns promised", severity: "HIGH", source: "Message Analyzer" })
    score += 0.22
    categories.push("Investment Scam")
  }
  if (/job offer|work from home|earn.*per day|hiring/i.test(text)) {
    categories.push("Job Scam")
  }

  if (evidence.length === 0) {
    evidence.push({ label: "No fraud indicators detected in message text", severity: "LOW", source: "Message Analyzer" })
  }

  return { score: Math.min(score, 1), evidence, categories }
}

const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "cutt.ly", "ow.ly", "is.gd", "shorturl.at"]
const SUSPICIOUS_KEYWORDS = [/secure/i, /verify/i, /update/i, /login/i, /account/i, /confirm/i]

export interface UrlAnalysis {
  score: number
  evidence: Evidence[]
}

export function analyzeUrl(rawUrl: string): UrlAnalysis {
  const evidence: Evidence[] = []
  let score = 0
  let url: URL | null = null
  try {
    url = new URL(rawUrl.startsWith("http") ? rawUrl : `http://${rawUrl}`)
  } catch {
    evidence.push({ label: "Malformed URL — could not be parsed", severity: "MEDIUM", source: "URL Intelligence" })
    return { score: 0.3, evidence }
  }

  const host = url.hostname
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
  const isShortener = SHORTENERS.some((s) => host.includes(s))
  const isHttps = url.protocol === "https:"
  const subdomainCount = host.split(".").length - 2
  const hasSuspiciousKeyword = SUSPICIOUS_KEYWORDS.some((k) => k.test(host))
  const hyphenCount = (host.match(/-/g) ?? []).length

  if (!isHttps) {
    evidence.push({ label: "Not served over HTTPS", severity: "MEDIUM", source: "URL Intelligence" })
    score += 0.15
  }
  if (isIp) {
    evidence.push({ label: "IP-based address instead of a domain name", severity: "HIGH", source: "URL Intelligence" })
    score += 0.28
  }
  if (isShortener) {
    evidence.push({ label: "Uses a URL shortener, destination is hidden", severity: "MEDIUM", source: "URL Intelligence" })
    score += 0.18
  }
  if (hasSuspiciousKeyword) {
    evidence.push({ label: "Domain contains security-themed keywords (verify / secure / update)", severity: "MEDIUM", source: "URL Intelligence" })
    score += 0.16
  }
  if (subdomainCount >= 3) {
    evidence.push({ label: "Unusually deep subdomain structure", severity: "MEDIUM", source: "URL Intelligence" })
    score += 0.14
  }
  if (hyphenCount >= 3) {
    evidence.push({ label: "Domain contains many hyphens, common in lookalike domains", severity: "LOW", source: "URL Intelligence" })
    score += 0.08
  }
  if (rawUrl.length > 75) {
    evidence.push({ label: "Unusually long URL", severity: "LOW", source: "URL Intelligence" })
    score += 0.06
  }

  if (evidence.length === 0) {
    evidence.push({ label: "No structural red flags in URL", severity: "LOW", source: "URL Intelligence" })
  }

  return { score: Math.min(score, 1), evidence }
}

export function extractUrls(text: string): string[] {
  const matches = text.match(/\b((?:https?:\/\/)?(?:[\w-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/gi)
  return matches ? Array.from(new Set(matches)) : []
}

const SCAM_PATTERNS: { category: FraudCategory; test: RegExp[]; label: string }[] = [
  { category: "KYC Scam", test: [/kyc/i, /re-?kyc/i, /update.*(kyc|documents)/i], label: "Matches KYC verification scam pattern" },
  { category: "OTP Scam", test: [/otp/i, /one[-\s]?time password/i], label: "Matches OTP-theft scam pattern" },
  { category: "UPI Scam", test: [/upi/i, /collect request/i, /qr code/i], label: "Matches UPI collect-request scam pattern" },
  { category: "Lottery Scam", test: [/lottery/i, /lucky draw/i, /won.*(prize|cash)/i], label: "Matches lottery / prize scam pattern" },
  { category: "Investment Scam", test: [/guaranteed returns/i, /double your (money|investment)/i, /trading (tips|signal)/i], label: "Matches investment-fraud scam pattern" },
  { category: "Job Scam", test: [/work from home/i, /part[-\s]?time job/i, /registration fee/i], label: "Matches job-offer scam pattern" },
  { category: "Impersonation", test: [/customer care/i, /bank official/i, /courier.*(customs|parcel)/i], label: "Matches fake customer-care impersonation pattern" },
  { category: "Phishing", test: [/verify your account/i, /suspended/i, /click.*link/i], label: "Matches generic phishing pattern" },
]

export interface ScamPatternResult {
  score: number
  evidence: Evidence[]
  categories: FraudCategory[]
}

export function scamPatternSearch(text: string): ScamPatternResult {
  const evidence: Evidence[] = []
  const categories: FraudCategory[] = []
  for (const pattern of SCAM_PATTERNS) {
    if (countMatches(text, pattern.test)) {
      evidence.push({ label: pattern.label, severity: "HIGH", source: "Scam Pattern Search" })
      categories.push(pattern.category)
    }
  }
  const score = Math.min(evidence.length * 0.28, 1)
  if (evidence.length === 0) {
    evidence.push({ label: "No match against known scam patterns", severity: "LOW", source: "Scam Pattern Search" })
  }
  return { score, evidence, categories }
}

export interface BehavioralAnalysis {
  score: number
  evidence: Evidence[]
}

const USUAL_CITY = "Mumbai"
const KNOWN_MERCHANTS = ["Amazon", "Flipkart", "Swiggy", "Zomato", "Big Bazaar", "IRCTC"]

export function analyzeTransaction(fields: TransactionFields): BehavioralAnalysis {
  const evidence: Evidence[] = []
  let score = 0

  const amount = Number.parseFloat(fields.amount.replace(/[^\d.]/g, ""))
  if (!Number.isNaN(amount) && amount > 20000) {
    evidence.push({ label: `Unusually high amount (₹${amount.toLocaleString("en-IN")})`, severity: "MEDIUM", source: "Behavioral Analyzer" })
    score += 0.2
  }

  const hourMatch = fields.time.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i)
  if (hourMatch) {
    let hour = Number.parseInt(hourMatch[1], 10)
    const meridiem = hourMatch[3]?.toLowerCase()
    if (meridiem === "pm" && hour < 12) hour += 12
    if (meridiem === "am" && hour === 12) hour = 0
    if (hour >= 0 && hour < 5) {
      evidence.push({ label: "Transaction occurred at an unusual hour (late night)", severity: "MEDIUM", source: "Behavioral Analyzer" })
      score += 0.18
    }
  }

  if (fields.merchant && !KNOWN_MERCHANTS.some((m) => fields.merchant.toLowerCase().includes(m.toLowerCase()))) {
    evidence.push({ label: `Unrecognized / first-time merchant ("${fields.merchant}")`, severity: "MEDIUM", source: "Behavioral Analyzer" })
    score += 0.16
  }

  if (fields.location && !fields.location.toLowerCase().includes(USUAL_CITY.toLowerCase())) {
    evidence.push({ label: `Location differs from usual activity (${fields.location} vs. ${USUAL_CITY})`, severity: "HIGH", source: "Behavioral Analyzer" })
    score += 0.26
  }

  if (fields.device && /new|unknown|unrecognized/i.test(fields.device)) {
    evidence.push({ label: "Unrecognized device fingerprint", severity: "HIGH", source: "Behavioral Analyzer" })
    score += 0.24
  }

  if (evidence.length === 0) {
    evidence.push({ label: "Transaction is consistent with normal behavior", severity: "LOW", source: "Behavioral Analyzer" })
  }

  return { score: Math.min(score, 1), evidence }
}

export function fuseRisk(allEvidence: Evidence[]): { score: number; level: "LOW" | "MEDIUM" | "HIGH"; confidence: "LOW" | "MEDIUM" | "HIGH" } {
  const weights: Record<Evidence["severity"], number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 1.6, LOW: 0.2 }
  const raw = allEvidence.reduce((sum, e) => sum + weights[e.severity], 0)
  // Capped below 100 — a risk *probability*, never displayed as absolute certainty.
  const score = Math.round(Math.min(97, (raw / 13) * 100))
  const level = score >= 70 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW"
  const confidence = allEvidence.length >= 5 ? "HIGH" : allEvidence.length >= 2 ? "MEDIUM" : "LOW"
  return { score, level, confidence }
}
