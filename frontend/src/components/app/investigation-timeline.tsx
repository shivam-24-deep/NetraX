import { ChevronDown } from "lucide-react"
import { useState } from "react"

import { cn } from "@/lib/utils"
import type { TimelineEvent } from "@/types/fraud"

export function InvestigationTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="flex flex-col">
      {events.map((event, i) => (
        <TimelineItem key={event.label + i} event={event} isLast={i === events.length - 1} />
      ))}
    </ol>
  )
}

function TimelineItem({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const [open, setOpen] = useState(false)
  const hasDetail = Boolean(event.detail)

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
        {!isLast && <span className="w-px flex-1 bg-border" />}
      </div>
      <div className={cn("min-w-0 pb-5", !isLast && "pb-5")}>
        <button
          type="button"
          onClick={() => hasDetail && setOpen((o) => !o)}
          className={cn("flex items-center gap-1.5 text-left text-sm font-medium", hasDetail && "cursor-pointer")}
        >
          {event.label}
          {hasDetail && <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />}
        </button>
        <p className="mt-0.5 text-xs text-muted-foreground">{event.timestamp}</p>
        {open && hasDetail && <p className="mt-1.5 text-xs text-muted-foreground">{event.detail}</p>}
      </div>
    </li>
  )
}
