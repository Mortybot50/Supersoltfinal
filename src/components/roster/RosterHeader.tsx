/**
 * RosterHeader — view toggles, date navigation, search/filter, publish button.
 * Includes Spotlight, Grouping, View Mode toolbar dropdowns, and Quick Build.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Send,
  SidebarOpen,
  ChevronDown,
  Users,
  RefreshCw,
  Flashlight,
  Layers,
  LayoutGrid,
  Check,
  Wand2,
} from 'lucide-react'
import { useRosterStore } from '@/stores/useRosterStore'
import { format, addDays } from 'date-fns'
import { cn } from '@/lib/utils'

interface RosterHeaderProps {
  onPublish: () => void
}

const VIEW_LABELS = { week: 'Week', day: 'Day', fortnight: 'Fortnight' } as const

const SPOTLIGHT_OPTIONS = [
  { value: null, label: 'All Shifts' },
  { value: 'validation_errors', label: 'Validation Errors' },
  { value: 'overtime', label: 'Overtime Shifts' },
  { value: 'open_vacant', label: 'Open / Vacant' },
  { value: 'pending_acceptance', label: 'Pending Acceptance' },
  { value: 'draft_only', label: 'Draft Only' },
] as const

const GROUPING_OPTIONS = [
  { value: 'none', label: 'No Grouping' },
  { value: 'role', label: 'Group by Role' },
  { value: 'employment_type', label: 'Group by Employment Type' },
] as const

const VIEW_MODE_OPTIONS = [
  { value: 'staff', label: 'Staff View' },
  { value: 'compact', label: 'Compact View' },
  { value: 'stats', label: 'Stats View' },
] as const

export function RosterHeader({ onPublish }: RosterHeaderProps) {
  const {
    view, setView,
    selectedDate,
    navigateWeek,
    searchQuery, setSearchQuery,
    roleFilter, setRoleFilter,
    shifts, isLoading,
    sidebarOpen, toggleSidebar,
    spotlightFilter, setSpotlightFilter,
    groupBy, setGroupBy,
    viewMode, setViewMode,
    quickBuildOpen, toggleQuickBuild,
  } = useRosterStore()

  // Date range label
  const dateLabel = (() => {
    if (view === 'day') return format(selectedDate, 'EEE d MMM yyyy')
    if (view === 'fortnight') {
      return `${format(selectedDate, 'd MMM')} – ${format(addDays(selectedDate, 13), 'd MMM yyyy')}`
    }
    return `${format(selectedDate, 'd MMM')} – ${format(addDays(selectedDate, 6), 'd MMM yyyy')}`
  })()

  const draftCount = shifts.filter(s => s.status === 'scheduled').length
  const roles = [...new Set(shifts.map(s => s.role).filter(Boolean))]

  const activeSpotlight = SPOTLIGHT_OPTIONS.find(o => o.value === spotlightFilter)
  const activeGrouping = GROUPING_OPTIONS.find(o => o.value === groupBy)
  const activeViewMode = VIEW_MODE_OPTIONS.find(o => o.value === viewMode)

  return (
    <div className="bg-white border-b px-3 py-2 flex items-center gap-2 flex-wrap shrink-0 print:hidden">
      {/* Sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={toggleSidebar}
        title={sidebarOpen ? 'Hide staff sidebar' : 'Show staff sidebar'}
      >
        <SidebarOpen className={cn('h-4 w-4 transition-transform', sidebarOpen && 'scale-x-[-1]')} />
      </Button>

      {/* Date navigation */}
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Previous week" onClick={() => navigateWeek(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium tabular-nums min-w-[160px] text-center">
          {dateLabel}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Next week" onClick={() => navigateWeek(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* View toggle */}
      <div className="flex rounded-md border overflow-hidden">
        {(['day', 'week', 'fortnight'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'px-3 py-1 text-xs font-medium transition-colors',
              view === v
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            )}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>

      {/* Role filter */}
      {roles.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1">
              <Users className="h-3.5 w-3.5" />
              {roleFilter ? <span className="capitalize">{roleFilter}</span> : 'All roles'}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setRoleFilter(null)}>
              All roles
            </DropdownMenuItem>
            {roles.map(r => (
              <DropdownMenuItem key={r} onClick={() => setRoleFilter(r)} className="capitalize">
                {r}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* ── Spotlight Dropdown ──────────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={spotlightFilter ? 'default' : 'outline'}
            size="sm"
            className="h-8 gap-1"
          >
            <Flashlight className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {activeSpotlight?.value ? activeSpotlight.label : 'Spotlight'}
            </span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52">
          {SPOTLIGHT_OPTIONS.map(opt => (
            <DropdownMenuItem
              key={String(opt.value)}
              onClick={() => setSpotlightFilter(opt.value)}
              className="gap-2"
            >
              <Check className={cn('h-3.5 w-3.5', spotlightFilter === opt.value ? 'opacity-100' : 'opacity-0')} />
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Grouping Dropdown ───────────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1">
            <Layers className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{activeGrouping?.label ?? 'Grouping'}</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52">
          {GROUPING_OPTIONS.map(opt => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => setGroupBy(opt.value)}
              className="gap-2"
            >
              <Check className={cn('h-3.5 w-3.5', groupBy === opt.value ? 'opacity-100' : 'opacity-0')} />
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── View Mode Dropdown ──────────────────────────────────────────────── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1">
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{activeViewMode?.label ?? 'View'}</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-44">
          {VIEW_MODE_OPTIONS.map(opt => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => setViewMode(opt.value)}
              className="gap-2"
            >
              <Check className={cn('h-3.5 w-3.5', viewMode === opt.value ? 'opacity-100' : 'opacity-0')} />
              {opt.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <div className="px-2 py-1">
            <p className="text-[10px] text-gray-400 leading-snug">
              Stats view shows h/cost per cell instead of shift blocks.
            </p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Search */}
      <div className="relative flex-1 min-w-[140px] max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <Input
          placeholder="Search staff…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="h-8 pl-8 text-sm"
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Loading indicator */}
      {isLoading && (
        <RefreshCw className="h-4 w-4 animate-spin text-gray-400 shrink-0" />
      )}

      {/* Quick Build */}
      <Button
        variant={quickBuildOpen ? 'default' : 'outline'}
        size="sm"
        className="h-8 shrink-0 gap-1.5"
        onClick={toggleQuickBuild}
        title="Quick Build — bulk roster tools"
      >
        <Wand2 className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Quick Build</span>
      </Button>

      {/* Publish */}
      <Button
        onClick={onPublish}
        disabled={draftCount === 0}
        size="sm"
        className="h-8 shrink-0"
      >
        <Send className="h-3.5 w-3.5 mr-1.5" />
        Publish
        {draftCount > 0 && (
          <span className="ml-1.5 bg-white/20 rounded px-1 text-xs">{draftCount}</span>
        )}
      </Button>
    </div>
  )
}
