/**
 * CostBarExpanded — detailed cost breakdown panel.
 * Shows breakdown by role, daypart, and individual.
 */

import { useMemo } from 'react'
import { useRosterStore, getRoleColors } from '@/stores/useRosterStore'
import { getDaypart, DAYPARTS } from './DayPartBands'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'

export function CostBarExpanded() {
  const { shifts, staff, costBarExpanded } = useRosterStore()

  const activeShifts = useMemo(() => shifts.filter(s => s.status !== 'cancelled'), [shifts])

  // By role
  const byRole = useMemo(() => {
    const map: Record<string, { hours: number; cost: number; count: number }> = {}
    activeShifts.forEach(s => {
      const r = s.role || 'crew'
      if (!map[r]) map[r] = { hours: 0, cost: 0, count: 0 }
      map[r].hours += s.total_hours
      map[r].cost += s.total_cost
      map[r].count += 1
    })
    return Object.entries(map).sort(([, a], [, b]) => b.cost - a.cost)
  }, [activeShifts])

  // By daypart
  const byDaypart = useMemo(() => {
    const map: Record<string, { hours: number; cost: number; count: number }> = {}
    DAYPARTS.forEach(dp => { map[dp.key] = { hours: 0, cost: 0, count: 0 } })
    activeShifts.forEach(s => {
      const dp = getDaypart(s.start_time)
      map[dp].hours += s.total_hours
      map[dp].cost += s.total_cost
      map[dp].count += 1
    })
    return DAYPARTS.map(dp => ({ ...dp, ...map[dp.key] }))
  }, [activeShifts])

  // By person (top 5)
  const byPerson = useMemo(() => {
    const map: Record<string, { name: string; hours: number; cost: number; count: number }> = {}
    activeShifts.forEach(s => {
      if (!map[s.staff_id]) map[s.staff_id] = { name: s.staff_name, hours: 0, cost: 0, count: 0 }
      map[s.staff_id].hours += s.total_hours
      map[s.staff_id].cost += s.total_cost
      map[s.staff_id].count += 1
    })
    return Object.entries(map)
      .sort(([, a], [, b]) => b.cost - a.cost)
      .slice(0, 6)
  }, [activeShifts])

  const totalCost = activeShifts.reduce((s, sh) => s + sh.total_cost, 0)

  if (!costBarExpanded) return null

  return (
    <div className="bg-white border-t border-gray-100 px-4 py-3 grid grid-cols-3 gap-4 max-h-48 overflow-y-auto print:hidden">

      {/* By Role */}
      <div>
        <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">By Role</h4>
        <div className="space-y-1">
          {byRole.map(([role, stats]) => {
            const colors = getRoleColors(role)
            const pct = totalCost > 0 ? (stats.cost / totalCost) * 100 : 0
            return (
              <div key={role} className="flex items-center gap-2">
                <div className={cn('h-2 w-2 rounded-full shrink-0', colors.dot)} />
                <span className="text-xs capitalize flex-1 truncate">{role}</span>
                <span className="text-xs tabular-nums font-medium">{formatCurrency(stats.cost)}</span>
                <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', colors.dot)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* By Daypart */}
      <div>
        <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">By Daypart</h4>
        <div className="space-y-1">
          {byDaypart.map(dp => {
            const pct = totalCost > 0 ? (dp.cost / totalCost) * 100 : 0
            return (
              <div key={dp.key} className="flex items-center gap-2">
                <div className={cn('h-2 w-2 rounded-full shrink-0', dp.color.replace('bg-', 'bg-').replace('-50', '-400'))} />
                <span className="text-xs flex-1">{dp.label}</span>
                <span className="text-xs tabular-nums font-medium">{formatCurrency(dp.cost)}</span>
                <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', dp.color.replace('-50', '-400'))} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top earners */}
      <div>
        <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Top Earners</h4>
        <div className="space-y-1">
          {byPerson.map(([id, p]) => {
            const member = staff.find(s => s.id === id)
            const colors = getRoleColors(member?.role || 'crew')
            return (
              <div key={id} className="flex items-center gap-2">
                <div className={cn('h-4 w-4 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold text-white', colors.dot)}>
                  {p.name.slice(0, 1).toUpperCase()}
                </div>
                <span className="text-xs flex-1 truncate">{p.name}</span>
                <span className="text-xs tabular-nums text-gray-500">{p.hours.toFixed(1)}h</span>
                <span className="text-xs tabular-nums font-medium">{formatCurrency(p.cost)}</span>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
