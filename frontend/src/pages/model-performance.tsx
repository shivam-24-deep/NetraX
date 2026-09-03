import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts"

import { chartTooltipStyle, ChartCard } from "@/components/app/chart-card"
import { DemoDataBanner } from "@/components/demo-data-banner"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { confusionMatrix, featureImportance, modelInfo, modelMetrics } from "@/lib/mock/model-metrics"

const METRIC_CARDS = [
  { label: "Precision", value: modelMetrics.precision },
  { label: "Recall", value: modelMetrics.recall },
  { label: "F1 Score", value: modelMetrics.f1 },
  { label: "ROC-AUC", value: modelMetrics.rocAuc },
  { label: "Accuracy", value: modelMetrics.accuracy },
]

export default function ModelPerformancePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Model Performance</h2>
        <p className="text-sm text-muted-foreground">
          Fraud datasets are imbalanced — precision, recall and F1 matter more here than raw accuracy.
        </p>
      </div>

      <DemoDataBanner />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Model</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Model</p>
            <p className="text-sm font-medium">{modelInfo.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Version</p>
            <Badge variant="secondary">{modelInfo.version}</Badge>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Trained on</p>
            <p className="text-sm">{modelInfo.trainedOn}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Last trained</p>
            <p className="text-sm">{modelInfo.lastTrained}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {METRIC_CARDS.map((m) => (
          <Card key={m.label} className="items-center py-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{(m.value * 100).toFixed(0)}%</p>
            <p className="mt-1 text-xs text-muted-foreground">{m.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confusion Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-center text-sm">
              <MatrixCell label="True Positive" value={confusionMatrix.truePositive} tone="low" />
              <MatrixCell label="False Negative" value={confusionMatrix.falseNegative} tone="high" />
              <MatrixCell label="False Positive" value={confusionMatrix.falsePositive} tone="medium" />
              <MatrixCell label="True Negative" value={confusionMatrix.trueNegative} tone="low" />
            </div>
          </CardContent>
        </Card>

        <ChartCard title="Feature Importance" demo={false}>
          <BarChart data={featureImportance} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid horizontal={false} stroke="var(--color-border)" />
            <XAxis type="number" fontSize={11} stroke="var(--color-muted-foreground)" tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
            <YAxis type="category" dataKey="feature" width={140} fontSize={11} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />
            <Bar dataKey="importance" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  )
}

function MatrixCell({ label, value, tone }: { label: string; value: number; tone: "high" | "medium" | "low" }) {
  const toneClass = tone === "high" ? "bg-risk-high-bg text-risk-high" : tone === "medium" ? "bg-risk-medium-bg text-risk-medium" : "bg-risk-low-bg text-risk-low"
  return (
    <div className={`flex flex-col items-center justify-center gap-1 rounded-lg py-6 ${toneClass}`}>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-xs">{label}</span>
    </div>
  )
}
