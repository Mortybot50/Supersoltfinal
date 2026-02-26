/**
 * RosterHeader — view toggles, date navigation, search/filter, publish button.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  Send,
  SidebarOpen,
  ChevronDown,
  Users,
  RefreshCw,
} from 'lucide-react'
import { useRosterStore } from '@/stores/useRosterStore'
import { format, addDays } from 'date-fns'
import { cn } from '@/lib/utils'

interface RosterHeaderProps {
  onPublish: () => void
}

const VIEW_LABELS = { week: 'Week', day: 'Day', fortnight: 'Fortnight' } as const

export function RosterHeader({ onPublish }: RosterHeaderProps) {
  const {
    view, setView,
    selectedDate,
    navigateWeek,
    searchQuery, setSearchQuery,
    roleFilter, setRoleFilter,
    shifts, isLoading,
    sidebarOpen, toggleSidebar,
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
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateWeek(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium tabular-nums min-w-[160px] text-center">
          {dateLabel}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateWeek(1)}>
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
