import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useMemo } from 'react'
import type { COGSMetrics } from '@/types/cogs.types'

interface COGSFilters {
  venueId?: string
  startDate?: string // ISO string
  endDate?: string   // ISO string
}

interface COGSMetricsResult {
  metrics: COGSMetrics | null
  isLoading: boolean
}

export function useCOGSMetrics(filters?: COGSFilters): COGSMetricsResult {
  const { venueId, startDate, endDate } = filters || {}

  // Fetch orders for sales total
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['cogsOrders', venueId, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('id, net_amount, is_void, is_refund')
      if (venueId) query = query.eq('venue_id', venueId)
      if (startDate) query = query.gte('order_datetime', startDate)
      if (endDate) query = query.lte('order_datetime', endDate)
      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    enabled: !!venueId,
  })

  // Fetch delivered purchase orders for purchases value
  const { data: purchaseOrders, isLoading: posLoading } = useQuery({
    queryKey: ['cogsPOs', venueId, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('purchase_orders')
        .select('id, total_amount, status, order_date')
        .eq('status', 'delivered')
      if (venueId) query = query.eq('venue_id', venueId)
      if (startDate) query = query.gte('order_date', startDate)
      if (endDate) query = query.lte('order_date', endDate)
      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    enabled: !!venueId,
  })

  // Fetch waste logs for the period
  const { data: wasteLogs, isLoading: wasteLoading } = useQuery({
    queryKey: ['cogsWaste', venueId, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('waste_logs')
        .select('id, value, waste_date')
      if (venueId) query = query.eq('venue_id', venueId)
      if (startDate) query = query.gte('waste_date', startDate)
      if (endDate) query = query.lte('waste_date', endDate)
      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    enabled: !!venueId,
  })

  // Fetch current ingredient stock value (approximate opening/closing)
  const { data: ingredients, isLoading: ingLoading } = useQuery({
    queryKey: ['cogsIngredients', venueId],
    queryFn: async () => {
      let query = supabase
        .from('ingredients')
        .select('id, current_stock, cost_per_unit, active')
        .eq('active', true)
      if (venueId) query = query.eq('venue_id', venueId)
      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    enabled: !!venueId,
  })

  const isLoading = ordersLoading || posLoading || wasteLoading || ingLoading

  return useMemo(() => {
    if (isLoading || !orders || orders.length === 0) {
      return { metrics: null, isLoading }
    }

    // Total sales (cents)
    const totalSales = orders
      .filter(o => !o.is_void)
      .reduce((sum, o) => sum + (o.is_refund ? 0 : o.net_amount), 0)

    // Opening/closing stock (use current stock as approximation for both)
    const stockValue = (ingredients || []).reduce(
      (sum, ing) => sum + ing.current_stock * ing.cost_per_unit,
      0
    )

    // Total purchases (cents) — delivered POs only
    const purchasesValue = (purchaseOrders || []).reduce(
      (sum, po) => sum + po.total_amount,
      0
    )

    // Total waste (cents)
    const wasteValue = (wasteLogs || []).reduce((sum, w) => sum + w.value, 0)

    // Actual COGS = opening + purchases - closing - waste
    // With opening ≈ closing, this simplifies to purchases - waste
    const actualCOGS = stockValue + purchasesValue - stockValue - wasteValue
    const theoreticalCOGS = actualCOGS // Without recipe-level data, approximate

    const targetPercent = 28

    const actualPercent = totalSales > 0 ? (actualCOGS / totalSales) * 100 : 0
    const theoreticalPercent = totalSales > 0 ? (theoreticalCOGS / totalSales) * 100 : 0
    const variance = actualCOGS - theoreticalCOGS
    const variancePercent = theoreticalCOGS !== 0 ? (variance / theoreticalCOGS) * 100 : 0

    return {
      metrics: {
        theoretical_cogs: theoreticalCOGS,
        actual_cogs: actualCOGS,
        variance,
        variance_percent: variancePercent,
        theoretical_cogs_percent: theoreticalPercent,
        actual_cogs_percent: actualPercent,
        target_cogs_percent: targetPercent,
        total_waste_value: wasteValue,
        waste_percent_of_cogs: actualCOGS !== 0 ? (wasteValue / actualCOGS) * 100 : 0,
        vs_previous_period: { cogs_change: 0, cogs_percent_change: 0 },
        vs_target: {
          variance: actualPercent - targetPercent,
          on_track: actualPercent <= targetPercent + 2,
        },
      },
      isLoading: false,
    }
  }, [orders, purchaseOrders, wasteLogs, ingredients, isLoading])
}
