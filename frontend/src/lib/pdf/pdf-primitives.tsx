import { Circle, Line, Svg, Text, View } from "@react-pdf/renderer"
import type { ReactNode } from "react"

import { NetraXMark } from "./logo"
import { COLORS, pad2, riskColor, styles } from "./pdf-styles"
import type { ReportModel } from "./report-model"

export function ControlBar({ title, caseId, reportVersion }: { title: string; caseId: string; reportVersion: string }) {
  return (
    <View style={styles.controlBar} fixed>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <NetraXMark size={12} />
        <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: COLORS.ink, letterSpacing: 0.5 }}>NETRAX FORENSIC REPORT</Text>
      </View>
      <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: COLORS.brand }}>{title}</Text>
      <Text
        style={styles.controlBarText}
        render={({ pageNumber, totalPages }) => `${caseId}  |  v${reportVersion}  |  ${pad2(pageNumber)} / ${pad2(totalPages)}`}
      />
    </View>
  )
}

export function ReportFooter({ caseId }: { caseId: string }) {
  return (
    <View style={styles.footerBar} fixed>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <NetraXMark size={9} />
        <Text style={styles.footerText}>NetraX — Agentic AI Email Threat Detection &amp; Forensic Intelligence Platform</Text>
      </View>
      <Text style={styles.footerText}>{caseId}</Text>
    </View>
  )
}

export function SeverityBadge({ severity }: { severity: string }) {
  const color = riskColor(severity)
  return (
    <View style={{ ...styles.badge, backgroundColor: `${color}22`, borderWidth: 1, borderColor: color }}>
      <Text style={{ color, fontSize: 7.5, fontFamily: "Helvetica-Bold" }}>{severity.toUpperCase()}</Text>
    </View>
  )
}

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "good" | "warn" | "bad" | "neutral" }) {
  const color = tone === "good" ? COLORS.low : tone === "warn" ? COLORS.medium : tone === "bad" ? COLORS.critical : COLORS.muted
  return (
    <View style={{ ...styles.badge, backgroundColor: `${color}18`, borderWidth: 1, borderColor: color, alignSelf: "flex-start" }}>
      <Text style={{ color, fontSize: 7.5, fontFamily: "Helvetica-Bold" }}>{label}</Text>
    </View>
  )
}

export function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 6, marginRight: 16 }}>
      <Text style={styles.keyValueLabel}>{label}</Text>
      <Text style={styles.keyValueValue}>{value}</Text>
    </View>
  )
}

export function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={{ ...styles.statCard, ...(tone ? { borderColor: tone, borderWidth: 1.5 } : {}) }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={{ ...styles.statValue, ...(tone ? { color: tone } : {}) }}>{value}</Text>
    </View>
  )
}

export function SectionTitle({ number, title }: { number: string; title: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.sectionEyebrow}>SECTION {number}</Text>
      <Text style={styles.h2}>{title}</Text>
      <View style={styles.thickDivider} />
    </View>
  )
}

export function Callout({ tone, children }: { tone: "info" | "warn"; children: ReactNode }) {
  return <View style={tone === "warn" ? styles.calloutWarn : styles.calloutInfo}>{children}</View>
}

