import { Search, ShieldOff } from "lucide-react"
import { useMemo, useState } from "react"

import { CaseRow } from "@/components/app/case-row"
import { EmptyState } from "@/components/app/empty-state"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useCases } from "@/lib/mock/store"
import { cn } from "@/lib/utils"
import type { CaseStatus, RiskLevel } from "@/types/fraud"

type Filter = "ALL" | RiskLevel | CaseStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
  { value: "OPEN", label: "Open" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "FALSE_POSITIVE", label: "False Positive" },
]

export default function CasesPage() {
  const cases = useCases()
  const [filter, setFilter] = useState<Filter>("ALL")
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      const matchesFilter =
        filter === "ALL" ||
        c.riskLevel === filter ||
        c.status === filter
      const q = query.trim().toLowerCase()
      const matchesQuery =
        q === "" || c.input.toLowerCase().includes(q) || c.category.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
      return matchesFilter && matchesQuery
    })
  }, [cases, filter, query])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Investigation Cases</h2>
          <p className="text-sm text-muted-foreground">Every investigation the agent has run.</p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search cases…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="py-0">
        <CardContent className="flex flex-col divide-y divide-border px-0 py-2">
          {filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={ShieldOff} title="No cases match" description="Try a different filter or search term." />
            </div>
          ) : (
            filtered.map((c) => <CaseRow key={c.id} fraudCase={c} />)
          )}
        </CardContent>
      </Card>
    </div>
  )
}
