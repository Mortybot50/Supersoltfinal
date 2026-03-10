import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom"
import { useState, useEffect, useRef, useCallback } from "react"
import { useTheme } from "next-themes"
import { useAuth } from "@/contexts/AuthContext"
import { useOnboardingRedirect } from "@/hooks/useOnboardingRedirect"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  BarChart3,
  UtensilsCrossed,
  Package,
  Users,
  ClipboardList,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import DataInitializer from "./DataInitializer"
import VenueSwitcher from "./venues/VenueSwitcher"
import { LucideIcon } from "lucide-react"

// ─── Navigation config ───────────────────────────────────────

type NavGroup = {
  title: string
  icon: LucideIcon
  items: { title: string; url: string }[]
}

const mainGroups: NavGroup[] = [
  {
    title: "Insights",
    icon: BarChart3,
    items: [
      { title: "Sales", url: "/sales" },
      { title: "Labour", url: "/workforce/reports" },
      { title: "Inventory", url: "/inventory/overview" },
    ],
  },
  {
    title: "Menu",
    icon: UtensilsCrossed,
    items: [
      { title: "Recipes", url: "/menu/recipes" },
      { title: "Menu Items", url: "/menu/items" },
      { title: "Ingredients", url: "/inventory/ingredients" },
    ],
  },
  {
    title: "Inventory",
    icon: Package,
    items: [
      { title: "Overview", url: "/inventory/overview" },
      { title: "Order Guide", url: "/inventory/order-guide" },
      { title: "Purchase Orders", url: "/inventory/purchase-orders" },
      { title: "Invoices", url: "/inventory/invoices" },
      { title: "Stock Counts", url: "/inventory/stock-counts" },
      { title: "Waste", url: "/inventory/waste" },
      { title: "Food Cost AvT", url: "/inventory/food-cost" },
      { title: "Price Tracking", url: "/inventory/price-tracking" },
      { title: "Suppliers", url: "/suppliers" },
    ],
  },
  {
    title: "Workforce",
    icon: Users,
    items: [
      { title: "People", url: "/workforce/people" },
      { title: "Qualifications", url: "/workforce/qualifications" },
      { title: "Roster", url: "/workforce/roster" },
      { title: "Availability & Leave", url: "/workforce/availability" },
      { title: "Timesheets", url: "/workforce/timesheets" },
      { title: "Payroll Export", url: "/workforce/payroll-export" },
    ],
  },
  {
    title: "Operations",
    icon: ClipboardList,
    items: [
      { title: "Daybook", url: "/operations/daybook" },
      { title: "Compliance", url: "/operations/compliance" },
    ],
  },
]

const settingsGroup: NavGroup = {
  title: "Settings",
  icon: Settings,
  items: [
    { title: "Organization", url: "/admin/org-settings" },
    { title: "Venue", url: "/admin/venue-settings" },
    { title: "Locations", url: "/admin/locations" },
    { title: "Access & Roles", url: "/admin/access-roles" },
    { title: "Data Imports", url: "/admin/data-imports" },
    { title: "Integrations", url: "/admin/integrations" },
  ],
}

// ─── localStorage key ────────────────────────────────────────

const SIDEBAR_COLLAPSED_KEY = "supersolt:sidebar-collapsed"

// ─── Flyout (collapsed mode tooltip) ─────────────────────────

