export type ThreatIndicatorType = "URL" | "Domain" | "Phone" | "Pattern" | "Scam Type"

export interface ThreatIndicator {
  id: string
  type: ThreatIndicatorType
  value: string
  category: string
  riskLevel: "HIGH" | "MEDIUM" | "LOW"
  reports: number
  lastSeen: string
  description: string
}

export const threatIndicators: ThreatIndicator[] = [
  {
    id: "ti1",
    type: "URL",
    value: "secure-kyc-update.info",
    category: "KYC Scam",
    riskLevel: "HIGH",
    reports: 412,
    lastSeen: "2026-09-02",
    description: "Lookalike domain impersonating bank KYC-verification pages.",
  },
  {
    id: "ti2",
    type: "URL",
    value: "paym3nt-update.info",
    category: "Phishing",
    riskLevel: "HIGH",
    reports: 268,
    lastSeen: "2026-09-01",
    description: "Character-substitution lookalike domain used in payment phishing.",
  },
  {
    id: "ti3",
    type: "Domain",
    value: "hdfc-luckydraw.win",
    category: "Lottery Scam",
    riskLevel: "HIGH",
    reports: 189,
    lastSeen: "2026-08-30",
    description: "Fake bank lottery domain, distributed via SMS shorteners.",
  },
  {
    id: "ti4",
    type: "Phone",
    value: "+91 98XXX-11223",
    category: "Impersonation",
    riskLevel: "MEDIUM",
    reports: 57,
    lastSeen: "2026-08-28",
    description: "Reported as a fake bank customer-care line in multiple cases.",
  },
  {
    id: "ti5",
    type: "Pattern",
    value: "\"Your KYC will expire today\"",
    category: "KYC Scam",
    riskLevel: "HIGH",
    reports: 831,
    lastSeen: "2026-09-02",
    description: "High-frequency opening line across KYC-scam SMS campaigns.",
  },
  {
    id: "ti6",
    type: "Pattern",
    value: "\"Congratulations, you have won\"",
    category: "Lottery Scam",
    riskLevel: "HIGH",
    reports: 1204,
    lastSeen: "2026-09-02",
    description: "Most common opening line across lottery / prize scam campaigns.",
  },
  {
    id: "ti7",
    type: "Scam Type",
    value: "UPI Collect Request Fraud",
    category: "UPI Scam",
    riskLevel: "MEDIUM",
    reports: 340,
    lastSeen: "2026-08-27",
    description: "Attacker sends a UPI collect request disguised as a refund.",
  },
  {
    id: "ti8",
    type: "Domain",
    value: "irctc-refund-verify.co",
    category: "Impersonation",
    riskLevel: "MEDIUM",
    reports: 76,
    lastSeen: "2026-08-25",
    description: "Impersonates IRCTC refund-verification pages.",
  },
]

export const scamCategories = [
  "Phishing",
  "UPI Scam",
  "KYC Scam",
  "Investment Scam",
  "OTP Scam",
  "Lottery Scam",
  "Job Scam",
  "Impersonation",
] as const
