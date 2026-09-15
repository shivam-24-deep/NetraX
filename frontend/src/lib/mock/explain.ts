import type { Evidence, FraudCategory, RiskLevel } from "@/types/fraud"

export function generateExplanation(level: RiskLevel, evidence: Evidence[], categories: FraudCategory[]): string {
  const highs = evidence.filter((e) => e.severity === "HIGH").map((e) => e.label.toLowerCase())
  const category = categories[0]

  if (level === "LOW") {
    return "No urgency, financial-request, credential-request, or known scam-pattern indicators were found. This content is consistent with normal, non-fraudulent activity based on the evidence collected."
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
