import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  BarChart3,
  UtensilsCrossed,
  Package,
  Users,
  BookOpen,
  Settings,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/AuthContext"
import type { ModuleId } from "@/components/ContextSidebar"

export type { ModuleId }

// ── Module definitions ────────────────────────────────────────

type ModuleConfig = {
  id: ModuleId
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  label: string
  path?: string
}

export const MODULES: ModuleConfig[] = [
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { id: "insights", icon: BarChart3, label: "Insights" },
  { id: "menu", icon: UtensilsCrossed, label: "Menu" },
  { id: "inventory", icon: Package, label: "Inventory" },
  { id: "workforce", icon: Users, label: "Workforce" },
  { id: "operations", icon: BookOpen, label: "Operations" },
]

// Map routes → module ids
export function getModuleForPath(pathname: string): ModuleId {
  if (pathname === "/" || pathname.startsWith("/dashboard")) return "dashboard"
  if (
    pathname.startsWith("/sales") ||
    pathname.startsWith("/workforce/reports") ||
    pathname.startsWith("/insights")
  ) return "insights"
  if (
    pathname.startsWith("/menu") ||
    pathname.startsWith("/inventory/ingredients")
  ) return "menu"
  if (
    pathname.startsWith("/inventory") ||
    pathname.startsWith("/suppliers")
  ) return "inventory"
  if (pathname.startsWith("/workforce")) return "workforce"
  if (pathname.startsWith("/operations")) return "operations"
  if (pathname.startsWith("/admin")) return "settings"
  return "dashboard"
}

// ── Icon Rail ─────────────────────────────────────────────────

interface IconRailProps {
  activeModule: ModuleId
  onModuleClick: (id: ModuleId) => void
}

export default function IconRail({ activeModule, onModuleClick }: IconRailProps) {
  const { profile } = useAuth()

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    }
    if (profile?.email) return profile.email[0].toUpperCase()
    return "?"
  }

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex flex-col items-center py-3 gap-1"
      style={{ width: 64, background: "#111111" }}
    >
      {/* Logo */}
      <NavLink
        to="/dashboard"
        className="mb-2 flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
        style={{ background: "#B8E636" }}
        title="SuperSolt"
      >
        <span className="text-gray-900 font-black text-lg leading-none">S</span>
      </NavLink>

      {/* Module icons */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {MODULES.map(({ id, icon: Icon, label }) => {
          const isActive = activeModule === id
          return (
            <button
              key={id}
              onClick={() => onModuleClick(id)}
              title={label}
              className={cn(
                "relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150",
                isActive
                  ? "text-white"
                  : "text-white/50 hover:text-white/80"
              )}
              style={
                isActive
                  ? { background: "#B8E636", color: "#111111" }
                  : undefined
              }
            >
              <Icon
                size={20}
                style={isActive ? { color: "#111111" } : undefined}
              />
            </button>
          )
        })}
      </nav>

      {/* Bottom: Settings + Avatar */}
      <div className="flex flex-col items-center gap-2 mt-auto">
        <button
          onClick={() => onModuleClick("settings")}
          title="Settings"
          className={cn(
            "w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150",
            activeModule === "settings"
              ? "text-gray-900"
              : "text-white/50 hover:text-white/80"
          )}
          style={
            activeModule === "settings"
              ? { background: "#B8E636", color: "#111111" }
              : undefined
          }
        >
          <Settings
            size={20}
            style={activeModule === "settings" ? { color: "#111111" } : undefined}
          />
        </button>

        <Avatar className="h-8 w-8 ring-2 ring-white/10">
          <AvatarFallback
            className="text-xs font-semibold"
            style={{ background: "#14B8A6", color: "#fff" }}
          >
            {getInitials()}
          </AvatarFallback>
        </Avatar>
      </div>
    </aside>
  )
}
