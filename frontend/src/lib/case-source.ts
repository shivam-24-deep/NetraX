import { Globe, Mail, Smartphone, User } from "lucide-react"

import type { CaseSource } from "@/types/fraud"

export const CASE_SOURCE_ICONS: Record<CaseSource, typeof Smartphone> = {
  mobile_share: Smartphone,
  web_upload: Globe,
  manual: User,
  gmail_auto: Mail,
}

export const CASE_SOURCE_LABELS: Record<CaseSource, string> = {
  mobile_share: "Mobile Share",
  web_upload: "Web Upload",
  manual: "Manual Input",
  gmail_auto: "Gmail Auto-Detect",
}

/** `source` is only ever set by the Send-to-NetraX/Gmail-auto-detect flows — anything from before those existed, or the manual Investigate page, has no field at all. */
export function resolveCaseSource(source: CaseSource | undefined): CaseSource {
  return source ?? "manual"
}
