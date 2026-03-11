/**
 * useDemandForecast — queries the orders table for historical POS demand.
 *
 * Fetches orders for the same day-of-week over the last 4 weeks,
 * groups them into 30-minute slots, averages the order count per slot,
 * then converts to a staff headcount using a configurable covers-per-staff ratio.
 *
 * Cache key: ['demand', venueId, dayOfWeek]
 * Stale time: 1 hour (demand data is historical, not real-time).
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { getDay, subWeeks, format, startOfDay, endOfDay } from 'date-fns'

export const COVERS_PER_STAFF = 15 // configurable default: 15 covers per staff member

export interface DemandSlot {
  hour: number
  minute: number
  /** "9am", "9:30am" etc. — matches HourlyStaffing.label */
  label: string
  /** How many staff the POS demand data suggests you need */
  demandStaff: number
}

function makeLabel(hour: number, minute: number): string {
  const ampm = hour >= 12 ? 'pm' : 'am'
  const h12 = hour % 12 || 12
  return minute === 0 ? `${h12}${ampm}` : `${h12}:30${ampm}`
}

/** Build the empty 30-min slot map for 6am–11pm */
function emptySlots(): Map<string, number[]> {
  const slots = new Map<string, number[]>()
  for (let h = 6; h <= 22; h++) {
    slots.set(`${h}:0`, [])
    slots.set(`${h}:30`, [])
  }
  slots.set('23:0', [])
  return slots
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

async function fetchDemandSlots(
  venueId: string,
  date: Date,
  coversPerStaff: number
): Promise<DemandSlot[]> {
  // Build 4 same-weekday date pairs (last 4 occurrences)
  const targetDow = getDay(date)
  const datePairs = Array.from({ length: 4 }, (_, i) => {
    const d = subWeeks(date, i + 1)
    return {
      from: startOfDay(d).toISOString(),
      to: endOfDay(d).toISOString(),
    }
  }).filter(({ from }) => getDay(new Date(from)) === targetDow)

  if (datePairs.length === 0) return []

  // Query orders for all 4 dates in a single request (gte oldest from, lte newest to)
  const oldest = datePairs[datePairs.length - 1].from
  const newest = datePairs[0].to

  const { data, error } = await supabase
    .from('orders')
    .select('order_datetime')
    .eq('venue_id', venueId)
    .eq('is_void', false)
    .gte('order_datetime', oldest)
    .lte('order_datetime', newest)

  if (error || !data) {
    // Graceful fallback — return empty (caller will show mock curve)
    return []
  }

  // Group orders by (weekday-date, 30-min slot)
  // We want: per slot, count of orders across each matching date
  const targetDates = new Set(datePairs.map(p => format(new Date(p.from), 'yyyy-MM-dd')))

  // slotDateCounts[slotKey][dateStr] = order count
  const slotDateCounts: Map<string, Map<string, number>> = new Map()

  for (const row of data) {
    const d = new Date(row.order_datetime)
    const dateStr = format(d, 'yyyy-MM-dd')
    if (!targetDates.has(dateStr)) continue

    const h = d.getHours()
    const m = d.getMinutes() >= 30 ? 30 : 0
    if (h < 6 || h > 23) continue // outside operating hours
    const slotKey = `${h}:${m}`

    if (!slotDateCounts.has(slotKey)) slotDateCounts.set(slotKey, new Map())
    const dateMap = slotDateCounts.get(slotKey)!
    dateMap.set(dateStr, (dateMap.get(dateStr) ?? 0) + 1)
  }

  // Build result: for each slot, average order count across the 4 dates, convert to staff
  const slots: DemandSlot[] = []
  for (let h = 6; h <= 23; h++) {
    for (const m of [0, 30]) {
      if (h === 23 && m === 30) break
      const slotKey = `${h}:${m}`
      const dateMap = slotDateCounts.get(slotKey)

      let avgOrders = 0
      if (dateMap && dateMap.size > 0) {
        // Average across all target dates (include 0 for dates with no orders in slot)
        const counts = Array.from(targetDates).map(d => dateMap.get(d) ?? 0)
        avgOrders = average(counts)
      }

      slots.push({
        hour: h,
        minute: m,
        label: makeLabel(h, m),
        demandStaff: Math.max(0, Math.round((avgOrders / coversPerStaff) * 10) / 10),
      })
    }
  }

  return slots
}

interface UseDemandForecastOptions {
  coversPerStaff?: number
}

export function useDemandForecast(
  venueId: string | null,
  date: Date,
  options: UseDemandForecastOptions = {}
) {
  const { coversPerStaff = COVERS_PER_STAFF } = options
  const dayOfWeek = getDay(date)

  return useQuery({
    queryKey: ['demand', venueId, dayOfWeek],
    enabled: !!venueId,
    staleTime: 1000 * 60 * 60, // 1 hour
    queryFn: () => fetchDemandSlots(venueId!, date, coversPerStaff),
  })
}
