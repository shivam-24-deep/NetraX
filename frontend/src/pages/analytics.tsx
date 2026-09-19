import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { chartTooltipStyle, ChartCard } from "@/components/app/chart-card"
import { realModelMetrics } from "@/lib/mock/real-model-metrics"
import { useCases } from "@/lib/mock/store"
import { getTrend } from "@/lib/analytics"

const RISK_COLORS: Record<string, string> = {
  CRITICAL: "var(--color-risk-critical)",
  HIGH: "var(--color-risk-high)",
  MEDIUM: "var(--color-risk-medium)",
  LOW: "var(--color-risk-low)",
}

const CHART_PALETTE = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"]

// Per-model breakdown across all 4 real trained models (Email / URL / SMS /
// Transaction) — the dedicated Model Performance page shows each model's
// full detail (confusion matrix, feature importance, candidate comparison);
// this chart gives the analytics overview a side-by-side comparison instead
// of flattening everything into one mean.
const modelComparisonData = realModelMetrics.map((m) => ({
  name: m.displayName.replace(" Classifier", "").replace(" Detector", ""),
  F1: m.metrics.f1,
  "ROC-AUC": m.metrics.rocAuc,
}))

export default function AnalyticsPage() {
  const cases = useCases()

  const riskDistribution = useMemo(() => {
    const tally: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    for (const c of cases) tally[c.riskLevel] += 1
    return Object.entries(tally).map(([name, value]) => ({ name, value }))
  }, [cases])

  const categoryData = useMemo(() => {
    const tally: Record<string, number> = {}
    for (const c of cases) tally[c.category] = (tally[c.category] ?? 0) + 1
    return Object.entries(tally)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [cases])

  const toolUsage = useMemo(() => {
    const tally: Record<string, number> = {}
    for (const c of cases) for (const t of c.toolsUsed) tally[t.label] = (tally[t.label] ?? 0) + 1
    return Object.entries(tally)
      .map(([tool, runs]) => ({ tool, runs }))
      .sort((a, b) => b.runs - a.runs)
  }, [cases])

  const outcomeData = useMemo(() => {
    const resolved = cases.filter((c) => c.status === "RESOLVED").length
    const falsePositive = cases.filter((c) => c.status === "FALSE_POSITIVE").length
    const correct = Math.max(cases.length - falsePositive, 0)
    return [
      { name: "Correct Detection", value: correct, color: "var(--color-chart-2)" },
      { name: "False Positive", value: falsePositive, color: "var(--color-chart-4)" },
      { name: "Resolved", value: resolved, color: "var(--color-chart-1)" },
    ]
  }, [cases])

  const volumeData = useMemo(() => getTrend(cases, "30D"), [cases])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Analytics</h2>
        <p className="text-sm text-muted-foreground">
          Detection performance and agent activity. Precision, recall and F1 are weighted more heavily than raw accuracy since fraud datasets are imbalanced.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Fraud Detection Trend (30D)">
          <LineChart data={volumeData} margin={{ left: 8, right: 8, top: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="label" fontSize={11} stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} />
            <YAxis fontSize={11} stroke="var(--color-muted-foreground)" tickLine={false} axisLine={false} width={28} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="scans" name="Investigations" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="highRisk" name="High risk" stroke="var(--color-risk-high)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Fraud by Category">
          <BarChart data={categoryData} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid horizontal={false} stroke="var(--color-border)" />
            <XAxis type="number" fontSize={11} stroke="var(--color-muted-foreground)" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={120} fontSize={11} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {categoryData.map((entry, i) => (
                <Cell key={entry.name} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Risk Distribution">
          <PieChart>
            <Pie data={riskDistribution} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
              {riskDistribution.map((entry) => (
                <Cell key={entry.name} fill={RISK_COLORS[entry.name]} />
              ))}
            </Pie>
            <Tooltip contentStyle={chartTooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ChartCard>

        <ChartCard title="Detection Performance & False Positives">
          <PieChart>
            <Pie data={outcomeData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
              {outcomeData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={chartTooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ChartCard>

        <ChartCard title="Agent Tool Usage">
          <BarChart data={toolUsage} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid horizontal={false} stroke="var(--color-border)" />
            <XAxis type="number" fontSize={11} stroke="var(--color-muted-foreground)" allowDecimals={false} />
            <YAxis type="category" dataKey="tool" width={140} fontSize={11} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Bar dataKey="runs" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Model Performance — All Trained Models">
          <BarChart data={modelComparisonData}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="name" fontSize={10.5} stroke="var(--color-muted-foreground)" angle={-15} textAnchor="end" height={46} />
            <YAxis domain={[0, 1]} fontSize={11} stroke="var(--color-muted-foreground)" width={28} />
            <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="F1" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ROC-AUC" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  )
}
