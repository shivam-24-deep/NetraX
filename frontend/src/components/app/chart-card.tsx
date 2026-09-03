import type { ReactElement, ReactNode } from "react"
import { ResponsiveContainer } from "recharts"

import { DemoDataBanner } from "@/components/demo-data-banner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function ChartCard({
  title,
  action,
  height = 256,
  demo = true,
  className,
  children,
}: {
  title: string
  action?: ReactNode
  height?: number
  demo?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {demo && <DemoDataBanner className="mt-1.5" />}
        </div>
        {action}
      </CardHeader>
      <CardContent className="px-2" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children as ReactElement}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export const chartTooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
}
