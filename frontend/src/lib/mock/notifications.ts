export interface Notification {
  id: string
  title: string
  detail: string
  timestamp: string
  read: boolean
  severity: "HIGH" | "MEDIUM" | "LOW" | "INFO"
}

export const notifications: Notification[] = [
  { id: "n1", title: "New HIGH risk case", detail: "Lottery-scam SMS scored 94%", timestamp: "2m ago", read: false, severity: "HIGH" },
  { id: "n2", title: "Case under review", detail: "KYC scam case moved to Under Review", timestamp: "1h ago", read: false, severity: "MEDIUM" },
  { id: "n3", title: "Model retrained", detail: "Transaction anomaly model refreshed with new demo metrics", timestamp: "5h ago", read: true, severity: "INFO" },
  { id: "n4", title: "False positive marked", detail: "Phone-impersonation case marked as false positive", timestamp: "1d ago", read: true, severity: "LOW" },
]
