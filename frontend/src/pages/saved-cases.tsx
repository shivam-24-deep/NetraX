import { Bookmark } from "lucide-react"

import { CaseRow } from "@/components/app/case-row"
import { EmptyState } from "@/components/app/empty-state"
import { Card, CardContent } from "@/components/ui/card"
import { useCases } from "@/lib/mock/store"

export default function SavedCasesPage() {
  const cases = useCases()
  const saved = cases.filter((c) => c.savedByMe)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Saved Cases</h2>
        <p className="text-sm text-muted-foreground">Cases you've bookmarked for later follow-up.</p>
      </div>

      <Card className="py-0">
        <CardContent className="flex flex-col divide-y divide-border px-0 py-2">
          {saved.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Bookmark} title="Nothing saved yet" description="Use “Save Case” on any case to bookmark it here." />
            </div>
          ) : (
            saved.map((c) => <CaseRow key={c.id} fraudCase={c} />)
          )}
        </CardContent>
      </Card>
    </div>
  )
}
