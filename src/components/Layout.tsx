import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom"
import { useState, useEffect, useCallback } from "react"
import { useTheme } from "next-themes"
import { useAuth } from "@/contexts/AuthContext"
import { useOnboardingRedirect } from "@/hooks/useOnboardingRedirect"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  PackageSearch,
  BarChart2,
  UtensilsCrossed,
  BookOpen,
  ShoppingCart,
  Package,
  ClipboardList,
  Truck,
  ReceiptText,
  BoxesIcon,
  Trash2,
  Users,
  CalendarRange,
  Clock,
  CreditCard,
  CalendarCheck,
  NotebookPen,
  Settings,
  Building2,
  MapPin,
  ShieldCheck,
  Plug,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  ChevronDown,
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

type NavItem = { title: string; url: string; icon: LucideIcon }
type NavSection = { label: string; items: NavItem[] }

const navSections: NavSection[] = [
  {
    label: "INSIGHTS",
    items: [
      { title: "Dashboard",  url: "/dashboard",           icon: LayoutDashboard },
      { title: "Sales",      url: "/sales",               icon: TrendingUp },
      { title: "Labour",     url: "/workforce/reports",   icon: BarChart3 },
      { title: "Inventory",  url: "/insights/inventory",  icon: PackageSearch },
      { title: "P&L",        url: "/insights/pl",         icon: BarChart2 },
    ],
  },
  {
    label: "MENU",
    items: [
      { title: "Recipes",      url: "/menu/recipes",          icon: BookOpen },
      { title: "Menu Items",   url: "/menu/items",            icon: UtensilsCrossed },
      { title: "Ingredients",  url: "/inventory/ingredients", icon: ShoppingCart },
    ],
  },
  {
    label: "INVENTORY",
    items: [
      { title: "Overview",         url: "/inventory/overview",         icon: Package },
      { title: "Order Guide",      url: "/inventory/order-guide",      icon: ClipboardList },
      { title: "Purchase Orders",  url: "/inventory/purchase-orders",  icon: Truck },
      { title: "Invoices",         url: "/inventory/invoices",         icon: ReceiptText },
      { title: "Stock Counts",     url: "/inventory/stock-counts",     icon: BoxesIcon },
      { title: "Waste",            url: "/inventory/waste",            icon: Trash2 },
      { title: "Suppliers",        url: "/suppliers",                  icon: Building2 },
    ],
  },
  {
    label: "WORKFORCE",
    items: [
      { title: "People",            url: "/workforce/people",         icon: Users },
      { title: "Roster",            url: "/workforce/roster",         icon: CalendarRange },
      { title: "Availability",      url: "/workforce/availability",   icon: CalendarCheck },
      { title: "Timesheets",        url: "/workforce/timesheets",     icon: Clock },
      { title: "Payroll Export",    url: "/workforce/payroll-export", icon: CreditCard },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { title: "Daybook", url: "/operations/daybook", icon: NotebookPen },
    ],
  },
]

const settingsItems: NavItem[] = [
  { title: "Organization",  url: "/admin/org-settings",  icon: Building2 },
  { title: "Venue",         url: "/admin/venue-settings", icon: MapPin },
  { title: "Locations",     url: "/admin/locations",     icon: MapPin },
  { title: "Access & Roles", url: "/admin/access-roles", icon: ShieldCheck },
  { title: "Integrations",  url: "/admin/integrations",  icon: Plug },
]

// Bottom tab bar items for mobile
const mobileTabItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard",          icon: LayoutDashboard },
  { title: "Roster",    url: "/workforce/roster",   icon: CalendarRange },
  { title: "Inventory", url: "/inventory/overview", icon: Package },
  { title: "More",      url: "/sales",              icon: Menu },
]

// ─── Sidebar content ─────────────────────────────────────────

