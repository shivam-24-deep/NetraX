import { Globe, Radar, Search } from "lucide-react"
import { useMemo, useState } from "react"

import { DemoDataBanner } from "@/components/demo-data-banner"
import { EmptyState } from "@/components/app/empty-state"
import { RiskBadge } from "@/components/risk-badge"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { scamCategories, threatIndicators, type ThreatIndicatorType } from "@/lib/mock/threat-intel"
import { cn } from "@/lib/utils"

const TYPE_TABS: { value: ThreatIndicatorType | "ALL"; label: string }[] = [
  { value: "ALL", label: "All Indicators" },
  { value: "URL", label: "Suspicious URLs" },
  { value: "Domain", label: "Domains" },
  { value: "Phone", label: "Phone Numbers" },
  { value: "Pattern", label: "Scam Patterns" },
  { value: "Scam Type", label: "Scam Types" },
]

export default function ThreatIntelligencePage() {
  const [query, setQuery] = useState("")
  const [type, setType] = useState<ThreatIndicatorType | "ALL">("ALL")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return threatIndicators
      .filter((t) => type === "ALL" || t.type === type)
      .filter((t) => q === "" || t.value.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
  }, [query, type])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Threat Intelligence</h2>
          <p className="text-sm text-muted-foreground">Known indicators, scam patterns, and categories seen across investigations.</p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search threat intelligence…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <DemoDataBanner />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Threat Categories</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {scamCategories.map((c) => (
            <Badge key={c} variant="secondary">
              {c}
            </Badge>
          ))}
        </CardContent>
      </Card>

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
        <EmptyState icon={Radar} title="No matching indicators" description="Try a different search term or category." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <Card key={t.id} className="gap-3">
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Globe className="size-4" />
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {t.type}
                  </Badge>
                </div>
                <RiskBadge level={t.riskLevel} />
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="font-mono text-sm break-all">{t.value}</p>
                <p className="text-xs text-muted-foreground">{t.description}</p>
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{t.category}</span>
                  <span>{t.reports} reports · {t.lastSeen}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
