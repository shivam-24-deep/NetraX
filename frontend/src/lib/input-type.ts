import { CreditCard, Globe, Mail, MessageSquare, Phone, ShieldQuestion } from "lucide-react"

import type { InputType } from "@/types/fraud"

export const INPUT_TYPE_ICONS: Record<InputType, typeof MessageSquare> = {
  SMS: MessageSquare,
  EMAIL: Mail,
  URL: Globe,
  PHONE: Phone,
  TRANSACTION: CreditCard,
  GENERAL: ShieldQuestion,
}

export const INPUT_TYPE_LABELS: Record<InputType, string> = {
  SMS: "Message",
  EMAIL: "Email",
  URL: "URL",
  PHONE: "Phone",
  TRANSACTION: "Transaction",
  GENERAL: "General",
}
