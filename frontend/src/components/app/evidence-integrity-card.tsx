import { FileCheck2, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { sha256Hex } from "@/lib/hash"
import { buildArtifacts } from "@/lib/mock/report-data"
import type { FraudCase } from "@/types/fraud"

interface ArtifactHash {
  name: string
  sha256: string
  sizeBytes: number
}

/** SHA-256 over the exact same artifact bytes the forensic PDF/evidence package will ship — never a hash of reformatted display text. */
export function EvidenceIntegrityCard({ fraudCase }: { fraudCase: FraudCase }) {
  const [hashes, setHashes] = useState<ArtifactHash[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setHashes(null)
    async function run() {
      const artifacts = buildArtifacts(fraudCase)
      const results = await Promise.all(
        artifacts.map(async (a) => ({
          name: a.name,
          sha256: await sha256Hex(a.content),
          sizeBytes: new TextEncoder().encode(a.content).length,
        })),
      )
      if (!cancelled) setHashes(results)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [fraudCase])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCheck2 className="size-4 text-muted-foreground" />
          Evidence Integrity
        </CardTitle>
        <CardDescription>SHA-256 values are provided to help verify artifact integrity — not a claim of legal admissibility.</CardDescription>
      </CardHeader>
      <CardContent>
        {!hashes ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Computing hashes…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Artifact</th>
                  <th className="py-1.5 pr-3 font-medium">SHA-256</th>
                  <th className="py-1.5 font-medium">Size</th>
                </tr>
              </thead>
              <tbody>
                {hashes.map((h) => (
                  <tr key={h.name} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5 pr-3 font-medium whitespace-nowrap">{h.name}</td>
                    <td className="max-w-0 truncate py-1.5 pr-3 font-mono text-[10px]" title={h.sha256}>
                      {h.sha256}
                    </td>
                    <td className="py-1.5 whitespace-nowrap text-muted-foreground">{h.sizeBytes.toLocaleString()} B</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
