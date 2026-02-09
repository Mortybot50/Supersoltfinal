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
  scheduled: "bg-yellow-50 text-yellow-700 border-yellow-200",
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  draft: "bg-yellow-50 text-yellow-700 border-yellow-200",
  warning: "bg-orange-50 text-orange-700 border-orange-200",
  overstocked: "bg-orange-50 text-orange-700 border-orange-200",

  // Green family
  confirmed: "bg-green-50 text-green-700 border-green-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  active: "bg-green-50 text-green-700 border-green-200",
  adequate: "bg-green-50 text-green-700 border-green-200",
  success: "bg-green-50 text-green-700 border-green-200",
  delivered: "bg-green-100 text-green-800 border-green-300",
  received: "bg-green-100 text-green-800 border-green-300",

  // Blue family
  published: "bg-blue-50 text-blue-700 border-blue-200",
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
  invited: "bg-blue-50 text-blue-700 border-blue-200",

  // Red family
  cancelled: "bg-red-50 text-red-700 border-red-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  critical: "bg-red-100 text-red-800 border-red-300",
  error: "bg-red-50 text-red-700 border-red-200",
  inactive: "bg-gray-100 text-gray-600 border-gray-200",

  // Roles
  manager: "bg-teal-50 text-teal-800 border-teal-200",
  supervisor: "bg-blue-50 text-blue-800 border-blue-200",
  crew: "bg-gray-100 text-gray-700 border-gray-200",
}

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
  const label = children || status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <Badge
      variant="outline"
      className={cn(
        STATUS_STYLES[status] || "bg-gray-50 text-gray-700 border-gray-200",
        size === "sm" && "text-[10px] px-1.5 py-0",
        className
      )}
    >
      {label}
    </Badge>
  )
}

export type { StatusVariant }