export function DataTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string; width?: number | string; mono?: boolean }[]
  rows: Record<string, string>[]
}) {
  if (rows.length === 0) {
    return (
      <View style={styles.panel}>
        <Text style={styles.muted}>No entries for this section.</Text>
      </View>
    )
  }
  return (
    <View style={styles.table} wrap>
      <View style={styles.tableHeaderRow} fixed>
        {columns.map((c) => (
          <Text key={c.key} style={{ ...styles.tableCellHeader, width: c.width ?? `${100 / columns.length}%` }}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((row, i) => (
        <View key={i} style={{ ...styles.tableRow, ...(i % 2 === 1 ? styles.tableRowAlt : {}) }} wrap={false}>
          {columns.map((c) => (
            <Text
              key={c.key}
              style={{
                ...styles.tableCell,
                width: c.width ?? `${100 / columns.length}%`,
                paddingRight: 6,
                ...(c.mono ? { fontFamily: "Courier", fontSize: 7 } : {}),
              }}
            >
              {row[c.key] ?? ""}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

/** 4-column metadata field: label / value / source / status — used for the Email Identity table (SIH26106 §9). */
export function MetadataGrid({ fields }: { fields: { label: string; value: string; source: string; status: string }[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow} fixed>
        <Text style={{ ...styles.tableCellHeader, width: "20%" }}>Field</Text>
        <Text style={{ ...styles.tableCellHeader, width: "36%" }}>Value</Text>
        <Text style={{ ...styles.tableCellHeader, width: "32%" }}>Source</Text>
        <Text style={{ ...styles.tableCellHeader, width: "12%" }}>Status</Text>
      </View>
      {fields.map((f, i) => (
        <View key={f.label} style={{ ...styles.tableRow, ...(i % 2 === 1 ? styles.tableRowAlt : {}) }} wrap={false}>
          <Text style={{ ...styles.tableCell, width: "20%", paddingRight: 6, fontFamily: "Helvetica-Bold" }}>{f.label}</Text>
          <Text style={{ ...styles.tableCell, width: "36%", paddingRight: 6 }}>{f.value}</Text>
          <Text style={{ ...styles.tableCell, width: "32%", paddingRight: 6, fontSize: 7.5, color: COLORS.muted }}>{f.source}</Text>
          <Text
            style={{
              ...styles.tableCell,
              width: "12%",
              fontSize: 7.5,
              fontFamily: "Helvetica-Bold",
              color: f.status === "Present" ? COLORS.low : f.status === "Missing" ? COLORS.medium : COLORS.faint,
            }}
          >
            {f.status}
          </Text>
        </View>
      ))}
    </View>
  )
}

export function FindingCard({
  finding,
  severity,
  evidence,
  explanation,
  confidence,
}: {
  finding: string
  severity: string
  evidence: string
  explanation: string
  confidence: string
}) {
  return (
    <View style={styles.card} wrap={false}>
      <View style={{ ...styles.spaceBetween, marginBottom: 4 }}>
        <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", maxWidth: 380 }}>{finding}</Text>
        <SeverityBadge severity={severity} />
      </View>
      <Text style={{ ...styles.muted, marginBottom: 3 }}>Evidence: {evidence}</Text>
      <Text style={{ ...styles.body, fontSize: 8.5, color: COLORS.muted }}>{explanation}</Text>
      <Text style={{ ...styles.faint, marginTop: 3 }}>Confidence: {confidence}</Text>
    </View>
  )
}

/** Standardized forensic finding format (SIH26106 §46): F-00N / Title / Severity / Evidence / Source / Confidence / Impact / Recommendation. */
export function RankedFindingCard({
  rank,
  finding,
  severity,
  evidence,
  source,
  confidence,
  impact,
  recommendation,
}: {
  rank: number
  finding: string
  severity: string
  evidence: string
  source: string
  confidence: string
  impact: string
  recommendation: string
}) {
  const color = riskColor(severity)
  return (
    <View style={{ ...styles.card, borderLeftWidth: 3, borderLeftColor: color }} wrap={false}>
      <View style={{ ...styles.spaceBetween, marginBottom: 5 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color }}>{`#${String(rank).padStart(2, "0")}`}</Text>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", maxWidth: 330 }}>{finding}</Text>
        </View>
        <SeverityBadge severity={severity} />
      </View>
      <Text style={{ ...styles.muted, marginBottom: 2 }}>Evidence: {evidence}</Text>
      <Text style={{ ...styles.faint, marginBottom: 4 }}>Source: {source} · Confidence: {confidence}</Text>
      <View style={{ ...styles.divider, marginVertical: 5 }} />
      <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: COLORS.muted, marginBottom: 1 }}>IMPACT</Text>
      <Text style={{ ...styles.body, fontSize: 8.5, marginBottom: 4 }}>{impact}</Text>
      <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: COLORS.muted, marginBottom: 1 }}>RECOMMENDATION</Text>
      <Text style={{ ...styles.body, fontSize: 8.5 }}>{recommendation}</Text>
    </View>
  )
}

/** Horizontal risk score visualization (vector bar) — safer to lay out precisely across PDF renderers than an arc gauge. */
export function RiskScoreBar({ score, level }: { score: number; level: string }) {
  const width = 420
  const height = 16
  const filled = (Math.max(0, Math.min(100, score)) / 100) * width
  const color = riskColor(level)
  return (
    <View>
      <View style={{ ...styles.row, alignItems: "flex-end", marginBottom: 8 }}>
        <Text style={{ fontSize: 32, fontFamily: "Helvetica-Bold", color }}>{score}</Text>
        <Text style={{ fontSize: 14, color: COLORS.muted, marginLeft: 3, marginBottom: 6 }}>/ 100</Text>
        <View style={{ marginLeft: 12, marginBottom: 8, ...styles.badge, backgroundColor: `${color}22`, borderWidth: 1, borderColor: color }}>
          <Text style={{ color, fontSize: 9, fontFamily: "Helvetica-Bold" }}>{level}</Text>
        </View>
      </View>
      <Svg width={width} height={height}>
        <Line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={COLORS.border} strokeWidth={height} strokeLinecap="round" />
        <Line x1={0} y1={height / 2} x2={filled} y2={height / 2} stroke={color} strokeWidth={height} strokeLinecap="round" />
      </Svg>
      <View style={{ ...styles.spaceBetween, marginTop: 3, width }}>
        <Text style={styles.faint}>0</Text>
        <Text style={styles.faint}>50</Text>
        <Text style={styles.faint}>100</Text>
      </View>
    </View>
  )
}

const GRAPH_COLOR: Record<string, string> = {
  email: COLORS.brand,
  sender: COLORS.medium,
  url: COLORS.medium,
  domain: COLORS.high,
  threat_intel: COLORS.critical,
  ip: COLORS.low,
  asn: COLORS.low,
  country: COLORS.faint,
}
const GRAPH_LABEL: Record<string, string> = {
  email: "Email",
  sender: "Sender",
  url: "URL",
  domain: "Domain",
  threat_intel: "Threat Intelligence",
  ip: "IP Address",
  asn: "ASN",
  country: "Country",
}

const GRAPH_TIER: Record<string, number> = { email: 0, sender: 1, url: 1, domain: 2, threat_intel: 2, ip: 3, asn: 4, country: 5 }

/** Vector evidence-graph diagram built only from the case's real graph nodes/edges, plus a type legend. */
export function EvidenceGraphDiagram({ graph }: { graph: ReportModel["evidenceGraph"] }) {
  if (!graph || graph.nodes.length <= 1) {
    return (
      <View style={styles.calloutInfo}>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 3 }}>Limited Evidence Correlation</Text>
        <Text style={styles.muted}>
          Not enough correlated infrastructure or threat-intelligence data was available to draw a multi-node graph beyond the email itself —
          this reflects the actual evidence collected, not a rendering limitation.
        </Text>
      </View>
    )
  }
  const width = 460
  const tierHeight = 62
  const byTier = new Map<number, typeof graph.nodes>()
  for (const node of graph.nodes) {
    const tier = GRAPH_TIER[node.type] ?? 3
    if (!byTier.has(tier)) byTier.set(tier, [])
    byTier.get(tier)!.push(node)
  }
  const positioned = new Map<string, { x: number; y: number; type: string; label: string }>()
  for (const [tier, nodes] of byTier) {
    const y = 20 + tier * tierHeight
    const spacing = width / (nodes.length + 1)
    nodes.forEach((node, i) => positioned.set(node.id, { x: spacing * (i + 1), y, type: node.type, label: node.label }))
  }
  const maxTier = Math.max(...Array.from(byTier.keys()))
  const height = 40 + maxTier * tierHeight
  const usedTypes = Array.from(new Set(graph.nodes.map((n) => n.type)))

  return (
    <View style={styles.card} wrap={false}>
      <Svg width={width} height={height}>
        {graph.edges.map((edge, i) => {
          const from = positioned.get(edge.from)
          const to = positioned.get(edge.to)
          if (!from || !to) return null
          return <Line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={COLORS.border} strokeWidth={1} />
        })}
        {Array.from(positioned.values()).map((n, i) => (
          <Circle key={i} cx={n.x} cy={n.y} r={5} fill={GRAPH_COLOR[n.type] ?? COLORS.faint} />
        ))}
        {Array.from(positioned.entries()).map(([id, n]) => {
          const label = n.label.length > 24 ? n.label.slice(0, 22) + "…" : n.label
          return (
            <Text key={id} x={n.x} y={n.y + 16} textAnchor="middle" style={{ fontSize: 6.5, fill: COLORS.ink }}>
              {label}
            </Text>
          )
        })}
      </Svg>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 6 }}>
        {usedTypes.map((t) => (
          <View key={t} style={{ flexDirection: "row", alignItems: "center", marginRight: 12, marginBottom: 3 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: GRAPH_COLOR[t] ?? COLORS.faint, marginRight: 4 }} />
            <Text style={styles.faint}>{GRAPH_LABEL[t] ?? t}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

export function VerticalTimeline({ events }: { events: ReportModel["timeline"] }) {
  if (events.length === 0) {
    return (
      <View style={styles.panel}>
        <Text style={styles.muted}>No timeline events recorded.</Text>
      </View>
    )
  }
  return (
    <View>
      {events.map((e, i) => (
        <View key={i} style={{ flexDirection: "row", marginBottom: 8 }} wrap={false}>
          <View style={{ width: 14, alignItems: "center" }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.brand, marginTop: 3 }} />
            {i !== events.length - 1 && <View style={{ width: 1, flex: 1, backgroundColor: COLORS.border, marginTop: 2 }} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>{e.label}</Text>
            <Text style={styles.faint}>{e.timestamp}</Text>
            {e.detail && <Text style={{ ...styles.muted, marginTop: 1 }}>{e.detail}</Text>}
          </View>
        </View>
      ))}
    </View>
  )
}

/** Simple top-to-bottom relationship flow (email -> received header -> IP -> ASN -> network -> geolocation, etc). */
export function RelationshipFlow({ steps }: { steps: string[] }) {
  return (
    <View style={{ ...styles.card, alignItems: "center", paddingVertical: 14 }} wrap={false}>
      {steps.map((step, i) => (
        <View key={step} style={{ alignItems: "center" }}>
          <View style={{ borderWidth: 1, borderColor: COLORS.brand, borderRadius: 3, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: COLORS.brandSoft }}>
            <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: COLORS.ink }}>{step}</Text>
          </View>
          {i !== steps.length - 1 && (
            <Svg width={2} height={16}>
              <Line x1={1} y1={0} x2={1} y2={16} stroke={COLORS.borderStrong} strokeWidth={1.5} />
            </Svg>
          )}
        </View>
      ))}
    </View>
  )
}

export function MonospaceBlock({ text }: { text: string }) {
  return (
    <View style={styles.panel}>
      <Text style={{ ...styles.mono, lineHeight: 1.5 }}>{text}</Text>
    </View>
  )
}
