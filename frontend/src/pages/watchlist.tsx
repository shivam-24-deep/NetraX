import { Eye } from "lucide-react"

import { CaseRow } from "@/components/app/case-row"
import { EmptyState } from "@/components/app/empty-state"
import { DemoDataBanner } from "@/components/demo-data-banner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCases } from "@/lib/mock/store"
import { threatIndicators } from "@/lib/mock/threat-intel"

export default function WatchlistPage() {
  const cases = useCases()
  const watched = cases.filter((c) => c.watchlisted)
  const watchedIndicators = threatIndicators.filter((t) => t.riskLevel === "HIGH").slice(0, 4)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Watchlist</h2>
        <p className="text-sm text-muted-foreground">Cases and indicators you're keeping an eye on.</p>
      </div>

      <Card className="py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-base">Watched Cases</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border px-0 py-2">
          {watched.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Eye} title="Nothing on your watchlist" description="Use “Add to Watchlist” on a case's detail page." />
            </div>
          ) : (
            watched.map((c) => <CaseRow key={c.id} fraudCase={c} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Watched High-Risk Indicators</CardTitle>
          <DemoDataBanner className="mt-1.5" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {watchedIndicators.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs">{t.value}</p>
                <p className="text-xs text-muted-foreground">{t.category}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{t.reports} reports</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
