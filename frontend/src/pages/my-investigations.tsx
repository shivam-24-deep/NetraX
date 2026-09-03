import { Search } from "lucide-react"

import { CaseRow } from "@/components/app/case-row"
import { EmptyState } from "@/components/app/empty-state"
import { Card, CardContent } from "@/components/ui/card"
import { useCases } from "@/lib/mock/store"

export default function MyInvestigationsPage() {
  const cases = useCases()
  const mine = cases.filter((c) => c.assignee === "You")

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">My Investigations</h2>
        <p className="text-sm text-muted-foreground">Investigations you've personally run through the agent.</p>
      </div>

      <Card className="py-0">
        <CardContent className="flex flex-col divide-y divide-border px-0 py-2">
          {mine.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Search}
                title="No investigations yet"
                description="Cases you run from the Investigate page will show up here."
              />
            </div>
          ) : (
            mine.map((c) => <CaseRow key={c.id} fraudCase={c} />)
          )}
        </CardContent>
      </Card>
    </div>
  )
}
