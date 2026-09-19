import { Eye } from "lucide-react"
import { useMemo } from "react"
import { Link } from "react-router-dom"

import { CaseRow } from "@/components/app/case-row"
import { EmptyState } from "@/components/app/empty-state"
import { RiskBadge } from "@/components/risk-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCases } from "@/lib/mock/store"
import { deriveIndicators } from "@/lib/threat-indicators"

export default function WatchlistPage() {
  const cases = useCases()
  const watched = useMemo(() => cases.filter((c) => c.watchlisted), [cases])
  const watchedIndicators = useMemo(() => deriveIndicators(watched), [watched])

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
          <CardTitle className="text-base">Indicators From Watched Cases</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {watchedIndicators.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Indicators from watched MEDIUM-or-higher cases appear here.
            </p>
          ) : (
            watchedIndicators.map((t) => (
              <Link
                key={t.id}
                to={`/cases/${t.latestCaseId}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs">{t.value}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.type} · {t.category}
                  </p>
                </div>
                <RiskBadge level={t.riskLevel} />
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
