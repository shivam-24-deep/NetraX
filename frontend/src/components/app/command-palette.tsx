import {
  BarChart3,
  Bell,
  Bookmark,
  Bot,
  Gauge,
  LayoutDashboard,
  Radar,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
} from "lucide-react"
import { useNavigate } from "react-router-dom"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()

  function go(path: string) {
    onOpenChange(false)
    navigate(path)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command Palette" description="Jump to a page or start an action">
      <CommandInput placeholder="Search pages, cases, actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/investigate")}>
            <Sparkles />
            New Investigation
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/dashboard")}>
            <LayoutDashboard />
            Overview
          </CommandItem>
          <CommandItem onSelect={() => go("/investigate")}>
            <Search />
            Investigate
          </CommandItem>
          <CommandItem onSelect={() => go("/cases")}>
            <ShieldAlert />
            Cases
          </CommandItem>
          <CommandItem onSelect={() => go("/alerts")}>
            <Bell />
            Alerts
          </CommandItem>
          <CommandItem onSelect={() => go("/analytics")}>
            <BarChart3 />
            Analytics
          </CommandItem>
          <CommandItem onSelect={() => go("/threat-intelligence")}>
            <Radar />
            Threat Intelligence
          </CommandItem>
          <CommandItem onSelect={() => go("/agent-control-room")}>
            <Bot />
            Agent Control Room
          </CommandItem>
          <CommandItem onSelect={() => go("/model-performance")}>
            <Gauge />
            Model Performance
          </CommandItem>
          <CommandItem onSelect={() => go("/saved-cases")}>
            <Bookmark />
            Saved Cases
          </CommandItem>
          <CommandItem onSelect={() => go("/settings")}>
            <Settings />
            Settings
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
