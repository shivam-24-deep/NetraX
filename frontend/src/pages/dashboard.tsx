import { ArrowRight, CheckCircle2, Radar, ScanSearch, ShieldAlert } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { CaseRow } from "@/components/app/case-row"
import { EmptyState } from "@/components/app/empty-state"
import { chartTooltipStyle } from "@/components/app/chart-card"
import { MetricCard } from "@/components/app/metric-card"
import { StatusIndicator } from "@/components/app/status-indicator"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth"
import { displayNameOf } from "@/lib/user-display"
import { useCases } from "@/lib/mock/store"
import { dailyCounts, getTrend, isHighOrCritical, weekOverWeek, type TrendRange } from "@/lib/analytics"
import { useSystemHealth } from "@/lib/system-health"

const RANGES: TrendRange[] = ["24H", "7D", "30D", "90D"]

export default function DashboardPage() {
  const { user } = useAuth()
  const cases = useCases()
  const health = useSystemHealth()
  const [range, setRange] = useState<TrendRange>("7D")

  const displayName = displayNameOf(user).split(" ")[0]
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  }, [])

  const total = cases.length
  const high = cases.filter(isHighOrCritical).length
  const medium = cases.filter((c) => c.riskLevel === "MEDIUM").length
  const low = cases.filter((c) => c.riskLevel === "LOW").length

  const trendData = getTrend(cases, range)
  const liveFeed = [...cases]
    .filter((c) => c.riskLevel !== "LOW")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  const categoryTally = cases.reduce<Record<string, number>>((acc, c) => {
    acc[c.category] = (acc[c.category] ?? 0) + 1
    return acc
  }, {})
  const categoryData = Object.entries(categoryTally)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)

  return (
    <div className="flex flex-col gap-6">
      <div className="glass-panel bg-grid flex flex-col justify-between gap-4 overflow-hidden rounded-2xl p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {greeting}, {displayName}.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 0 ? "Your workspace is empty — start your first investigation." : "Your AI fraud investigation system is ready."}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild>
            <Link to="/investigate">
              <ScanSearch className="size-4" />
              New Investigation
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/threat-intelligence">
              <Radar className="size-4" />
              View Threats
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {health.services.map((s) => (
            <StatusIndicator key={s.label} label={s.label} detail={s.detail} tone={s.tone} />
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={ScanSearch} label="Total Investigations" value={total} trend={weekOverWeek(cases)} sparkline={dailyCounts(cases)} tone="default" />
        <MetricCard icon={ShieldAlert} label="High / Critical" value={high} sparkline={dailyCounts(cases, 7, isHighOrCritical)} tone="high" />
        <MetricCard icon={ShieldAlert} label="Medium Risk" value={medium} sparkline={dailyCounts(cases, 7, (c) => c.riskLevel === "MEDIUM")} tone="medium" />
        <MetricCard icon={CheckCircle2} label="Low Risk" value={low} sparkline={dailyCounts(cases, 7, (c) => c.riskLevel === "LOW")} tone="low" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Fraud Detection Activity</CardTitle>
            <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    range === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="h-64 px-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ left: 8, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="scansGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" width={28} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Area type="monotone" dataKey="scans" name="Scans" stroke="var(--color-chart-1)" fill="url(#scansGradient)" strokeWidth={2} />
                <Area type="monotone" dataKey="highRisk" name="High risk" stroke="var(--color-risk-high)" fill="none" strokeWidth={1.5} strokeDasharray="4 3" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Threats</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {liveFeed.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No MEDIUM or higher risk cases yet.</p>}
            {liveFeed.map((c) => (
              <Link
                key={c.id}
                to={`/cases/${c.id}`}
                className="flex items-start gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5 text-xs transition-colors hover:bg-surface-2"
              >
                <span className={`mt-1 size-2 shrink-0 rounded-full ${c.riskLevel === "HIGH" ? "bg-risk-high" : "bg-risk-medium"}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.category}</p>
                  <p className="truncate text-muted-foreground">{c.input}</p>
                </div>
                <span className="shrink-0 font-mono font-semibold">{c.riskScore}%</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="py-0">
          <CardHeader className="border-b py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Investigations</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/cases">
                  View all
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border px-0 py-2">
            {cases.length === 0 && (
              <div className="p-6">
                <EmptyState
                  icon={ScanSearch}
                  title="No investigations yet"
                  description="Submit a suspicious email or link and its full forensic case will appear here."
                  action={
                    <Button size="sm" asChild>
                      <Link to="/investigate">Start investigating</Link>
                    </Button>
                  }
                />
              </div>
            )}
            {cases.slice(0, 5).map((c) => (
              <CaseRow key={c.id} fraudCase={c} compact />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fraud Categories</CardTitle>
          </CardHeader>
          <CardContent className="h-64 px-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid horizontal={false} stroke="var(--color-border)" />
                <XAxis type="number" fontSize={11} stroke="var(--color-muted-foreground)" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={110} fontSize={11} stroke="var(--color-muted-foreground)" />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="value" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
