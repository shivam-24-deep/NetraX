import { Loader2, TriangleAlert } from "lucide-react"
import { Navigate, Outlet, useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { reloadStore, useStoreMeta } from "@/lib/mock/store"

const SKIP_AUTH = import.meta.env.VITE_SKIP_AUTH === "true"

function FullPageSpinner() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

export function ProtectedRoute() {
  const { session, loading } = useAuth()
  const store = useStoreMeta()
  const location = useLocation()

  if (SKIP_AUTH) {
    return <Outlet />
  }

  if (loading) return <FullPageSpinner />

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (store.status === "idle" || store.status === "loading") return <FullPageSpinner />

  if (store.status === "error") {
    return (
      <div className="flex min-h-svh items-center justify-center px-6">
        <div className="glass-panel flex max-w-md flex-col items-center gap-3 rounded-xl p-6 text-center">
          <TriangleAlert className="size-8 text-risk-medium" />
          <h1 className="text-lg font-semibold">Couldn&apos;t load your workspace</h1>
          <p className="text-sm text-muted-foreground">{store.error}</p>
          <Button onClick={reloadStore}>Retry</Button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
