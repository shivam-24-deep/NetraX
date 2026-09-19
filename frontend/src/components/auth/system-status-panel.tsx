import { motion } from "framer-motion"

import { useCountUp } from "@/lib/use-count-up"

const FEEDS = ["PhishTank", "URLhaus", "AbuseIPDB"] as const

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-foreground text-lg font-semibold tabular-nums">{value}</span>
    </div>
  )
}

export function SystemStatusPanel() {
  const agents = useCountUp(4, 700)
  const queued = useCountUp(12, 700)

  return (
    <div className="glass-panel flex w-full max-w-[15rem] flex-col gap-4 rounded-xl border p-4 opacity-80">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        System status
      </span>

      <div className="flex flex-col gap-2">
        <StatRow label="Agents online" value={agents} />
        <StatRow label="Cases in queue" value={queued} />
      </div>

      <div className="border-border/60 flex flex-col gap-1.5 border-t pt-3">
        <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
          Threat feeds
        </span>
        {FEEDS.map((name, i) => (
          <div key={name} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-mono">{name}</span>
            <span className="text-risk-low flex items-center gap-1.5">
              <motion.span
                className="bg-risk-low size-1.5 rounded-full"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
              />
              Synced
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
