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
  | "complete"
  | "archived"
  | "closed"
  | "in-progress"
  | "processing"

type BadgeConfig = {
  bg: string
  color: string
}

const STATUS_MAP: Record<StatusVariant, BadgeConfig> = {
  // Success green
  active:      { bg: "rgba(16,185,129,0.12)", color: "#065F46" },
  complete:    { bg: "rgba(16,185,129,0.12)", color: "#065F46" },
  approved:    { bg: "rgba(16,185,129,0.12)", color: "#065F46" },
  published:   { bg: "rgba(16,185,129,0.12)", color: "#065F46" },
  confirmed:   { bg: "rgba(16,185,129,0.12)", color: "#065F46" },
  delivered:   { bg: "rgba(16,185,129,0.12)", color: "#065F46" },
  received:    { bg: "rgba(16,185,129,0.12)", color: "#065F46" },
  adequate:    { bg: "rgba(16,185,129,0.12)", color: "#065F46" },
  success:     { bg: "rgba(16,185,129,0.12)", color: "#065F46" },

  // Warning amber
  pending:     { bg: "rgba(245,158,11,0.12)", color: "#92400E" },
  draft:       { bg: "rgba(245,158,11,0.12)", color: "#92400E" },
  scheduled:   { bg: "rgba(245,158,11,0.12)", color: "#92400E" },
  invited:     { bg: "rgba(245,158,11,0.12)", color: "#92400E" },

  // Error red
  cancelled:   { bg: "rgba(239,68,68,0.12)", color: "#991B1B" },
  rejected:    { bg: "rgba(239,68,68,0.12)", color: "#991B1B" },
  error:       { bg: "rgba(239,68,68,0.12)", color: "#991B1B" },
  critical:    { bg: "rgba(239,68,68,0.12)", color: "#991B1B" },

  // Grey
  inactive:    { bg: "rgba(17,17,17,0.06)", color: "#6B7280" },
  archived:    { bg: "rgba(17,17,17,0.06)", color: "#6B7280" },
  closed:      { bg: "rgba(17,17,17,0.06)", color: "#6B7280" },

  // Info blue
  info:        { bg: "rgba(59,130,246,0.12)", color: "#1E40AF" },
  submitted:   { bg: "rgba(59,130,246,0.12)", color: "#1E40AF" },
  "in-progress": { bg: "rgba(59,130,246,0.12)", color: "#1E40AF" },
  processing:  { bg: "rgba(59,130,246,0.12)", color: "#1E40AF" },

  // Orange
  warning:     { bg: "rgba(249,115,22,0.12)", color: "#9A3412" },
  overstocked: { bg: "rgba(249,115,22,0.12)", color: "#9A3412" },

  // Roles
  manager:     { bg: "rgba(20,184,166,0.12)", color: "#0F766E" },
  supervisor:  { bg: "rgba(59,130,246,0.12)", color: "#1E40AF" },
  crew:        { bg: "rgba(17,17,17,0.06)", color: "#6B7280" },
}

const FALLBACK: BadgeConfig = { bg: "rgba(17,17,17,0.06)", color: "#6B7280" }

interface StatusBadgeProps {
  status: StatusVariant
  children?: React.ReactNode
  size?: "sm" | "default"
  className?: string
}

export function StatusBadge({
  status,
  children,
  size = "default",
  className,
}: StatusBadgeProps) {
  const config = STATUS_MAP[status] || FALLBACK
  const label = children || status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, " ")

  return (
    <span
      className={cn(
        "ss-badge",
        size === "sm" && "text-[10px] px-2 py-0",
        className
      )}
      style={{ background: config.bg, color: config.color }}
    >
      {label}
    </span>
  )
}

export type { StatusVariant }
