// Real Gmail auto-detect connection UI (Settings -> Integrations). Unlike
// every other tab on the Settings page, nothing here is a disabled stub —
// Connect/Disconnect/Check now all hit the real server/local-api.ts +
// server/gmail-client.ts endpoints.
import { AlertTriangle, CheckCircle2, Mail, RefreshCw } from "lucide-react"
import { useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { disconnectGmailRemote, googleConnectUrl } from "@/lib/mock/email-investigation-client"
import { refreshGmailStatus, scanGmailNow, setAutoDetectEnabled, useGmailState } from "@/lib/gmail/gmail-store"

export function GmailIntegrationCard() {
  const state = useGmailState()
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    void refreshGmailStatus()
  }, [])

  useEffect(() => {
    const gmailParam = searchParams.get("gmail")
    if (!gmailParam) return
    if (gmailParam === "connected") {
      toast.success("Gmail connected — NetraX will auto-detect new suspicious mail while this app is open.")
      void refreshGmailStatus()
    } else if (gmailParam === "error") {
      toast.error(`Gmail connection failed: ${searchParams.get("reason") ?? "unknown error"}`)
    }
    const next = new URLSearchParams(searchParams)
    next.delete("gmail")
    next.delete("reason")
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function handleDisconnect() {
    const ok = await disconnectGmailRemote()
    if (ok) {
      toast.message("Gmail disconnected.")
      await refreshGmailStatus()
    } else {
      toast.error("Could not disconnect — is the investigation backend running?")
    }
  }

  async function handleCheckNow() {
    const result = await scanGmailNow()
    if (!result) {
      toast.error(state.lastError ?? "Gmail check failed.")
      return
    }
    if (result.flagged === 0) {
      toast.message(`Checked Gmail — ${result.scanned} new email(s), nothing new to report.`)
    } else {
      toast.success(`Checked Gmail — ${result.flagged} new investigation(s) created out of ${result.scanned} new email(s).`)
    }
  }

  if (state.configured === null) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">Checking Gmail integration status…</CardContent>
      </Card>
    )
  }

  if (!state.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4 text-muted-foreground" />
            Gmail Auto-Detect
          </CardTitle>
          <CardDescription>Automatically investigate new suspicious email as it arrives.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Not configured — this server has no Google OAuth credentials. Add{" "}
              <code className="rounded bg-muted px-1 py-0.5">GOOGLE_CLIENT_ID</code> /{" "}
              <code className="rounded bg-muted px-1 py-0.5">GOOGLE_CLIENT_SECRET</code> to the repo-root{" "}
              <code className="rounded bg-muted px-1 py-0.5">.env</code> and restart{" "}
              <code className="rounded bg-muted px-1 py-0.5">node server/local-api.ts</code> — see{" "}
              <code className="rounded bg-muted px-1 py-0.5">.env.example</code> for setup steps.
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="size-4 text-muted-foreground" />
          Gmail Auto-Detect
        </CardTitle>
        <CardDescription>Automatically investigate new suspicious email as it arrives, while NetraX is open.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state.connected ? (
          <>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span className="font-medium">Connected</span>
              {state.lastCheckedAt && (
                <span className="text-xs text-muted-foreground">— last checked {new Date(state.lastCheckedAt).toLocaleTimeString()}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-3 text-xs">
              <div>
                <p className="text-muted-foreground">Last check found</p>
                <p className="text-lg font-semibold">
                  {state.lastScanFoundCount === null ? "—" : state.lastScanFoundCount === 0 ? "Nothing new" : `${state.lastScanFoundCount} new`}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Auto-detected this session</p>
                <p className="text-lg font-semibold">{state.totalAutoDetectedCount}</p>
              </div>
            </div>

            <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm">
              Auto-check every 30 seconds while NetraX is open
              <input
                type="checkbox"
                checked={state.autoDetectEnabled}
                onChange={(e) => setAutoDetectEnabled(e.target.checked)}
                className="size-4 accent-primary"
              />
            </label>

            {state.lastError && <p className="text-xs text-destructive">{state.lastError}</p>}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCheckNow} disabled={state.scanning}>
                <RefreshCw className={`size-3.5 ${state.scanning ? "animate-spin" : ""}`} />
                {state.scanning ? "Checking…" : "Check now"}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Only mail that arrived after connecting is ever scanned — never your existing mailbox history. This tab's
              polling stops the moment you close this browser tab; it is not a background service.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connect your Gmail account (read-only) to let NetraX automatically investigate new emails as they arrive —
              no manual paste/share needed.
            </p>
            <Button className="self-start" onClick={() => (window.location.href = googleConnectUrl())}>
              <Mail className="size-4" />
              Connect Gmail
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
