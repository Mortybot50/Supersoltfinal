import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type StatusVariant =
  // Shifts / Roster
  | "scheduled"
  | "confirmed"
  | "published"
  | "cancelled"
  // Timesheets / Approvals
  | "pending"
  | "approved"
  | "rejected"
  // Orders
  | "draft"
  | "submitted"
  | "delivered"
  | "received"
  // Staff
  | "active"
  | "inactive"
  | "invited"
  // Inventory
  | "critical"
  | "warning"
  | "adequate"
  | "overstocked"
  // Roles
  | "manager"
  | "supervisor"
  | "crew"
  // Generic
  | "info"
  | "success"
  | "error"

const STATUS_STYLES: Record<StatusVariant, string> = {
  // Yellow family
  scheduled:   "bg-amber-50  text-amber-700  border-amber-200  dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  pending:     "bg-amber-50  text-amber-700  border-amber-200  dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  draft:       "bg-amber-50  text-amber-700  border-amber-200  dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
  warning:     "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800",
  overstocked: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800",

  // Green family
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
  approved:  "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
  active:    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
  adequate:  "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
  success:   "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",
  received:  "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",

  // Blue family
  published: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  submitted: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  info:      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  invited:   "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",

  // Red family
  cancelled: "bg-red-50  text-red-700  border-red-200  dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
  rejected:  "bg-red-50  text-red-700  border-red-200  dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
  critical:  "bg-red-100 text-red-800  border-red-300  dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
  error:     "bg-red-50  text-red-700  border-red-200  dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
  inactive:  "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",

  // Roles
  manager:    "bg-teal-50   text-teal-800   border-teal-200   dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800",
  supervisor: "bg-blue-50   text-blue-800   border-blue-200   dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  crew:       "bg-slate-100 text-slate-700  border-slate-200  dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
}

// Dot colours for the dot variant
const DOT_COLORS: Record<StatusVariant, string> = {
  scheduled: "bg-amber-500",   pending: "bg-amber-500",   draft: "bg-amber-500",
  warning: "bg-orange-500",    overstocked: "bg-orange-500",
  confirmed: "bg-emerald-500", approved: "bg-emerald-500", active: "bg-emerald-500",
  adequate: "bg-emerald-500",  success: "bg-emerald-500",  delivered: "bg-emerald-600",
  received: "bg-emerald-600",
  published: "bg-blue-500",    submitted: "bg-blue-500",   info: "bg-blue-500",
  invited: "bg-blue-500",
  cancelled: "bg-red-500",     rejected: "bg-red-500",     critical: "bg-red-600",
  error: "bg-red-500",         inactive: "bg-slate-400",
  manager: "bg-teal-600",      supervisor: "bg-blue-500",  crew: "bg-slate-400",
}

interface StatusBadgeProps {
  status: StatusVariant
  children?: React.ReactNode
  size?: "sm" | "default"
  variant?: "badge" | "dot"
  className?: string
}

export function StatusBadge({
  status,
  children,
  size = "default",
  variant = "badge",
  className,
}: StatusBadgeProps) {
  const label = children || status.charAt(0).toUpperCase() + status.slice(1)

  if (variant === "dot") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", className)}>
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", DOT_COLORS[status] || "bg-slate-400")} />
        {label}
      </span>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium",
        STATUS_STYLES[status] || "bg-slate-50 text-slate-700 border-slate-200",
        size === "sm" && "text-[10px] px-1.5 py-0",
        className
      )}
    >
      {label}
    </Badge>
  )
}

export type { StatusVariant }
