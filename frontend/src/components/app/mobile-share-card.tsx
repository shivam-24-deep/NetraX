// "Use NetraX on Mobile" (SIH26106 mobile-ingest spec §7) — explains and
// links to the same Send-to-NetraX page via a real QR code (encodes this
// page's actual reachable URL, never a placeholder image).
//
// The tricky part: if this desktop page was opened as "localhost", that word
// means nothing to a phone scanning the QR — "localhost" always resolves to
// the scanning device itself. So when the page is on localhost/127.0.0.1, we
// ask the local backend (which runs on this same machine) for its real LAN
// IPv4 address via GET /network-info and build the mobile URL from that
// instead. Any other host (a LAN IP already, a tunnel, a real deployment) is
// already something a phone can reach, so it's used as-is.
import QRCode from "qrcode"
import { AlertTriangle, Smartphone } from "lucide-react"
import { useEffect, useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const LOCAL_API_URL = import.meta.env.VITE_LOCAL_API_URL || "http://localhost:8787"
const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"])

export function MobileShareCard() {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [sendUrl, setSendUrl] = useState<string | null>(null)
  const [lanWarning, setLanWarning] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function resolveUrl() {
      if (typeof window === "undefined") return
      const { protocol, hostname, port } = window.location
      if (!LOCALHOST_NAMES.has(hostname)) {
        return `${window.location.origin}/send`
      }
      try {
        const res = await fetch(`${LOCAL_API_URL}/network-info`)
        if (!res.ok) throw new Error("network-info unavailable")
        const { lanIp } = (await res.json()) as { lanIp: string | null }
        if (!lanIp) throw new Error("no LAN IP found")
        return `${protocol}//${lanIp}${port ? `:${port}` : ""}/send`
      } catch {
        if (!cancelled) setLanWarning(true)
        return `${window.location.origin}/send`
      }
    }

    resolveUrl().then((url) => {
      if (cancelled || !url) return
      setSendUrl(url)
      QRCode.toDataURL(url, { margin: 1, width: 176, color: { dark: "#0f172a", light: "#ffffff" } })
        .then((dataUrl) => !cancelled && setQrDataUrl(dataUrl))
        .catch(() => !cancelled && setQrDataUrl(null))
    })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="size-4 text-muted-foreground" />
          Use NetraX on Mobile
        </CardTitle>
        <CardDescription>Share suspicious content directly from your phone to NetraX.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 text-center">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR code linking to this NetraX Send page" className="rounded-lg border border-border" />
        ) : (
          <div className="flex size-44 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
            Generating QR…
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Scan with your phone camera to open this page on mobile, then paste or upload a suspicious email.
        </p>
        {sendUrl && !sendUrl.startsWith("https://") && (
          <p className="text-left text-[11px] text-muted-foreground">
            Real Android Share-sheet integration (share from Gmail straight to NetraX) needs an HTTPS origin — this
            plain-HTTP LAN link supports paste/upload only. See{" "}
            <code className="rounded bg-muted px-1 py-0.5">docs/mobile-ingestion.md</code> for the one-command HTTPS
            tunnel that enables it.
          </p>
        )}
        {sendUrl && <p className="break-all rounded bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">{sendUrl}</p>}
        {lanWarning && (
          <p className="flex items-start gap-1.5 text-left text-[11px] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Couldn&apos;t detect this machine&apos;s network address automatically — make sure{" "}
            <code className="rounded bg-muted px-1 py-0.5">node server/local-api.ts</code> is running, your phone is on
            the same Wi-Fi, and your firewall allows inbound connections to Node/Vite.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
