import { Badge } from "@/components/ui/badge"
import type { CaseStatus } from "@/types/fraud"

const statusVariant: Record<CaseStatus, "default" | "secondary" | "outline"> = {
  OPEN: "default",
  UNDER_REVIEW: "secondary",
  RESOLVED: "outline",
  FALSE_POSITIVE: "outline",
}

const statusLabel: Record<CaseStatus, string> = {
  OPEN: "Open",
  UNDER_REVIEW: "Under Review",
  RESOLVED: "Resolved",
  FALSE_POSITIVE: "False Positive",
}

export function StatusBadge({ status }: { status: CaseStatus }) {
  return <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>
}
