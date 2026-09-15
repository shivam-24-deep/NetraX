import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import type { EvidenceGraph, EvidenceGraphNode } from "@/types/fraud"

const TIER_BY_TYPE: Record<string, number> = {
  email: 0,
  sender: 1,
  url: 1,
  domain: 2,
  threat_intel: 2,
  ip: 3,
  asn: 4,
  country: 5,
}

const COLOR_BY_TYPE: Record<string, string> = {
  email: "var(--color-primary)",
  sender: "var(--color-risk-medium)",
  url: "var(--color-risk-medium)",
  domain: "var(--color-risk-high)",
  threat_intel: "var(--color-risk-critical)",
  ip: "var(--color-risk-low)",
  asn: "var(--color-risk-low)",
  country: "var(--color-muted-foreground)",
}

const NODE_RADIUS = 8
const TIER_HEIGHT = 90
const PADDING = 40

interface LayoutNode extends EvidenceGraphNode {
  x: number
  y: number
}

function layout(graph: EvidenceGraph, width: number): LayoutNode[] {
  const byTier = new Map<number, EvidenceGraphNode[]>()
  for (const node of graph.nodes) {
    const tier = TIER_BY_TYPE[node.type] ?? 3
    if (!byTier.has(tier)) byTier.set(tier, [])
    byTier.get(tier)!.push(node)
  }

  const positioned: LayoutNode[] = []
  for (const [tier, nodes] of byTier) {
    const y = PADDING + tier * TIER_HEIGHT
    const spacing = width / (nodes.length + 1)
    nodes.forEach((node, i) => {
      positioned.push({ ...node, x: spacing * (i + 1), y })
    })
  }
  return positioned
}

export function EvidenceGraphView({ graph }: { graph: EvidenceGraph }) {
  const [selected, setSelected] = useState<EvidenceGraphNode | null>(null)
  const width = 720
  const positioned = useMemo(() => layout(graph, width), [graph])
  const byId = useMemo(() => new Map(positioned.map((n) => [n.id, n])), [positioned])
  const maxTier = Math.max(0, ...positioned.map((n) => TIER_BY_TYPE[n.type] ?? 3))
  const height = PADDING * 2 + maxTier * TIER_HEIGHT

  if (graph.nodes.length <= 1) {
    return <p className="text-sm text-muted-foreground">Not enough correlated infrastructure/threat-intel data to draw a graph beyond the email itself.</p>
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <svg width={width} height={height} className="block">
          {graph.edges.map((edge, i) => {
            const from = byId.get(edge.from)
            const to = byId.get(edge.to)
            if (!from || !to) return null
            return (
              <line
                key={`${edge.from}-${edge.to}-${i}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="var(--color-border)"
                strokeWidth={1.5}
              />
            )
          })}
          {positioned.map((node) => (
            <g key={node.id} transform={`translate(${node.x},${node.y})`} className="cursor-pointer" onClick={() => setSelected(node)}>
              <circle
                r={NODE_RADIUS}
                fill={COLOR_BY_TYPE[node.type] ?? "var(--color-muted-foreground)"}
                stroke={selected?.id === node.id ? "var(--color-foreground)" : "transparent"}
                strokeWidth={2}
              />
              <text y={NODE_RADIUS + 14} textAnchor="middle" className="fill-foreground text-[10px]">
                {node.label.length > 22 ? node.label.slice(0, 20) + "…" : node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="w-full shrink-0 rounded-lg border border-border bg-surface p-3 lg:w-72">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {selected ? `${selected.type} details` : "Click a node"}
        </p>
        {selected ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{selected.label}</p>
            <pre className={cn("max-h-64 overflow-auto rounded-md bg-muted p-2 text-[11px] whitespace-pre-wrap break-all")}>
              {JSON.stringify(selected.data, null, 2)}
            </pre>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Select any node in the graph to inspect its evidence.</p>
        )}
      </div>
    </div>
  )
}
