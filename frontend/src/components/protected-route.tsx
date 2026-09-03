import { Loader2 } from "lucide-react"
import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useAuth } from "@/lib/auth"

const SKIP_AUTH = import.meta.env.VITE_SKIP_AUTH === "true"

export function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (SKIP_AUTH) {
    return <Outlet />
  }

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <Outlet />
}
