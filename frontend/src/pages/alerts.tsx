import { AnimatePresence } from "framer-motion"
import { BellOff, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { AlertCard } from "@/components/app/alert-card"
import { EmptyState } from "@/components/app/empty-state"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { updateCaseStatus, useCases } from "@/lib/mock/store"
import type { FraudCase } from "@/types/fraud"

type Filter = "ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNRESOLVED"

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
  { value: "UNRESOLVED", label: "Unresolved" },
]

function matchesFilter(c: FraudCase, filter: Filter): boolean {
  switch (filter) {
    case "ALL":
      return true
    case "CRITICAL":
      return c.riskLevel === "HIGH" && c.riskScore >= 90
    case "HIGH":
      return c.riskLevel === "HIGH" && c.riskScore < 90
    case "MEDIUM":
      return c.riskLevel === "MEDIUM"
    case "LOW":
      return c.riskLevel === "LOW"
    case "UNRESOLVED":
      return c.status === "OPEN" || c.status === "UNDER_REVIEW"
  }
}

export default function AlertsPage() {
  const cases = useCases()
  const [filter, setFilter] = useState<Filter>("ALL")
  const [query, setQuery] = useState("")

  const alerts = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cases
      .filter((c) => matchesFilter(c, filter))
      .filter((c) => q === "" || c.input.toLowerCase().includes(q) || c.category.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [cases, filter, query])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Alert Center</h2>
          <p className="text-sm text-muted-foreground">Cases that need your attention, grouped by severity.</p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search alerts…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="flex-wrap">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {alerts.length === 0 ? (
        <EmptyState icon={BellOff} title="No alerts" description="No cases match this filter." />
      ) : (
        <AnimatePresence initial={false}>
          <div className="flex flex-col gap-3">
            {alerts.map((a) => (
              <AlertCard
                key={a.id}
                fraudCase={a}
                onReview={() => {
                  updateCaseStatus(a.id, "UNDER_REVIEW")
                  toast.success("Marked reviewed")
                }}
                onDismiss={() => {
                  updateCaseStatus(a.id, "FALSE_POSITIVE")
                  toast.success("Alert dismissed")
                }}
              />
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}
