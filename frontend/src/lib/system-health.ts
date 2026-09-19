import { useEffect, useState } from "react"

import type { StatusTone } from "@/components/app/status-indicator"
import { useStoreMeta } from "@/lib/mock/store"

// Real health of the services this UI depends on. The investigation API's
// /status endpoint reports both itself (by answering) and the ML service it calls.

const LOCAL_API_URL = import.meta.env.VITE_LOCAL_API_URL || "http://localhost:8787"
const POLL_MS = 30_000
const RECHECK_MS = 3_000

export type ServiceState = "checking" | "up" | "down"

async function fetchStatus(): Promise<{ api: ServiceState; ml: ServiceState }> {
  try {
    const res = await fetch(`${LOCAL_API_URL}/status`, { signal: AbortSignal.timeout(6000), headers: { "ngrok-skip-browser-warning": "true" } })
    if (!res.ok) return { api: "down", ml: "checking" }
    const body = (await res.json()) as { ml?: string }
    return { api: "up", ml: body.ml === "up" ? "up" : body.ml === "down" ? "down" : "checking" }
  } catch {
    return { api: "down", ml: "checking" }
  }
}

export interface ServiceStatus {
  label: string
  detail: string
  tone: StatusTone
}

export interface SystemHealth {
  services: ServiceStatus[]
  summary: ServiceStatus
}

function toStatus(label: string, state: ServiceState, upDetail: string, downDetail: string): ServiceStatus {
  if (state === "checking") return { label, detail: "Checking…", tone: "neutral" }
  return state === "up" ? { label, detail: upDetail, tone: "good" } : { label, detail: downDetail, tone: "bad" }
}

export function useSystemHealth(): SystemHealth {
  const [api, setApi] = useState<ServiceState>("checking")
  const [ml, setMl] = useState<ServiceState>("checking")
  const store = useStoreMeta()

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    async function check() {
      const { api, ml } = await fetchStatus()
      if (cancelled) return
      setApi(api)
      setMl(ml)
      // While the ML service is still waking up, ask again soon instead of waiting a full poll.
      timer = setTimeout(check, ml === "checking" && api === "up" ? RECHECK_MS : POLL_MS)
    }
    void check()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  const dbState: ServiceState = store.status === "error" ? "down" : store.status === "ready" ? "up" : "checking"
  const services = [
    toStatus("Investigation API", api, "Operational", "Unreachable"),
    toStatus("ML Engine", ml, "Operational", "Unreachable"),
    toStatus("Database", dbState, "Connected", store.error ? "Not set up" : "Unreachable"),
  ]

  const down = services.filter((s) => s.tone === "bad").length
  const checking = services.filter((s) => s.tone === "neutral").length
  const summary: ServiceStatus =
    down === 0 && checking === 0
      ? { label: "All systems operational", detail: "", tone: "good" }
      : down === 0
        ? { label: "Checking systems…", detail: "", tone: "neutral" }
        : { label: `${down} of ${services.length} services down`, detail: "", tone: down === services.length ? "bad" : "warn" }

  return { services, summary }
}
