/**
 * StaffSidebar — left panel showing available staff as draggable cards.
 * Drag a StaffCard onto a RosterCell to create a shift for that day.
 */

import { useMemo } from 'react'
import { useRosterStore } from '@/stores/useRosterStore'
import { StaffCard } from './StaffCard'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isSameDay } from 'date-fns'
import { getWeekDates, getFortnightDates } from '@/lib/utils/rosterCalculations'

interface StaffSidebarProps {
  className?: string
}

export function StaffSidebar({ className }: StaffSidebarProps) {
  const {
    staff,
    shifts,
    view,
    selectedDate,
    searchQuery, setSearchQuery,
    roleFilter,
    sidebarOpen,
    setSidebarOpen,
  } = useRosterStore()

  const activeStaff = useMemo(() => {
    let s = staff.filter(m => m.status === 'active')
    if (roleFilter) s = s.filter(m => m.role.toLowerCase() === roleFilter.toLowerCase())
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      s = s.filter(m => m.name.toLowerCase().includes(q))
    }
    return s
  }, [staff, roleFilter, searchQuery])

  const dates = useMemo(() => {
    if (view === 'fortnight') return getFortnightDates(selectedDate)
    if (view === 'day') return [selectedDate]
    return getWeekDates(selectedDate)
  }, [view, selectedDate])

  // Stats per staff member for the visible date range
  const staffStats = useMemo(() => {
    const map: Record<string, { hours: number; count: number }> = {}
    shifts
      .filter(s => s.status !== 'cancelled' && !s.is_open_shift)
      .forEach(s => {
        const d = s.date instanceof Date ? s.date : new Date(s.date)
        const inRange = dates.some(date => isSameDay(d, date))
        if (!inRange) return
        if (!map[s.staff_id]) map[s.staff_id] = { hours: 0, count: 0 }
        map[s.staff_id].hours += s.total_hours
        map[s.staff_id].count += 1
      })
    return map
  }, [shifts, dates])

  if (!sidebarOpen) return null

  return (
    <aside
      className={cn(
        'w-56 shrink-0 bg-gray-50 border-r flex flex-col overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-white">
        <span className="text-xs font-semibold text-gray-700">Staff</span>
        <button
          onClick={() => setSidebarOpen(false)}
          className="h-5 w-5 rounded hover:bg-gray-100 flex items-center justify-center"
        >
          <X className="h-3.5 w-3.5 text-gray-400" />
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Filter staff…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Tip */}
      <div className="px-2 py-1.5 bg-blue-50 border-b">
        <p className="text-[10px] text-blue-600 leading-tight">
          Drag a staff card onto a day to create a shift
        </p>
      </div>

      {/* Staff list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {activeStaff.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No staff found</p>
        ) : (
          activeStaff.map(member => (
            <StaffCard
              key={member.id}
              staff={member}
              weeklyHours={staffStats[member.id]?.hours || 0}
              shiftCount={staffStats[member.id]?.count || 0}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t bg-white text-[10px] text-gray-400">
        {activeStaff.length} active staff
      </div>
    </aside>
  )
}
