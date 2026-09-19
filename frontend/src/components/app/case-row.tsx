import { ChevronRight } from "lucide-react"
import { Link } from "react-router-dom"

import { RiskBadge } from "@/components/risk-badge"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { CASE_SOURCE_ICONS, CASE_SOURCE_LABELS, resolveCaseSource } from "@/lib/case-source"
import { INPUT_TYPE_ICONS } from "@/lib/input-type"
import type { FraudCase } from "@/types/fraud"

/** `compact` drops the status and source badges so the title keeps room in narrow cards. */
export function CaseRow({ fraudCase, compact = false }: { fraudCase: FraudCase; compact?: boolean }) {
  const Icon = INPUT_TYPE_ICONS[fraudCase.inputType]
  const source = resolveCaseSource(fraudCase.source)
  const SourceIcon = CASE_SOURCE_ICONS[source]

  return (
    <Link
      to={`/cases/${fraudCase.id}`}
      className="group flex items-center gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-accent/40 sm:px-6"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{fraudCase.input}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>{fraudCase.category}</span>
          <span aria-hidden>·</span>
          <span>{new Date(fraudCase.createdAt).toLocaleString()}</span>
        </div>
      </div>
      <Badge variant="outline" className="hidden shrink-0 md:inline-flex">
        {fraudCase.riskScore}%
      </Badge>
      <div className="hidden shrink-0 sm:block">
        <RiskBadge level={fraudCase.riskLevel} />
      </div>
      {!compact && (
        <>
          <div className="hidden shrink-0 lg:block">
            <StatusBadge status={fraudCase.status} />
          </div>
          <Badge variant="outline" className="hidden shrink-0 items-center gap-1 text-muted-foreground xl:inline-flex">
            <SourceIcon className="size-3" />
            {CASE_SOURCE_LABELS[source]}
          </Badge>
        </>
      )}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  )
}
