import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useOrdersQuery } from './useOrdersQuery'
import { useMemo } from 'react'
import type { LabourMetrics } from '@/types'

interface LabourFilters {
  venueId?: string
  startDate?: string // ISO string
  endDate?: string   // ISO string
}

interface LabourMetricsResult {
  metrics: LabourMetrics | null
  isLoading: boolean
}

export function useLabourMetrics(filters?: LabourFilters): LabourMetricsResult {
  const { venueId, startDate, endDate } = filters || {}

  // Fetch approved timesheets for the period
  const { data: timesheets, isLoading: tsLoading } = useQuery({
    queryKey: ['labourTimesheets', venueId, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('timesheets')
        .select('id, staff_id, venue_id, clock_in, total_hours, total_pay, status')
        .eq('status', 'approved')
      if (venueId) query = query.eq('venue_id', venueId)
      if (startDate) query = query.gte('clock_in', startDate)
      if (endDate) query = query.lte('clock_in', endDate)
      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    enabled: !!venueId,
  })

  // Fetch orders for labour % calculation (shared cache)
  const { data: orders, isLoading: ordersLoading } = useOrdersQuery(venueId, startDate, endDate)

  const isLoading = tsLoading || ordersLoading

  return useMemo(() => {
    if (isLoading || !timesheets || timesheets.length === 0) {
      return { metrics: null, isLoading }
    }

    const totalHours = timesheets.reduce((sum, t) => sum + (t.total_hours || 0), 0)
    const totalCost = timesheets.reduce((sum, t) => sum + (t.total_pay || 0), 0)
    const avgHourlyRate = totalHours > 0 ? totalCost / totalHours / 100 : 0
    const staffCount = new Set(timesheets.map(t => t.staff_id)).size

    // Labour % against sales
    let labourPercent = 0
    let costVsSales = 0

    if (orders && orders.length > 0) {
      const netSales = orders
        .filter(o => !o.is_void)
        .reduce((sum, o) => sum + (o.is_refund ? -o.net_amount : o.net_amount), 0)
      if (netSales > 0) {
        labourPercent = (totalCost / netSales) * 100
        costVsSales = totalCost / netSales
      }
    }

    return {
      metrics: {
        total_hours: totalHours,
        total_cost: totalCost,
        labour_percent: labourPercent,
        avg_hourly_rate: avgHourlyRate,
        staff_count: staffCount,
        cost_vs_sales: costVsSales,
      },
      isLoading: false,
    }
  }, [timesheets, orders, isLoading])
}
