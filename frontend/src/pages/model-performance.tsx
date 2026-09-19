import { useState } from "react"
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts"

import { chartTooltipStyle, ChartCard } from "@/components/app/chart-card"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { realModelMetrics } from "@/lib/mock/real-model-metrics"

export default function ModelPerformancePage() {
  const [selected, setSelected] = useState(realModelMetrics[0].key)
  const model = realModelMetrics.find((m) => m.key === selected) ?? realModelMetrics[0]

  const metricCards = [
    { label: "Precision", value: model.metrics.precision },
    { label: "Recall", value: model.metrics.recall },
    { label: "F1 Score", value: model.metrics.f1 },
    { label: "ROC-AUC", value: model.metrics.rocAuc },
    { label: "PR-AUC", value: model.metrics.prAuc },
  ]

  const comparisonData = model.candidatesCompared.map((c) => ({
    metric: c.name,
    value: model.headlineMetric === "prAuc" ? (c.prAuc ?? 0) : c.f1,
  }))

  const featureData = model.featureImportance.map((f) => ({ feature: f.feature, importance: f.importance }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Model Performance</h2>
        <p className="text-sm text-muted-foreground">
          Real metrics from the last local training run — measured once on each model's held-out test set. Fraud
          datasets are imbalanced, so precision, recall, F1 and PR-AUC matter more here than raw accuracy.
        </p>
      </div>

      <Tabs value={selected} onValueChange={(v) => setSelected(v as typeof selected)}>
        <TabsList>
          {realModelMetrics.map((m) => (
            <TabsTrigger key={m.key} value={m.key}>
              {m.displayName}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Model</CardTitle>
          <CardDescription>{model.selectionCriterion}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Algorithm</p>
            <p className="text-sm font-medium">{model.algorithm}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Version</p>
            <Badge variant="secondary">{model.version}</Badge>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Dataset</p>
            <p className="text-sm">
              {model.dataset} <span className="text-muted-foreground">({model.datasetFile})</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Training samples</p>
            <p className="text-sm">{model.trainRows.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Test samples</p>
            <p className="text-sm">{model.testRows.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Decision threshold</p>
            <p className="text-sm">
              {model.threshold.selected} <span className="text-muted-foreground">(tuned from default {model.threshold.default})</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Trained</p>
            <p className="text-sm">{new Date(model.trainedAt).toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {metricCards.map((m) => (
          <Card key={m.label} className="items-center py-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{(m.value * 100).toFixed(1)}%</p>
            <p className="mt-1 text-xs text-muted-foreground">{m.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confusion Matrix</CardTitle>
            <CardDescription>Test set — {model.testRows.toLocaleString()} samples</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-center text-sm">
              <MatrixCell label={`True Negative (${model.confusionMatrix.negativeLabel})`} value={model.confusionMatrix.trueNegative} tone="low" />
              <MatrixCell label="False Positive" value={model.confusionMatrix.falsePositive} tone="medium" />
              <MatrixCell label="False Negative" value={model.confusionMatrix.falseNegative} tone="high" />
              <MatrixCell label={`True Positive (${model.confusionMatrix.positiveLabel})`} value={model.confusionMatrix.truePositive} tone="low" />
            </div>
          </CardContent>
        </Card>

        <ChartCard title="Feature Importance">
          <BarChart data={featureData} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid horizontal={false} stroke="var(--color-border)" />
            <XAxis type="number" fontSize={11} stroke="var(--color-muted-foreground)" />
            <YAxis type="category" dataKey="feature" width={140} fontSize={11} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => Number(v).toFixed(3)} />
            <Bar dataKey="importance" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>
      </div>

      <ChartCard title={`Model Comparison — Candidates Evaluated for ${model.displayName}`}>
        <BarChart data={comparisonData}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="metric" fontSize={10} stroke="var(--color-muted-foreground)" angle={-15} textAnchor="end" height={50} />
          <YAxis domain={[0, 1]} fontSize={11} stroke="var(--color-muted-foreground)" width={28} />
          <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`} />
          <Bar dataKey="value" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>
    </div>
  )
}

function MatrixCell({ label, value, tone }: { label: string; value: number; tone: "high" | "medium" | "low" }) {
  const toneClass = tone === "high" ? "bg-risk-high-bg text-risk-high" : tone === "medium" ? "bg-risk-medium-bg text-risk-medium" : "bg-risk-low-bg text-risk-low"
  return (
    <div className={`flex flex-col items-center justify-center gap-1 rounded-lg py-6 ${toneClass}`}>
      <span className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</span>
      <span className="text-xs">{label}</span>
    </div>
  )
}
