import { Info } from "lucide-react"

import { cn } from "@/lib/utils"

export function DemoDataBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <Info className="size-3.5 shrink-0" />
      <span>Demo data — for prototype demonstration only, not live production data.</span>
    </div>
  )
}
