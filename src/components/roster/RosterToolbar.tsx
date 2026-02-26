import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Users,
  Copy,
  Save,
  Printer,
  CalendarClock,
  Send,
  Settings,
  LayoutGrid,
  Layers,
} from "lucide-react"
import { RosterViewMode, RosterDisplayMode, RosterGroupBy } from "@/types"

interface RosterToolbarProps {
  dateRangeLabel: string
  viewMode: RosterViewMode
  displayMode: RosterDisplayMode
  groupBy: RosterGroupBy
  onNavigateBack: () => void
  onNavigateForward: () => void
  onViewModeChange: (mode: RosterViewMode) => void
  onDisplayModeChange: (mode: RosterDisplayMode) => void
  onGroupByChange: (groupBy: RosterGroupBy) => void
  onCopyPreviousWeek: () => void
  onSaveTemplate: () => void
  onPrint: () => void
  onManageAvailability: () => void
  onPublish: () => void
  publishDisabled: boolean
  onBackToFortnight?: () => void
}

const VIEW_MODE_LABELS: Record<RosterViewMode, string> = {
  day: "Day",
  week: "Week",
  fortnight: "Fortnight",
  month: "Month",
}

const DISPLAY_MODE_LABELS: Record<RosterDisplayMode, string> = {
  staff: "Staff View",
  stacked: "Stacked View",
}

const GROUP_BY_LABELS: Record<RosterGroupBy, string> = {
  none: "No Grouping",
  team: "Group by Team",
  position: "Group by Position",
}

export function RosterToolbar({
  dateRangeLabel,
  viewMode,
  displayMode,
  groupBy,
  onNavigateBack,
  onNavigateForward,
  onViewModeChange,
  onDisplayModeChange,
  onGroupByChange,
  onCopyPreviousWeek,
  onSaveTemplate,
  onPrint,
  onManageAvailability,
  onPublish,
  publishDisabled,
  onBackToFortnight,
}: RosterToolbarProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border-b px-4 py-2 flex items-center gap-3 print:hidden flex-wrap">
      {/* Date Navigation */}
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous period" onClick={onNavigateBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" className="h-8 px-3 font-medium text-sm">
          {dateRangeLabel}
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Next period" onClick={onNavigateForward}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* View Mode Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <Calendar className="h-4 w-4 mr-2" />
            {VIEW_MODE_LABELS[viewMode]}
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {(Object.keys(VIEW_MODE_LABELS) as RosterViewMode[]).map((mode) => (
            <DropdownMenuItem
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={viewMode === mode ? "bg-accent" : ""}
            >
              {VIEW_MODE_LABELS[mode]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Back to Fortnight (Day view only) */}
      {viewMode === "day" && onBackToFortnight && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onBackToFortnight}>
          ↑ Back to Fortnight view
        </Button>
      )}

      {/* Display Mode Dropdown (not in Day/Month view) */}
      {viewMode !== "day" && viewMode !== "month" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              {displayMode === "staff" ? (
                <Users className="h-4 w-4 mr-2" />
              ) : (
                <Layers className="h-4 w-4 mr-2" />
              )}
              {DISPLAY_MODE_LABELS[displayMode]}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {(Object.keys(DISPLAY_MODE_LABELS) as RosterDisplayMode[]).map((mode) => (
              <DropdownMenuItem
                key={mode}
                onClick={() => onDisplayModeChange(mode)}
                className={displayMode === mode ? "bg-accent" : ""}
              >
                {DISPLAY_MODE_LABELS[mode]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Grouping Dropdown */}
      {viewMode !== "day" && viewMode !== "month" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <LayoutGrid className="h-4 w-4 mr-2" />
              {GROUP_BY_LABELS[groupBy]}
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {(Object.keys(GROUP_BY_LABELS) as RosterGroupBy[]).map((g) => (
              <DropdownMenuItem
                key={g}
                onClick={() => onGroupByChange(g)}
                className={groupBy === g ? "bg-accent" : ""}
              >
                {GROUP_BY_LABELS[g]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              Rostering
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onCopyPreviousWeek}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Previous Week
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSaveTemplate}>
              <Save className="h-4 w-4 mr-2" />
              Save as Template
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onPrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print Roster
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onManageAvailability}>
              <CalendarClock className="h-4 w-4 mr-2" />
              Manage Availability
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Print roster" onClick={onPrint}>
          <Printer className="h-4 w-4" />
        </Button>

        <Button variant="outline" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>

        <Button
          className="h-8"
          onClick={onPublish}
          disabled={publishDisabled}
        >
          <Send className="h-4 w-4 mr-2" />
          Review & Publish
        </Button>
      </div>
    </div>
  )
}
