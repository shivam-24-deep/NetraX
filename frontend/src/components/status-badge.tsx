import { Badge } from "@/components/ui/badge"
import type { CaseStatus } from "@/types/fraud"

const statusVariant: Record<CaseStatus, "default" | "secondary" | "outline"> = {
  OPEN: "default",
  UNDER_REVIEW: "secondary",
  RESOLVED: "outline",
  FALSE_POSITIVE: "outline",
  ANALYZING: "default",
  INVESTIGATION: "default",
  INVESTIGATION_COMPLETE: "secondary",
  REPORT_GENERATED: "secondary",
  READY_FOR_REPORTING: "secondary",
  DEMO_PACKAGE_GENERATED: "secondary",
  SUBMITTED_EXTERNALLY: "outline",
  ACKNOWLEDGED: "outline",
}

const statusLabel: Record<CaseStatus, string> = {
  OPEN: "Open",
  UNDER_REVIEW: "Under Review",
  RESOLVED: "Resolved",
  FALSE_POSITIVE: "False Positive",
  ANALYZING: "Analyzing",
  INVESTIGATION: "Investigation",
  INVESTIGATION_COMPLETE: "Investigation Complete",
  REPORT_GENERATED: "Report Generated",
  READY_FOR_REPORTING: "Ready for Reporting",
  DEMO_PACKAGE_GENERATED: "Demo Package Generated",
  SUBMITTED_EXTERNALLY: "Submitted Externally",
  ACKNOWLEDGED: "Acknowledged",
}

export function StatusBadge({ status }: { status: CaseStatus }) {
  return <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>
}
