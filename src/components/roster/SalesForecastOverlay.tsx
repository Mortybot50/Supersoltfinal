/**
 * SalesForecastOverlay — faint sales forecast line drawn behind the roster grid.
 * Uses order data from the dataStore (read-only). Shows as a tiny chart under
 * each day column header indicating expected busy periods.
 * Commit 6: connects to sales data, shows prep load indicator.
 */

import { useMemo } from 'react'
import { useDataStore } from '@/lib/store/dataStore'
import { format, isSameDay, subWeeks } from 'date-fns'
import { cn } from '@/lib/utils'

interface SalesForecastOverlayProps {
  dates: Date[]
  className?: string
}

// Simple SVG sparkline for a single day's hourly forecast
function DaySparkline({ normalised }: { normalised: number }) {
  if (normalised <= 0) return null
  const height = Math.round(normalised * 16) // max 16px tall
  return (
    <div
      className="w-full bg-gradient-to-t from-teal-200/60 to-transparent rounded-sm transition-all"
      style={{ height: `${height}px` }}
    />
  )
}

export function SalesForecastOverlay({ dates, className }: SalesForecastOverlayProps) {
  const { orders } = useDataStore()

  // Compare to same days last week — use last week's actuals as the "forecast"
  const forecast = useMemo(() => {
    return dates.map(date => {
      const lastWeekDate = subWeeks(date, 1)
      const dayOrders = orders.filter(o => {
        const od = o.order_datetime instanceof Date ? o.order_datetime : new Date(o.order_datetime)
        return isSameDay(od, lastWeekDate)
      })
      const totalRevenue = dayOrders.reduce((s, o) => s + (o.gross_amount || 0), 0)
      return { date, revenue: totalRevenue, orderCount: dayOrders.length }
    })
  }, [orders, dates])

  // Normalise revenues for display
  const maxRevenue = Math.max(...forecast.map(f => f.revenue), 1)

  if (forecast.every(f => f.revenue === 0)) return null

  return (
    <div className={cn('flex gap-0 pointer-events-none select-none', className)}>
      {forecast.map((f, i) => (
        <div
          key={i}
          className="flex-1 flex flex-col items-center justify-end"
          title={`Est. ${format(f.date, 'EEE')}: $${(f.revenue / 100).toFixed(0)} (${f.orderCount} orders last week)`}
        >
          <DaySparkline normalised={f.revenue / maxRevenue} />
        </div>
      ))}
    </div>
  )
}

/**
 * Prep load badge — shows estimated prep intensity for a day.
 * Based on forecasted revenue vs average revenue.
 */
export function PrepLoadBadge({ date, dates, className }: { date: Date; dates: Date[]; className?: string }) {
  const { orders } = useDataStore()

  const load = useMemo(() => {
    const lastWeekDate = subWeeks(date, 1)
    const dayRevenue = orders
      .filter(o => isSameDay(o.order_datetime instanceof Date ? o.order_datetime : new Date(o.order_datetime), lastWeekDate))
      .reduce((s, o) => s + (o.gross_amount || 0), 0)

    if (dayRevenue === 0) return null

    // Compare to the week average
    const weekRevenues = dates.map(d => {
      const lw = subWeeks(d, 1)
      return orders
        .filter(o => isSameDay(o.order_datetime instanceof Date ? o.order_datetime : new Date(o.order_datetime), lw))
        .reduce((s, o) => s + (o.gross_amount || 0), 0)
    })
    const avg = weekRevenues.reduce((s, r) => s + r, 0) / (weekRevenues.length || 1)
    if (avg === 0) return null

    const ratio = dayRevenue / avg
    if (ratio > 1.4) return { label: 'Busy', color: 'bg-red-100 text-red-700' }
    if (ratio > 1.1) return { label: 'Moderate', color: 'bg-amber-100 text-amber-700' }
    if (ratio < 0.7) return { label: 'Quiet', color: 'bg-green-100 text-green-700' }
    return null
  }, [orders, date, dates])

  if (!load) return null

  return (
    <span className={cn('text-[9px] px-1 rounded font-medium', load.color, className)}>
      {load.label}
    </span>
  )
}
