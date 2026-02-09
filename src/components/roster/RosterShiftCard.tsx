import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVertical, Pencil, Trash2, ArrowLeftRight } from "lucide-react"
import { RosterShift } from "@/types"
import { formatTimeCompact } from "@/lib/utils/rosterCalculations"

interface RosterShiftCardProps {
  shift: RosterShift
  staffName: string
  onEdit: (shift: RosterShift) => void
  onDelete: (shift: RosterShift) => void
  onRequestSwap: (shift: RosterShift) => void
  compact?: boolean
  showStaffName?: boolean
}

export function RosterShiftCard({
  shift,
  staffName,
  onEdit,
  onDelete,
  onRequestSwap,
  compact = false,
  showStaffName = true,
}: RosterShiftCardProps) {
  const hasPenalty = shift.penalty_type && shift.penalty_type !== "none"

  if (compact) {
    return (
      <div
        className={`rounded px-1.5 py-0.5 text-[10px] cursor-pointer truncate ${
          hasPenalty
            ? "bg-orange-100 dark:bg-orange-900/30 border-l-2 border-orange-500"
            : "bg-blue-100 dark:bg-blue-900/30 border-l-2 border-blue-500"
        }`}
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
      className={`group rounded px-2 py-1.5 text-xs cursor-pointer transition-colors ${
        hasPenalty
          ? "bg-orange-100 dark:bg-orange-900/30 border-l-2 border-orange-500"
          : "bg-blue-100 dark:bg-blue-900/30 border-l-2 border-blue-500"
      }`}
      onClick={(e) => {
        e.stopPropagation()
        onEdit(shift)
      }}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {formatTimeCompact(shift.start_time)} - {formatTimeCompact(shift.end_time)}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3 w-3" />
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
            {shift.break_minutes > 0 && (
              <Badge variant="outline" className="text-[9px] h-4 px-1">
                {shift.break_minutes}m
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
