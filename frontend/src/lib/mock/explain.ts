import type { Evidence, FraudCategory, RiskLevel } from "@/types/fraud"

// Placeholder "nothing found" labels the rule-based analyzers emit when they have zero real findings —
// distinguishing these from genuine (if weak) findings prevents the LOW-risk summary from claiming
// "no indicators were found" while the report lists actual MEDIUM/LOW findings right below it.
const PLACEHOLDER_LABELS = new Set([
  "No fraud indicators detected in message text",
  "No structural red flags in URL",
  "No match against known scam patterns",
  "Transaction is consistent with normal behavior",
])

export function generateExplanation(level: RiskLevel, evidence: Evidence[], categories: FraudCategory[]): string {
  const highs = evidence.filter((e) => e.severity === "HIGH").map((e) => e.label.toLowerCase())
  const realFindings = evidence.filter((e) => !PLACEHOLDER_LABELS.has(e.label))
  const category = categories[0]

  if (level === "LOW") {
    if (realFindings.length === 0) {
      return "No urgency, financial-request, credential-request, or known scam-pattern indicators were found. This content is consistent with normal, non-fraudulent activity based on the evidence collected."
    }
    const weakList = formatList(realFindings.slice(0, 3).map((e) => e.label.toLowerCase()))
    return `A small number of weak indicators were found — ${weakList} — but none reached the threshold associated with likely fraud, and no strong scam-pattern or credential/financial-request signals were present. Overall this content is more consistent with normal activity than with fraud, though the flagged characteristics are listed below for reference.`
  }

  const lead = highs.length > 0 ? `This input combines ${formatList(highs.slice(0, 3))}` : "This input shows several weaker fraud indicators"
  const patternClause = category ? `, a combination strongly associated with ${category.toLowerCase()}` : ""
  const confidenceClause =
    level === "CRITICAL"
      ? ". Taken together, the evidence points to a very high likelihood of fraudulent intent, corroborated across multiple independent sources."
      : level === "HIGH"
        ? ". Taken together, the evidence points to a high likelihood of fraudulent intent."
        : ". Taken together, the evidence is inconclusive but warrants caution."

  return `${lead}${patternClause}${confidenceClause}`
}

function formatList(items: string[]): string {
  if (items.length === 0) return "several indicators"
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
}

const RECOMMENDATIONS: Record<RiskLevel, string[]> = {
  CRITICAL: [
    "Do not click any links, reply, or download attachments",
    "Do not share OTP, PIN, CVV, passwords, or credentials with anyone",
    "Escalate to your security team immediately",
    "Report the message to your bank and to cybercrime.gov.in",
  ],
  HIGH: [
    "Do not click any links or download attachments",
    "Do not share OTP, PIN, CVV, or passwords with anyone",
    "Verify the request directly through the official app or helpline",
    "Report the message to your bank and to cybercrime.gov.in",
  ],
  MEDIUM: [
    "Do not act on the request until you verify it independently",
    "Confirm this activity was authorized by you or someone you trust",
    "Contact the organization using a number from their official website, not the one provided",
  ],
  LOW: ["No action needed — this input does not match known fraud patterns"],
}

export function getRecommendations(level: RiskLevel): string[] {
  return RECOMMENDATIONS[level]
}

export function inferCategory(categories: FraudCategory[], level: RiskLevel): FraudCategory {
  if (categories.length > 0) return categories[0]
  return level === "LOW" ? "Uncategorized" : "Phishing"
}
