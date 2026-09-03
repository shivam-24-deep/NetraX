import { Badge } from "@/components/ui/badge"
import type { RiskLevel } from "@/types/fraud"

const riskVariant = {
  HIGH: "risk-high",
  MEDIUM: "risk-medium",
  LOW: "risk-low",
} as const

const riskLabel = {
  HIGH: "High Risk",
  MEDIUM: "Medium Risk",
  LOW: "Low Risk",
} as const

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <Badge variant={riskVariant[level]}>{riskLabel[level]}</Badge>
}
