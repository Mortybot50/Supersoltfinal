import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"
import { ChevronLeft, MapPin, ChevronDown } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type ModuleId =
  | "dashboard"
  | "insights"
  | "menu"
  | "inventory"
  | "workforce"
  | "operations"
  | "settings"

// ── Sub-nav per module ────────────────────────────────────────

const SUB_NAV: Record<ModuleId, { title: string; url: string }[]> = {
  dashboard: [],
  insights: [
    { title: "Sales", url: "/sales" },
    { title: "Labour", url: "/workforce/reports" },
    { title: "Inventory", url: "/insights/inventory" },
    { title: "P&L", url: "/insights/pl" },
  ],
  menu: [
    { title: "Recipes", url: "/menu/recipes" },
    { title: "Menu Items", url: "/menu/items" },
    { title: "Ingredients", url: "/inventory/ingredients" },
  ],
  inventory: [
    { title: "Overview", url: "/inventory/overview" },
    { title: "Order Guide", url: "/inventory/order-guide" },
    { title: "Purchase Orders", url: "/inventory/purchase-orders" },
    { title: "Invoices", url: "/inventory/invoices" },
    { title: "Stock Counts", url: "/inventory/stock-counts" },
    { title: "Waste", url: "/inventory/waste" },
    { title: "Suppliers", url: "/suppliers" },
  ],
  workforce: [
    { title: "People", url: "/workforce/people" },
    { title: "Roster", url: "/workforce/roster" },
    { title: "Availability & Leave", url: "/workforce/availability" },
    { title: "Timesheets", url: "/workforce/timesheets" },
    { title: "Payroll Export", url: "/workforce/payroll-export" },
  ],
  operations: [
    { title: "Daybook", url: "/operations/daybook" },
    // Hidden for MVP: { title: "Compliance", url: "/operations/compliance" },
  ],
  settings: [
    { title: "Organization", url: "/admin/org-settings" },
    { title: "Venue", url: "/admin/venue-settings" },
    { title: "Locations", url: "/admin/locations" },
    { title: "Access & Roles", url: "/admin/access-roles" },
    // Hidden for MVP: { title: "Data Imports", url: "/admin/data-imports" },
    { title: "Integrations", url: "/admin/integrations" },
  ],
}

const MODULE_LABELS: Record<ModuleId, string> = {
  dashboard: "Dashboard",
  insights: "Insights",
  menu: "Menu",
  inventory: "Inventory",
  workforce: "Workforce",
  operations: "Operations",
  settings: "Settings",
}

export const CONTEXT_SIDEBAR_KEY = "supersolt:context-sidebar-collapsed"

// ── Context Sidebar ───────────────────────────────────────────

interface ContextSidebarProps {
  activeModule: ModuleId
  collapsed: boolean
  onToggle: () => void
  isActiveRoute: (url: string) => boolean
  onNavigate?: () => void
}

export default function ContextSidebar({
  activeModule,
  collapsed,
  onToggle,
  isActiveRoute,
  onNavigate,
}: ContextSidebarProps) {
  const { currentVenue, venues, setCurrentVenue } = useAuth()
  const items = SUB_NAV[activeModule] || []
  const moduleLabel = MODULE_LABELS[activeModule]

  return (
    <aside
      className="fixed inset-y-0 z-30 flex flex-col ss-sidebar-transition overflow-hidden"
      style={{
        left: 64,
        width: collapsed ? 0 : 240,
        background: "#FAFAFA",
        borderRight: collapsed ? "none" : "1px solid #E5E7EB",
      }}
    >
      <div className="flex flex-col h-full" style={{ width: 240 }}>
        {/* Header: venue switcher */}
        <div
          className="flex items-center justify-between px-4 shrink-0"
          style={{ height: 56, borderBottom: "1px solid #E5E7EB" }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 text-left min-w-0 hover:opacity-80 transition-opacity">
                <MapPin size={14} style={{ color: "#14B8A6", flexShrink: 0 }} />
                <span
                  className="text-sm font-semibold truncate"
                  style={{ color: "#111111", maxWidth: 140 }}
                >
                  {currentVenue?.name || "Select Venue"}
                </span>
                <ChevronDown size={14} style={{ color: "#9CA3AF", flexShrink: 0 }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[200px]">
              <DropdownMenuLabel>Switch Venue</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {venues.map((venue) => (
                <DropdownMenuItem
                  key={venue.id}
                  onClick={() => setCurrentVenue(venue)}
                  className={currentVenue?.id === venue.id ? "bg-accent" : ""}
                >
                  <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                  {venue.name}
                </DropdownMenuItem>
              ))}
              {venues.length === 0 && (
                <DropdownMenuItem disabled>No venues available</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Collapse toggle */}
          <button
            onClick={onToggle}
            className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
        </div>

        {/* Module label */}
        <div className="px-4 pt-4 pb-2 shrink-0">
          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "#9CA3AF", letterSpacing: "0.5px" }}
          >
            {moduleLabel}
          </p>
        </div>

        {/* Sub-nav items */}
        {items.length > 0 ? (
          <nav className="flex-1 overflow-y-auto px-2 pb-4">
            {items.map((item) => {
              const active = isActiveRoute(item.url)
              return (
                <NavLink
                  key={item.url}
                  to={item.url}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-md text-sm transition-all duration-150 my-0.5",
                    active
                      ? "font-semibold"
                      : "font-normal hover:bg-gray-100"
                  )}
                  style={
                    active
                      ? {
                          color: "#14B8A6",
                          background: "rgba(20,184,166,0.08)",
                          borderLeft: "2px solid #14B8A6",
                          paddingLeft: 10,
                        }
                      : { color: "#374151" }
                  }
                >
                  {item.title}
                </NavLink>
              )
            })}
          </nav>
        ) : (
          <div className="flex-1 flex items-start justify-center pt-8 px-4">
            <p className="text-xs text-gray-400 text-center">
              Select a module to see navigation options.
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
