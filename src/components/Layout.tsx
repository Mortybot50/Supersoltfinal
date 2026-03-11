import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useState, useEffect, useCallback } from "react"
import { useTheme } from "next-themes"
import { useAuth } from "@/contexts/AuthContext"
import { useOnboardingRedirect } from "@/hooks/useOnboardingRedirect"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  LayoutDashboard,
  BarChart3,
  Package,
  Users,
  Settings,
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
import IconRail, { getModuleForPath } from "./IconRail"
import ContextSidebar, { CONTEXT_SIDEBAR_KEY } from "./ContextSidebar"
import type { ModuleId } from "./ContextSidebar"

// ── Mobile bottom tab config ──────────────────────────────────

const MOBILE_TABS: {
  id: ModuleId
  icon: React.ComponentType<{ size?: number }>
  label: string
  path?: string
}[] = [
  { id: "dashboard", icon: LayoutDashboard, label: "Home", path: "/dashboard" },
  { id: "insights", icon: BarChart3, label: "Insights" },
  { id: "inventory", icon: Package, label: "Inventory" },
  { id: "workforce", icon: Users, label: "Workforce" },
  { id: "settings", icon: Settings, label: "Settings" },
]

// ── Layout ────────────────────────────────────────────────────

export default function Layout() {
  useOnboardingRedirect()
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, setTheme } = useTheme()
  const { profile, orgMember, signOut } = useAuth()
  const isMobile = useIsMobile()

  // Active module (derived from route, can be overridden by clicking icon rail)
  const [activeModule, setActiveModule] = useState<ModuleId>(() =>
    getModuleForPath(location.pathname)
  )

  // Context sidebar collapsed state
  const [contextCollapsed, setContextCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(CONTEXT_SIDEBAR_KEY) === "true"
    }
    return false
  })

  // Mobile drawer open state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  // Sync active module with route changes
  useEffect(() => {
    const mod = getModuleForPath(location.pathname)
    setActiveModule(mod)
  }, [location.pathname])

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false)
  }, [location.pathname])

  const toggleContextSidebar = useCallback(() => {
    setContextCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(CONTEXT_SIDEBAR_KEY, String(next))
      return next
    })
  }, [])

  const handleModuleClick = useCallback((id: ModuleId) => {
    setActiveModule(id)
    if (id === "dashboard") {
      navigate("/dashboard")
      return
    }
    // If context sidebar is collapsed, expand it
    if (contextCollapsed) {
      setContextCollapsed(false)
      localStorage.setItem(CONTEXT_SIDEBAR_KEY, "false")
    }
    // On mobile, open drawer
    if (isMobile) {
      setMobileDrawerOpen(true)
    }
  }, [contextCollapsed, isMobile, navigate])

  const isActiveRoute = useCallback(
    (url: string) => {
      if (url === "/dashboard") return location.pathname === "/" || location.pathname === "/dashboard"
      return location.pathname === url || location.pathname.startsWith(url + "/")
    },
    [location.pathname]
  )

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

  // Total sidebar width on desktop
  const sidebarWidth = isMobile ? 0 : (64 + (contextCollapsed ? 0 : 240))

  return (
    <div className="min-h-screen flex w-full" style={{ background: "var(--surface-page)" }}>
      {/* ── Desktop: Icon Rail ─── */}
      {!isMobile && (
        <IconRail
          activeModule={activeModule}
          onModuleClick={handleModuleClick}
        />
      )}

      {/* ── Desktop: Context Sidebar ─── */}
      {!isMobile && (
        <ContextSidebar
          activeModule={activeModule}
          collapsed={contextCollapsed}
          onToggle={toggleContextSidebar}
          isActiveRoute={isActiveRoute}
        />
      )}

      {/* ── Mobile: Context Drawer ─── */}
      {isMobile && mobileDrawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 flex flex-col"
            style={{ width: 280, background: "#FAFAFA", borderRight: "1px solid #E5E7EB" }}
          >
            <div
              className="flex items-center justify-between px-4"
              style={{ height: 56, borderBottom: "1px solid #E5E7EB" }}
            >
              <span className="text-sm font-semibold" style={{ color: "#111111" }}>Navigation</span>
              <button
                className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100"
                onClick={() => setMobileDrawerOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <ContextSidebar
              activeModule={activeModule}
              collapsed={false}
              onToggle={() => setMobileDrawerOpen(false)}
              isActiveRoute={isActiveRoute}
              onNavigate={() => setMobileDrawerOpen(false)}
            />
          </aside>
        </>
      )}

      {/* ── Main content area ─── */}
      <div
        className="flex-1 flex flex-col min-w-0 ss-sidebar-transition"
        style={{ marginLeft: sidebarWidth }}
      >
        {/* ── Header ─── */}
        <header
          className="h-14 flex items-center px-4 gap-4 shrink-0"
          style={{
            background: "var(--surface-card)",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          {/* Mobile: hamburger */}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMobileDrawerOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          )}

          {/* Expand context sidebar button (when collapsed, desktop only) */}
          {!isMobile && contextCollapsed && (
            <button
              onClick={toggleContextSidebar}
              className="h-8 w-8 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Expand navigation"
            >
              <ChevronRight size={16} />
            </button>
          )}

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
                  <AvatarFallback
                    className="text-xs font-semibold"
                    style={{ background: "#14B8A6", color: "#fff" }}
                  >
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
              <DropdownMenuItem onClick={() => navigate("/admin/org-settings")}>
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

        {/* ── Page content ─── */}
        <main className="flex-1 overflow-auto ss-page-enter">
          <DataInitializer />
          <Outlet />
        </main>

        {/* ── Mobile bottom tab bar ─── */}
        {isMobile && (
          <nav
            className="shrink-0 flex items-center justify-around px-2"
            style={{
              height: 60,
              background: "#111111",
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {MOBILE_TABS.map(({ id, icon: Icon, label }) => {
              const isActive = activeModule === id
              return (
                <button
                  key={id}
                  onClick={() => handleModuleClick(id)}
                  className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors"
                  style={{ color: isActive ? "#B8E636" : "rgba(255,255,255,0.5)" }}
                >
                  <Icon size={20} />
                  <span className="text-[10px] font-medium">{label}</span>
                </button>
              )
            })}
          </nav>
        )}
      </div>
    </div>
  )
}