function SidebarContent({
  onNavigate,
  onClose,
  isMobile,
}: {
  onNavigate?: () => void
  onClose?: () => void
  isMobile?: boolean
}) {
  const location = useLocation()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const isActive = useCallback(
    (url: string) => {
      if (url === "/dashboard") return location.pathname === "/" || location.pathname === "/dashboard"
      return location.pathname === url || location.pathname.startsWith(url + "/")
    },
    [location.pathname]
  )

  // Auto-open settings if on a settings page
  useEffect(() => {
    if (settingsItems.some((item) => isActive(item.url))) {
      setSettingsOpen(true)
    }
  }, [location.pathname, isActive])

  const handleClick = () => {
    onNavigate?.()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header: logo + venue switcher */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-400 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-gray-900 font-black text-sm leading-none">S</span>
            </div>
            <span className="text-sm font-black tracking-tighter text-foreground uppercase">
              SuperSolt
            </span>
          </div>
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-md flex items-center justify-center text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {/* Venue switcher */}
        <div className="text-sidebar-foreground">
          <VenueSwitcher />
        </div>
      </div>

      {/* Nav sections (scrollable) */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] font-semibold text-sidebar-foreground/50 tracking-widest uppercase mb-1 px-1">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.url)
                return (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    onClick={handleClick}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors relative",
                      active
                        ? "border-l-2 border-brand-400 bg-brand-50 text-brand-800 font-medium dark:bg-brand-900/20 dark:text-brand-400 pl-[10px]"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-brand-600 dark:text-brand-400" : "text-sidebar-foreground/70")} />
                    <span>{item.title}</span>
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Settings (collapsible, pinned) */}
      <div className="shrink-0 border-t border-sidebar-border px-3 py-3">
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
            settingsItems.some((i) => isActive(i.url))
              ? "text-brand-800 dark:text-brand-400"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
          )}
        >
          <Settings className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
          <span className="flex-1 text-left font-medium">Settings</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-sidebar-foreground/40 transition-transform duration-150",
              !settingsOpen && "-rotate-90"
            )}
          />
        </button>
        {settingsOpen && (
          <div className="mt-0.5 space-y-0.5">
            {settingsItems.map((item) => {
              const active = isActive(item.url)
              return (
                <NavLink
                  key={item.url}
                  to={item.url}
                  onClick={handleClick}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                    active
                      ? "border-l-2 border-brand-400 bg-brand-50 text-brand-800 font-medium dark:bg-brand-900/20 dark:text-brand-400 pl-[10px]"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-brand-600 dark:text-brand-400" : "text-sidebar-foreground/70")} />
                  <span>{item.title}</span>
                </NavLink>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Layout ──────────────────────────────────────────────────

export default function Layout() {
  useOnboardingRedirect()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { profile, orgMember, signOut } = useAuth()
  const isMobile = useIsMobile()
  const location = useLocation()

  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    }
    if (profile?.email) return profile.email[0].toUpperCase()
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

  const isActiveTab = (url: string) => {
    if (url === "/dashboard") return location.pathname === "/" || location.pathname === "/dashboard"
    if (url === "/sales") return ["/sales", "/workforce/reports", "/insights"].some(p => location.pathname.startsWith(p))
    return location.pathname === url || location.pathname.startsWith(url + "/")
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* ── Desktop Sidebar ── */}
      {!isMobile && (
        <aside className="fixed inset-y-0 left-0 z-30 w-[220px] bg-sidebar border-r border-sidebar-border flex flex-col dark:bg-slate-900 dark:border-slate-800">
          <SidebarContent />
        </aside>
      )}

      {/* ── Mobile: Backdrop + Drawer ── */}
      {isMobile && (
        <>
          {mobileOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50 animate-fade-in"
              onClick={() => setMobileOpen(false)}
            />
          )}
          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-50 w-[280px] bg-sidebar dark:bg-slate-900 border-r border-sidebar-border dark:border-slate-800 flex flex-col transition-transform duration-200 ease-in-out",
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <SidebarContent
              isMobile
              onClose={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </>
      )}

      {/* ── Main content ── */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0",
          !isMobile && "ml-[220px]"
        )}
      >
        {/* Top header */}
        <header className="h-14 border-b bg-background/80 backdrop-blur-sm flex items-center px-4 gap-3 shrink-0 sticky top-0 z-20">
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          )}

          <div className="flex-1" />

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 relative"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 h-9 px-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-brand-400 text-gray-900 text-xs font-bold">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-medium leading-tight">{getDisplayName()}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">{getRoleDisplay()}</div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover w-48">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {profile?.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/admin/org-settings")}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600 dark:text-red-400">
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <DataInitializer />
          <Outlet />
        </main>

        {/* ── Mobile bottom tab bar ── */}
        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 z-30 h-16 bg-background border-t border-border flex items-center justify-around px-2 safe-area-inset-bottom">
            {mobileTabItems.map((tab) => {
              const active = isActiveTab(tab.url)
              return (
                <NavLink
                  key={tab.url}
                  to={tab.url}
                  className={cn(
                    "flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-[11px] font-medium transition-colors",
                    active
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-muted-foreground"
                  )}
                >
                  <tab.icon className={cn("h-5 w-5", active && "text-brand-600 dark:text-brand-400")} />
                  {tab.title}
                </NavLink>
              )
            })}
          </nav>
        )}
      </div>
    </div>
  )
}
