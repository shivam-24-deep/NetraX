// Phase 12/13 — Evidence graph: the same InvestigationResult evidence,
// reshaped into nodes/edges for the Evidence Graph UI. This is a
// visualization structure, not a new evidence source — every node's `data`
// traces back to values already present in the investigation result.

export type GraphNodeType = "email" | "sender" | "domain" | "url" | "ip" | "asn" | "country" | "threat_intel";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  /** Whatever detail is available for this node — shown when the node is clicked. */
  data: Record<string, unknown>;
}

export interface GraphEdge {
  from: string;
  to: string;
  relationship: string;
}

export interface EvidenceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
