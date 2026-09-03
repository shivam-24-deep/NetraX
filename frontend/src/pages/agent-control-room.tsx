import { AnimatePresence, motion } from "framer-motion"
import { Activity, Bot, Gauge, Link2, MessageSquare, Play, Search, Sparkles } from "lucide-react"
import { useRef, useState } from "react"

import { AgentNode, type AgentNodeStatus } from "@/components/app/agent-node"
import { DemoDataBanner } from "@/components/demo-data-banner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { runInvestigation } from "@/lib/mock/engine"
import type { InvestigationLogEvent, PipelineStageId } from "@/types/fraud"

const DEMO_INPUT = {
  type: "SMS" as const,
  content: "Congratulations! You have won ₹50,000 in the HDFC Lucky Draw. Click here immediately to claim: bit.ly/xyz123",
}

const NODE_INFO: Record<string, { title: string; description: string }> = {
  agent: { title: "Fraud Agent", description: "The orchestrator. Classifies the input and decides which specialized tools are relevant — it never runs a tool it doesn't need." },
  "message-analyzer": { title: "Message Analyzer", description: "Scans free text for urgency, financial requests, OTP/credential requests, reward claims, threats, and impersonation language." },
  "url-intelligence": { title: "URL Intelligence", description: "Checks structural indicators of any URL found: HTTPS usage, IP-based hosts, shorteners, suspicious keywords, and domain shape." },
  "scam-pattern-search": { title: "Scam Pattern Search", description: "Matches content against a local knowledge base of known scam categories (KYC, OTP, UPI, lottery, investment, job, impersonation, phishing)." },
  "behavioral-analyzer": { title: "Behavioral Analyzer", description: "Flags transaction anomalies: unusual amount, odd hour, unrecognized merchant, location mismatch, or unrecognized device." },
  fusion: { title: "Evidence Fusion", description: "Combines every tool's evidence into one list before scoring — no tool's output is discarded or hidden." },
  "risk-engine": { title: "Risk Engine", description: "Deterministically fuses all evidence into a risk score and level. The LLM only explains this score in plain language — it cannot change it." },
  assessment: { title: "Final Assessment", description: "The explanation and recommended action are generated from the risk score and evidence — never invented independently." },
}

type NodeKey = keyof typeof NODE_INFO

export default function AgentControlRoomPage() {
  const [running, setRunning] = useState(false)
  const [nodeStatus, setNodeStatus] = useState<Record<NodeKey, AgentNodeStatus>>({
    agent: "idle",
    "message-analyzer": "idle",
    "url-intelligence": "idle",
    "scam-pattern-search": "idle",
    "behavioral-analyzer": "idle",
    fusion: "idle",
    "risk-engine": "idle",
    assessment: "idle",
  })
  const [events, setEvents] = useState<InvestigationLogEvent[]>([])
  const [selectedNode, setSelectedNode] = useState<NodeKey | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  function setNode(key: NodeKey, status: AgentNodeStatus) {
    setNodeStatus((prev) => ({ ...prev, [key]: status }))
  }

  async function runDemo() {
    setRunning(true)
    setEvents([])
    setNodeStatus({
      agent: "idle",
      "message-analyzer": "idle",
      "url-intelligence": "idle",
      "scam-pattern-search": "idle",
      "behavioral-analyzer": "idle",
      fusion: "idle",
      "risk-engine": "idle",
      assessment: "idle",
    })

    await runInvestigation(DEMO_INPUT, {
      onStage: (stage) => {
        const map: Partial<Record<PipelineStageId, () => void>> = {
          classification: () => setNode("agent", "active"),
          "tool-selection": () => setNode("agent", stage.status === "complete" ? "complete" : "active"),
          "evidence-collection": () => setNode("fusion", stage.status === "complete" ? "complete" : "active"),
          "risk-analysis": () => setNode("risk-engine", stage.status === "complete" ? "complete" : "active"),
          "final-assessment": () => setNode("assessment", stage.status === "complete" ? "complete" : "active"),
        }
        map[stage.id]?.()
      },
      onTool: (tool) => {
        if (tool.id === "risk-engine") return
        setNode(tool.id as NodeKey, tool.status === "completed" ? "complete" : "active")
      },
      onEvent: (event) => {
        setEvents((prev) => [...prev, event])
        requestAnimationFrame(() => {
          logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" })
        })
      },
    })

    setRunning(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Agent Control Room</h2>
          <p className="text-sm text-muted-foreground">Observe how NetraX investigates a case.</p>
        </div>
        <Button onClick={runDemo} disabled={running}>
          <Play className="size-4" />
          {running ? "Investigating…" : "Run Demo Investigation"}
        </Button>
      </div>

      <DemoDataBanner />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agent Workflow</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto py-6">
          <div className="mx-auto flex min-w-[640px] max-w-3xl flex-col items-center">
            <AgentNode icon={Bot} label="Fraud Agent" status={nodeStatus.agent} size="lg" onClick={() => setSelectedNode("agent")} />
            <Stem />
            <div className="grid w-full grid-cols-4 gap-3 border-t border-border pt-0">
              {(
                [
                  ["message-analyzer", MessageSquare, "Message"],
                  ["url-intelligence", Link2, "URL"],
                  ["scam-pattern-search", Search, "Pattern"],
                  ["behavioral-analyzer", Activity, "Behavior"],
                ] as [NodeKey, typeof MessageSquare, string][]
              ).map(([key, Icon, label]) => (
                <div key={key} className="flex flex-col items-center">
                  <Stem short />
                  <AgentNode icon={Icon} label={label} sublabel="Analyzer" status={nodeStatus[key]} onClick={() => setSelectedNode(key)} />
                </div>
              ))}
            </div>
            <Stem />
            <AgentNode icon={Sparkles} label="Evidence Fusion" status={nodeStatus.fusion} onClick={() => setSelectedNode("fusion")} />
            <Stem />
            <AgentNode icon={Gauge} label="Risk Engine" status={nodeStatus["risk-engine"]} onClick={() => setSelectedNode("risk-engine")} />
            <Stem />
            <AgentNode icon={Bot} label="Assessment" status={nodeStatus.assessment} onClick={() => setSelectedNode("assessment")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live Event Stream</CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={logRef} className="scrollbar-thin flex max-h-72 flex-col gap-1.5 overflow-y-auto rounded-lg border border-border bg-surface p-3 font-mono text-xs">
            {events.length === 0 && <p className="text-muted-foreground">No activity yet — run a demo investigation to see the agent's auditable actions here.</p>}
            <AnimatePresence initial={false}>
              {events.map((e) => (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-2"
                >
                  <span className="shrink-0 text-muted-foreground">{e.timestamp}</span>
                  <span className={e.kind === "risk" ? "font-semibold text-primary" : ""}>{e.message}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Only auditable actions and evidence are shown — the agent's hidden reasoning is never exposed.
          </p>
        </CardContent>
      </Card>

      <Sheet open={!!selectedNode} onOpenChange={(open) => !open && setSelectedNode(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedNode && NODE_INFO[selectedNode].title}</SheetTitle>
            <SheetDescription>{selectedNode && NODE_INFO[selectedNode].description}</SheetDescription>
          </SheetHeader>
          {selectedNode && (
            <div className="px-4">
              <Badge variant="outline">Status: {nodeStatus[selectedNode]}</Badge>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Stem({ short }: { short?: boolean }) {
  return <div className={short ? "h-4 w-px bg-border" : "h-6 w-px bg-border"} />
}
