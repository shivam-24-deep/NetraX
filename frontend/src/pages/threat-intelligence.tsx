import { Globe, Link2, Mail, Radar, Search, Server } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { EmptyState } from "@/components/app/empty-state"
import { RiskBadge } from "@/components/risk-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useCases } from "@/lib/mock/store"
import { deriveIndicators, type IndicatorType } from "@/lib/threat-indicators"
import { cn } from "@/lib/utils"

const TYPE_TABS: { value: IndicatorType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Indicators" },
  { value: "URL", label: "URLs" },
  { value: "Domain", label: "Domains" },
  { value: "IP", label: "IP Addresses" },
  { value: "Sender", label: "Senders" },
]

const TYPE_ICON: Record<IndicatorType, typeof Globe> = {
  URL: Link2,
  Domain: Globe,
  IP: Server,
  Sender: Mail,
}

export default function ThreatIntelligencePage() {
  const cases = useCases()
  const [query, setQuery] = useState("")
  const [type, setType] = useState<IndicatorType | "ALL">("ALL")

  const indicators = useMemo(() => deriveIndicators(cases), [cases])

  const categories = useMemo(() => {
    const tally = new Map<string, number>()
    for (const c of cases) if (c.riskLevel !== "LOW") tally.set(c.category, (tally.get(c.category) ?? 0) + 1)
    return [...tally.entries()].sort((a, b) => b[1] - a[1])
  }, [cases])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return indicators
      .filter((t) => type === "ALL" || t.type === type)
      .filter((t) => q === "" || t.value.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
  }, [indicators, query, type])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Threat Intelligence</h2>
          <p className="text-sm text-muted-foreground">
            Indicators extracted from your own MEDIUM-or-higher risk investigations. Nothing here is pre-loaded.
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search indicators…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Threat Categories Seen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {categories.map(([name, count]) => (
              <Badge key={name} variant="secondary">
                {name} · {count}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-1.5">
        {TYPE_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              type === t.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Radar}
          title={indicators.length === 0 ? "No indicators yet" : "No matching indicators"}
          description={
            indicators.length === 0
              ? "When an investigation scores MEDIUM or higher, its URLs, domains, IPs and sender appear here."
              : "Try a different search term or filter."
          }
          action={
            indicators.length === 0 ? (
              <Button size="sm" asChild>
                <Link to="/investigate">Start investigating</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const Icon = TYPE_ICON[t.type]
            return (
              <Card key={t.id} className="gap-3">
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {t.type}
                    </Badge>
                  </div>
                  <RiskBadge level={t.riskLevel} />
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <p className="font-mono text-sm break-all">{t.value}</p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{t.category}</span>
                    <span>
                      {t.caseCount} case{t.caseCount === 1 ? "" : "s"} · {new Date(t.lastSeen).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                  <Link to={`/cases/${t.latestCaseId}`} className="text-xs font-medium text-primary hover:underline">
                    View latest case
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