function GroupFlyout({
  group,
  isActiveRoute,
  onNavigate,
}: {
  group: NavGroup
  isActiveRoute: (url: string) => boolean
  onNavigate: () => void
}) {
  return (
    <div className="absolute left-full top-0 ml-2 z-50 min-w-[180px] rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800 py-2 animate-in fade-in-0 zoom-in-95 duration-100">
      <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {group.title}
      </div>
      {group.items.map((item) => (
        <NavLink
          key={item.url}
          to={item.url}
          onClick={onNavigate}
          className={cn(
            "block px-3 py-1.5 text-sm transition-colors",
            isActiveRoute(item.url)
              ? "text-brand-800 bg-brand-50 dark:text-brand-400 dark:bg-brand/10 font-semibold"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700"
          )}
        >
          {item.title}
        </NavLink>
      ))}
    </div>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────

function AppSidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}) {
  const location = useLocation()
  const isMobile = useIsMobile()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [flyoutGroup, setFlyoutGroup] = useState<string | null>(null)
  const flyoutTimeout = useRef<ReturnType<typeof setTimeout>>()

  const isActiveRoute = useCallback(
    (url: string) => {
      if (url === "/dashboard") return location.pathname === "/" || location.pathname === "/dashboard"
      return location.pathname === url || location.pathname.startsWith(url + "/")
    },
    [location.pathname]
  )

  // Auto-expand groups containing the active route
  useEffect(() => {
    const all = [...mainGroups, settingsGroup]
    const active = new Set<string>()
    for (const group of all) {
      if (group.items.some((item) => isActiveRoute(item.url))) {
        active.add(group.title)
      }
    }
    setExpandedGroups(active)
  }, [location.pathname, isActiveRoute])

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(title)) {
        next.delete(title)
      } else {
        next.add(title)
      }
      return next
    })
  }

  const handleNavClick = () => {
    if (isMobile) onMobileClose()
  }

  const handleFlyoutEnter = (title: string) => {
    if (!collapsed || isMobile) return
    clearTimeout(flyoutTimeout.current)
    setFlyoutGroup(title)
  }

  const handleFlyoutLeave = () => {
    flyoutTimeout.current = setTimeout(() => setFlyoutGroup(null), 150)
  }

  const isGroupActive = (group: NavGroup) =>
    group.items.some((item) => isActiveRoute(item.url))

  // Render a nav group (works in both expanded and collapsed modes)
  const renderGroup = (group: NavGroup) => {
    const expanded = expandedGroups.has(group.title)
    const active = isGroupActive(group)

    if (collapsed && !isMobile) {
      // Collapsed mode: icon only with flyout on hover
      return (
        <div
          key={group.title}
          className="relative"
          onMouseEnter={() => handleFlyoutEnter(group.title)}
          onMouseLeave={handleFlyoutLeave}
        >
          <button
            className={cn(
              "w-10 h-10 mx-auto flex items-center justify-center rounded-lg transition-colors",
              active
                ? "text-brand-800 bg-brand-50 dark:text-brand-400 dark:bg-brand/10"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800"
            )}
            title={group.title}
          >
            <group.icon className="h-5 w-5" />
          </button>
          {flyoutGroup === group.title && (
            <GroupFlyout
              group={group}
              isActiveRoute={isActiveRoute}
              onNavigate={() => setFlyoutGroup(null)}
            />
          )}
        </div>
      )
    }

    // Expanded mode: full group with sub-items
    return (
      <div key={group.title}>
        <button
          onClick={() => toggleGroup(group.title)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left",
            active
              ? "text-brand-800 dark:text-brand-400"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
          )}
        >
          <group.icon className="h-5 w-5 shrink-0" />
          <span className="text-xs uppercase tracking-wider font-semibold flex-1">
            {group.title}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-slate-300 dark:text-slate-600 transition-transform duration-150",
              !expanded && "-rotate-90"
            )}
          />
        </button>
        <div
          className={cn(
            "overflow-hidden transition-all duration-150",
            expanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="mt-1 space-y-0.5">
            {group.items.map((item) => (
              <NavLink
                key={item.url}
                to={item.url}
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-2 pl-10 pr-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  isActiveRoute(item.url)
                    ? "text-brand-800 bg-brand-50 font-semibold dark:text-brand-400 dark:bg-brand/10"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800"
                )}
              >
                <span
                  className={cn(
                    "w-1 h-1 rounded-full shrink-0",
                    isActiveRoute(item.url)
                      ? "bg-brand dark:bg-brand-400"
                      : "bg-slate-300 dark:bg-slate-600"
                  )}
                />
                {item.title}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo + collapse toggle */}
      <div
        className={cn(
          "flex items-center h-14 shrink-0 border-b border-slate-200 dark:border-slate-800",
          collapsed && !isMobile ? "justify-center px-2" : "justify-between px-4"
        )}
      >
        {collapsed && !isMobile ? (
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
            <span className="text-gray-900 font-black text-lg">S</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center shrink-0">
              <span className="text-gray-900 font-black text-lg">S</span>
            </div>
            <span className="text-lg font-black tracking-tight text-gray-900 dark:text-white uppercase">
              SuperSolt
            </span>
          </div>
        )}
        {!isMobile && (
          <button
            onClick={onToggle}
            className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        )}
        {isMobile && (
          <button
            onClick={onMobileClose}
            className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dashboard (standalone, top) */}
      <div className={cn("px-2 pt-3 shrink-0", collapsed && !isMobile && "flex justify-center")}>
        {collapsed && !isMobile ? (
          <NavLink
            to="/dashboard"
            onClick={handleNavClick}
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
              isActiveRoute("/dashboard")
                ? "text-brand-800 bg-brand-50 dark:text-brand-400 dark:bg-brand/10"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800"
            )}
            title="Dashboard"
          >
            <LayoutDashboard className="h-5 w-5" />
          </NavLink>
        ) : (
          <NavLink
            to="/dashboard"
            onClick={handleNavClick}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
              isActiveRoute("/dashboard")
                ? "text-brand-800 bg-brand-50 font-semibold dark:text-brand-400 dark:bg-brand/10"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800"
            )}
          >
            <LayoutDashboard className="h-5 w-5 shrink-0" />
            Dashboard
          </NavLink>
        )}
      </div>

      {/* Main groups (scrollable) */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto px-2 py-3 space-y-1",
          collapsed && !isMobile && "flex flex-col items-center space-y-2"
        )}
      >
        {mainGroups.map(renderGroup)}
      </nav>

      {/* Settings (pinned bottom) */}
      <div
        className={cn(
          "shrink-0 border-t border-slate-100 dark:border-slate-800 px-2 pt-3 pb-3",
          collapsed && !isMobile && "flex justify-center"
        )}
      >
        {renderGroup(settingsGroup)}
      </div>
    </div>
  )

  // Mobile: overlay
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 transition-opacity"
            onClick={onMobileClose}
          />
        )}
        {/* Sidebar drawer */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-[280px] bg-white dark:bg-slate-900 transform transition-transform duration-200 ease-in-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {sidebarContent}
        </aside>
      </>
    )
  }

  // Desktop: fixed sidebar
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-200 ease-in-out flex flex-col",
        collapsed ? "w-16" : "w-[240px]"
      )}
    >
      {sidebarContent}
    </aside>
  )
}

