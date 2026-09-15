import { useEffect } from "react"
import { Navigate, Route, Routes, useLocation } from "react-router-dom"

import { AppLayout } from "@/components/layout"
import { ProtectedRoute } from "@/components/protected-route"
import { Toaster } from "@/components/ui/sonner"
import AgentControlRoomPage from "@/pages/agent-control-room"
import AlertsPage from "@/pages/alerts"
import AnalyticsPage from "@/pages/analytics"
import CaseDetailPage from "@/pages/case-detail"
import CasesPage from "@/pages/cases"
import DashboardPage from "@/pages/dashboard"
import InvestigatePage from "@/pages/investigate"
import LoginPage from "@/pages/login"
import ModelPerformancePage from "@/pages/model-performance"
import MyInvestigationsPage from "@/pages/my-investigations"
import NotFoundPage from "@/pages/not-found"
import PitchPage from "@/pages/pitch"
import SavedCasesPage from "@/pages/saved-cases"
import SendPage from "@/pages/send"
import SettingsPage from "@/pages/settings"
import SignupPage from "@/pages/signup"
import ThreatIntelligencePage from "@/pages/threat-intelligence"
import WatchlistPage from "@/pages/watchlist"

function App() {
  // Recharts' ResponsiveContainer can under-measure on first paint inside
  // grid/flex layouts; nudging a resize once layout settles fixes it,
  // including the first time a route with charts is navigated to.
  const location = useLocation()
  useEffect(() => {
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event("resize")))
    return () => cancelAnimationFrame(id)
  }, [location.pathname])

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/pitch" element={<PitchPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/investigate" element={<InvestigatePage />} />
            <Route path="/send" element={<SendPage />} />
            <Route path="/cases" element={<CasesPage />} />
            <Route path="/cases/:id" element={<CaseDetailPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/threat-intelligence" element={<ThreatIntelligencePage />} />
            <Route path="/my-investigations" element={<MyInvestigationsPage />} />
            <Route path="/saved-cases" element={<SavedCasesPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/agent-control-room" element={<AgentControlRoomPage />} />
            <Route path="/model-performance" element={<ModelPerformancePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster />
    </>
  )
}

export default App
