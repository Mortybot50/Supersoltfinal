import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVertical, Pencil, Trash2, ArrowLeftRight, AlertTriangle } from "lucide-react"
import { RosterShift } from "@/types"
import { formatTimeCompact, getRoleColor, formatLabourCost } from "@/lib/utils/rosterCalculations"

interface RosterShiftCardProps {
  shift: RosterShift
  staffName: string
  onEdit: (shift: RosterShift) => void
  onDelete: (shift: RosterShift) => void
  onRequestSwap: (shift: RosterShift) => void
  compact?: boolean
  showStaffName?: boolean
  showCost?: boolean
}

export function RosterShiftCard({
  shift,
  staffName,
  onEdit,
  onDelete,
  onRequestSwap,
  compact = false,
  showStaffName = true,
  showCost = false,
}: RosterShiftCardProps) {
  const hasPenalty = shift.penalty_type && shift.penalty_type !== "none"
  const roleColor = getRoleColor(shift.role || "crew")
  const hasWarnings = shift.warnings && shift.warnings.length > 0

  if (compact) {
    return (
      <div
        className={`rounded px-1.5 py-0.5 text-[10px] cursor-pointer truncate border-l-2 ${roleColor.light} ${roleColor.border}`}
        onClick={(e) => {
          e.stopPropagation()
          onEdit(shift)
        }}
      >
        {formatTimeCompact(shift.start_time)}-{formatTimeCompact(shift.end_time)}
      </div>
    )
  }

  return (
    <div
      className={`group rounded px-2 py-1.5 text-xs cursor-pointer transition-colors border-l-2 ${roleColor.light} ${roleColor.border}`}
      onClick={(e) => {
        e.stopPropagation()
        onEdit(shift)
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${roleColor.bg} shrink-0`} />
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {formatTimeCompact(shift.start_time)} - {formatTimeCompact(shift.end_time)}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
              aria-label="Shift actions"
            >
              <MoreVertical className="h-3 w-3" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(shift)}>
              <Pencil className="h-3 w-3 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRequestSwap(shift)}>
              <ArrowLeftRight className="h-3 w-3 mr-2" />
              Request Swap
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(shift)}
              className="text-destructive"
            >
              <Trash2 className="h-3 w-3 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showStaffName && (
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-gray-600 dark:text-gray-400 truncate">
            {staffName}
          </span>
          <div className="flex items-center gap-1">
            {hasPenalty && (
              <Badge variant="outline" className="text-[9px] h-4 px-1 text-orange-600 border-orange-200 bg-orange-50">
                {shift.penalty_type === 'public_holiday' ? 'PH' : shift.penalty_type === 'sunday' ? 'Sun' : shift.penalty_type === 'saturday' ? 'Sat' : shift.penalty_type === 'evening' ? 'Eve' : shift.penalty_type?.replace('_', ' ')}
              </Badge>
            )}
            {shift.break_minutes > 0 && (
              <Badge variant="outline" className="text-[9px] h-4 px-1">
                {shift.break_minutes}m
              </Badge>
            )}
          </div>
        </div>
      )}

      {showCost && shift.total_cost > 0 && (
        <div className="flex items-center justify-between mt-0.5 text-[10px] text-muted-foreground">
          <span>{shift.total_hours.toFixed(1)}h</span>
          <span className="font-medium">{formatLabourCost(shift.total_cost)}</span>
        </div>
      )}

      {hasWarnings && (
        <div className="flex items-center gap-1 mt-0.5 text-[9px] text-orange-600">
          <AlertTriangle className="h-2.5 w-2.5" />
          <span>{shift.warnings![0]}</span>
        </div>
      )}
    </div>
  )
}
