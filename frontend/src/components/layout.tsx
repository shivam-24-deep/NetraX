import { AnimatePresence, motion } from "framer-motion"
import {
  BarChart3,
  Bell,
  Bookmark,
  ChevronLeft,
  Eye,
  Gauge,
  LayoutDashboard,
  Radar,
  Search,
  Send,
  Settings,
  ShieldAlert,
  User,
} from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"

import { CommandPalette } from "@/components/app/command-palette"
import { StatusIndicator } from "@/components/app/status-indicator"
import { startGmailPolling } from "@/lib/gmail/gmail-store"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/lib/auth"
import { notifications } from "@/lib/mock/notifications"
import { cn } from "@/lib/utils"

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
}

const MAIN_NAV: NavItem[] = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/investigate", label: "Investigate", icon: Search },
  { to: "/cases", label: "Cases", icon: ShieldAlert },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/threat-intelligence", label: "Threat Intelligence", icon: Radar },
]

const WORKSPACE_NAV: NavItem[] = [
  { to: "/send", label: "Send to NetraX", icon: Send },
  { to: "/my-investigations", label: "My Investigations", icon: Search },
  { to: "/saved-cases", label: "Saved Cases", icon: Bookmark },
  { to: "/watchlist", label: "Watchlist", icon: Eye },
]

// /agent-control-room (the archived SMS-pipeline demo) is intentionally not
// listed here — SIH26106's active story is EMAIL-FIRST. The route/page are
// preserved, just not part of the active navigation (see investigate.tsx's
// own comment on the archived SMS/Transaction modules).
const SYSTEM_NAV: NavItem[] = [
  { to: "/model-performance", label: "Model Performance", icon: Gauge },
  { to: "/settings", label: "Settings", icon: Settings },
]

const MOBILE_NAV: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/investigate", label: "Investigate", icon: Search },
  { to: "/cases", label: "Cases", icon: ShieldAlert },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/settings", label: "Profile", icon: User },
]

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/investigate": "Investigate",
  "/send": "Send to NetraX",
  "/cases": "Cases",
  "/alerts": "Alert Center",
  "/analytics": "Analytics",
  "/threat-intelligence": "Threat Intelligence",
  "/my-investigations": "My Investigations",
  "/saved-cases": "Saved Cases",
  "/watchlist": "Watchlist",
  "/agent-control-room": "Agent Control Room",
  "/model-performance": "Model Performance",
  "/settings": "Settings",
}

function useActive() {
  const location = useLocation()
  return (to: string) => location.pathname === to || location.pathname.startsWith(`${to}/`)
}

function Brand({ collapsed, compact }: { collapsed?: boolean; compact?: boolean }) {
  return (
    <Link
      to="/dashboard"
      className={cn(
        "group flex min-w-0 items-center transition-all duration-200 outline-none",
        collapsed ? "justify-center" : "gap-3",
      )}
    >
      <div className="relative flex shrink-0 items-center justify-center">
        <img
          src="/assets/netrax-icon.png?v=2"
          alt="NetraX"
          className={cn(
            "object-contain transition-all duration-200 drop-shadow-[0_0_10px_rgba(0,180,255,0.45)] group-hover:scale-105 group-hover:drop-shadow-[0_0_14px_rgba(0,180,255,0.7)]",
            collapsed ? "size-10" : "size-8.5",
          )}
        />
      </div>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-base font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
              NetraX
            </span>
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-primary uppercase">
              AI
            </span>
          </div>
          {!compact && <p className="truncate text-[11px] text-muted-foreground">Fraud Investigation</p>}
        </div>
      )}
    </Link>
  )
}

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const isActive = useActive()
  const active = isActive(item.to)

  return (
    <Link
      to={item.to}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      {active && (
        <motion.span layoutId="sidebar-active" className="absolute inset-y-0 left-0 w-0.5 rounded-full bg-primary" />
      )}
      <item.icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover:block">
          {item.label}
        </span>
      )}
    </Link>
  )
}

function NavSection({ title, items, collapsed }: { title: string; items: NavItem[]; collapsed: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      {!collapsed && <p className="px-3 pb-1 text-[10px] font-semibold tracking-wider text-sidebar-foreground/40 uppercase">{title}</p>}
      {items.map((item) => (
        <NavLink key={item.to} item={item} collapsed={collapsed} />
      ))}
    </div>
  )
}

function DesktopSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { user } = useAuth()
  const displayName = (user?.user_metadata?.full_name as string | undefined) || user?.email?.split("@")[0] || "Analyst"

  return (
    <motion.aside
      animate={{ width: collapsed ? 76 : 248 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="sticky top-0 relative hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
    >
      {/* Small, systematic collapse sign in the middle of the border rail */}
      <button
        type="button"
        onClick={onToggle}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="group absolute -right-3 top-1/2 z-40 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-sidebar-border bg-sidebar shadow-md transition-all duration-200 hover:border-primary hover:bg-sidebar-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ChevronLeft
          className={cn(
            "size-3.5 text-sidebar-foreground/70 transition-transform duration-200 group-hover:text-primary",
            collapsed && "rotate-180",
          )}
        />
      </button>

      <div className={cn("flex items-center px-4 py-5", collapsed && "justify-center px-0")}>
        <Brand collapsed={collapsed} />
      </div>

      <nav className="scrollbar-thin flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-2">
        <NavSection title="Main" items={MAIN_NAV} collapsed={collapsed} />
        <NavSection title="Workspace" items={WORKSPACE_NAV} collapsed={collapsed} />
        <NavSection title="System" items={SYSTEM_NAV} collapsed={collapsed} />
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className={cn("flex items-center gap-2.5 rounded-lg px-1 py-1.5", collapsed && "justify-center")}>
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="bg-sidebar-accent text-xs">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{displayName}</p>
              <StatusIndicator label="Online" tone="good" className="[&_p]:text-[10px] [&_p]:text-sidebar-foreground/50" />
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  )
}

function MobileBottomNav() {
  const isActive = useActive()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/95 backdrop-blur md:hidden">
      {MOBILE_NAV.map((item) => {
        const active = isActive(item.to)
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className="size-5" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function NotificationsMenu() {
  const unread = notifications.filter((n) => !n.read).length
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex size-3.5 items-center justify-center rounded-full bg-risk-high text-[9px] font-semibold text-risk-high-foreground">
              {unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.map((n) => (
          <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 whitespace-normal">
            <div className="flex w-full items-center gap-2">
              {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
              <span className="text-sm font-medium">{n.title}</span>
            </div>
            <span className="pl-3.5 text-xs text-muted-foreground">{n.detail}</span>
            <span className="pl-3.5 text-[10px] text-muted-foreground/70">{n.timestamp}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TopBar({ title, onOpenPalette }: { title: string; onOpenPalette: () => void }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSignOut() {
    await signOut()
    navigate("/login", { replace: true })
  }

  const crumbs = ["NetraX", title]
  if (location.pathname.startsWith("/cases/")) crumbs.push(location.pathname.split("/")[2])

  return (
    <header className="glass-panel sticky top-0 z-30 flex h-14 items-center gap-3 border-x-0 border-t-0 px-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
        <Brand compact />
      </div>

      <div className="hidden min-w-0 flex-1 items-center gap-1.5 text-sm md:flex">
        {crumbs.map((c, i) => (
          <span key={c + i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground/40">/</span>}
            <span className={i === crumbs.length - 1 ? "font-semibold" : "text-muted-foreground"}>{c}</span>
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpenPalette}
        aria-label="Search"
        className="flex size-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-muted/50 text-xs text-muted-foreground transition-colors hover:bg-muted md:w-full md:max-w-52 md:justify-start md:px-3 md:py-1.5"
      >
        <Search className="size-3.5" />
        <span className="hidden truncate md:inline">Search…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] md:inline">⌘K</kbd>
      </button>

      <div className="hidden items-center lg:flex">
        <StatusIndicator label="AI Systems Operational" tone="good" />
      </div>

      <NotificationsMenu />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="size-8">
              <AvatarFallback>
                <User className="size-4" />
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="truncate">
            {(user?.user_metadata?.full_name as string | undefined) || user?.email || "Account"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/settings">Settings</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleSignOut}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem("netrax.sidebar-collapsed") === "1"
  })
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    window.localStorage.setItem("netrax.sidebar-collapsed", collapsed ? "1" : "0")
  }, [collapsed])

  // Gmail auto-detect: starts a single shared poll (see lib/gmail/gmail-store.ts)
  // that runs for as long as the app stays open, regardless of which page is
  // active — a no-op until the user connects Gmail in Settings.
  useEffect(() => {
    startGmailPolling()
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isTyping = ["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      if (!isTyping && e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        navigate("/investigate")
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [navigate])

  const title =
    PAGE_TITLES[location.pathname] ??
    (location.pathname.startsWith("/cases/") ? "Case Details" : "NetraX")

  return (
    <div className="flex min-h-svh bg-grid">
      <DesktopSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} onOpenPalette={() => setPaletteOpen(true)} />
        <main className="flex-1 px-4 pt-4 pb-20 md:px-6 md:pb-8">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
      <MobileBottomNav />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}

function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