// ─── Layout ──────────────────────────────────────────────────

export default function Layout() {
  useOnboardingRedirect();
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { profile, currentVenue, venues, setCurrentVenue, orgMember, signOut } = useAuth()
  const isMobile = useIsMobile()

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true"
    }
    return false
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      return next
    })
  }, [])

  // Close mobile sidebar on route change
  const location = useLocation()
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase()
    }
    return "?"
  }

  const getDisplayName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`
    }
    return profile?.email || "User"
  }

  const getRoleDisplay = () => {
    if (!orgMember?.role) return ""
    return orgMember.role.charAt(0).toUpperCase() + orgMember.role.slice(1)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate("/login")
  }

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Spacer for fixed sidebar on desktop */}
      {!isMobile && (
        <div
          className={cn(
            "shrink-0 transition-all duration-200 ease-in-out",
            collapsed ? "w-16" : "w-[240px]"
          )}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-background flex items-center px-4 gap-4 shrink-0">
          {/* Mobile hamburger */}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          )}

          {/* Venue Selector */}
          <VenueSwitcher />

          <div className="flex-1" />

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-medium">{getDisplayName()}</div>
                  <div className="text-xs text-muted-foreground">{getRoleDisplay()}</div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/admin/org-settings')}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 overflow-auto">
          <DataInitializer />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
