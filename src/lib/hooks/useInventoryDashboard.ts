import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useMemo } from 'react'

// ─── Types ───────────────────────────────────────────────────

export interface DashboardMetrics {
  totalStockValue: number
  itemsBelowPar: number
  pendingPOs: number
  wasteThisWeek: number
}

export interface AlertItem {
  id: string
  name: string
  type: 'below-par' | 'overdue-po' | 'high-variance' | 'no-recent-purchase'
  detail: string
  actionLabel?: string
  actionUrl?: string
}

export interface CategoryStockValue {
  category: string
  value: number
}

export interface ActivityEvent {
  id: string
  type: 'count' | 'waste' | 'po-received' | 'po-created'
  description: string
  timestamp: string
}

export interface FoodCostWeek {
  weekLabel: string
  foodCostPct: number | null
  target: number
}

// ─── Helpers ─────────────────────────────────────────────────

function getWeekBounds(): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay() // 0 = Sun
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  }
}

function getWeeksAgo(weeksBack: number): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() + mondayOffset)
  thisMonday.setHours(0, 0, 0, 0)

  const weekStart = new Date(thisMonday)
  weekStart.setDate(thisMonday.getDate() - weeksBack * 7)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  return {
    start: weekStart.toISOString().split('T')[0],
    end: weekEnd.toISOString().split('T')[0],
  }
}

function formatWeekLabel(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

// ─── Hook: Dashboard Metrics (4 cards) ──────────────────────

export function useDashboardMetrics(venueId?: string) {
  const week = getWeekBounds()

  const { data: ingredients, isLoading: ingLoading } = useQuery({
    queryKey: ['inv-dash-ingredients', venueId],
    queryFn: async () => {
      let q = supabase
        .from('ingredients')
        .select('id, name, current_stock, par_level, cost_per_unit, category, supplier_id, active')
        .eq('active', true)
      if (venueId) q = q.eq('venue_id', venueId)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    enabled: !!venueId,
    staleTime: 30_000,
  })

  const { data: pendingPOs, isLoading: poLoading } = useQuery({
    queryKey: ['inv-dash-pending-pos', venueId],
    queryFn: async () => {
      let q = supabase
        .from('purchase_orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['draft', 'submitted'])
      if (venueId) q = q.eq('venue_id', venueId)
      const { count, error } = await q
      if (error) throw error
      return count ?? 0
    },
    enabled: !!venueId,
    staleTime: 30_000,
  })

  const { data: wasteValue, isLoading: wasteLoading } = useQuery({
    queryKey: ['inv-dash-waste-week', venueId, week.start, week.end],
    queryFn: async () => {
      let q = supabase
        .from('waste_logs')
        .select('value')
        .gte('waste_date', week.start)
        .lte('waste_date', week.end)
      if (venueId) q = q.eq('venue_id', venueId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).reduce((sum, w) => sum + (w.value ?? 0), 0)
    },
    enabled: !!venueId,
    staleTime: 30_000,
  })

  const metrics = useMemo<DashboardMetrics | null>(() => {
    if (!ingredients) return null
    return {
      totalStockValue: ingredients.reduce(
        (sum, i) => sum + i.current_stock * i.cost_per_unit,
        0
      ),
      itemsBelowPar: ingredients.filter((i) => i.current_stock < i.par_level).length,
      pendingPOs: pendingPOs ?? 0,
      wasteThisWeek: wasteValue ?? 0,
    }
  }, [ingredients, pendingPOs, wasteValue])

  return { metrics, isLoading: ingLoading || poLoading || wasteLoading }
}

// ─── Hook: Alerts ────────────────────────────────────────────

export function useInventoryAlerts(venueId?: string) {
  const thirtyDaysAgo = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  }, [])

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  // Below-par ingredients
  const { data: belowPar, isLoading: bpLoading } = useQuery({
    queryKey: ['inv-dash-below-par', venueId],
    queryFn: async () => {
      let q = supabase
        .from('ingredients')
        .select('id, name, current_stock, par_level, unit')
        .eq('active', true)
      if (venueId) q = q.eq('venue_id', venueId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).filter((i) => i.current_stock < i.par_level)
    },
    enabled: !!venueId,
    staleTime: 60_000,
  })

  // Overdue POs
  const { data: overduePOs, isLoading: opLoading } = useQuery({
    queryKey: ['inv-dash-overdue-pos', venueId, today],
    queryFn: async () => {
      let q = supabase
        .from('purchase_orders')
        .select('id, po_number, supplier_name, expected_delivery_date')
        .in('status', ['submitted', 'confirmed'])
        .lt('expected_delivery_date', today)
      if (venueId) q = q.eq('venue_id', venueId)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    enabled: !!venueId,
    staleTime: 60_000,
  })

  // High-variance items from last completed count
  const { data: highVariance, isLoading: hvLoading } = useQuery({
    queryKey: ['inv-dash-high-variance', venueId],
    queryFn: async () => {
      // Get latest completed count
      let q = supabase
        .from('stock_counts')
        .select('id')
        .eq('status', 'completed')
        .order('count_date', { ascending: false })
        .limit(1)
      if (venueId) q = q.eq('venue_id', venueId)
      const { data: counts, error: cErr } = await q
      if (cErr) throw cErr
      if (!counts || counts.length === 0) return []

      const { data: items, error: iErr } = await supabase
        .from('stock_count_items')
        .select('id, ingredient_name, expected_quantity, actual_quantity, variance')
        .eq('stock_count_id', counts[0].id)
      if (iErr) throw iErr

      return (items ?? []).filter((i) => {
        if (i.expected_quantity === 0) return Math.abs(i.actual_quantity) > 0
        return Math.abs(i.variance / i.expected_quantity) > 0.15
      })
    },
    enabled: !!venueId,
    staleTime: 120_000,
  })

  // Ingredients with no recent purchase (30 days)
  const { data: noPurchase, isLoading: npLoading } = useQuery({
    queryKey: ['inv-dash-no-purchase', venueId, thirtyDaysAgo],
    queryFn: async () => {
      // Get all active ingredients
      let q = supabase
        .from('ingredients')
        .select('id, name')
        .eq('active', true)
      if (venueId) q = q.eq('venue_id', venueId)
      const { data: allIngs, error: aErr } = await q
      if (aErr) throw aErr
      if (!allIngs || allIngs.length === 0) return []

      // Get ingredients that DO have recent PO items
      const poQ = supabase
        .from('purchase_order_items')
        .select('ingredient_id, purchase_order_id')
      const { data: poItems, error: pErr } = await poQ
      if (pErr) throw pErr

      // Get recent POs
      let recentQ = supabase
        .from('purchase_orders')
        .select('id')
        .gte('order_date', thirtyDaysAgo)
      if (venueId) recentQ = recentQ.eq('venue_id', venueId)
      const { data: recentPOs, error: rErr } = await recentQ
      if (rErr) throw rErr

      const recentPoIds = new Set((recentPOs ?? []).map((p) => p.id))
      const recentIngIds = new Set(
        (poItems ?? [])
          .filter((pi) => recentPoIds.has(pi.purchase_order_id))
          .map((pi) => pi.ingredient_id)
          .filter(Boolean)
      )

      return allIngs.filter((i) => !recentIngIds.has(i.id))
    },
    enabled: !!venueId,
    staleTime: 120_000,
  })

  const alerts = useMemo<AlertItem[]>(() => {
    const result: AlertItem[] = []

    ;(belowPar ?? []).forEach((i) => {
      result.push({
        id: `bp-${i.id}`,
        name: i.name,
        type: 'below-par',
        detail: `${i.current_stock} ${i.unit} (par: ${i.par_level})`,
        actionLabel: 'Order',
        actionUrl: `/inventory/order-guide?ingredient=${i.id}`,
      })
    })

    ;(overduePOs ?? []).forEach((po) => {
      result.push({
        id: `op-${po.id}`,
        name: `PO ${po.po_number}`,
        type: 'overdue-po',
        detail: `${po.supplier_name} — expected ${po.expected_delivery_date}`,
        actionLabel: 'View',
        actionUrl: `/inventory/purchase-orders/${po.id}`,
      })
    })

    ;(highVariance ?? []).forEach((i) => {
      const pct =
        i.expected_quantity > 0
          ? Math.round(Math.abs(i.variance / i.expected_quantity) * 100)
          : 100
      result.push({
        id: `hv-${i.id}`,
        name: i.ingredient_name,
        type: 'high-variance',
        detail: `${pct}% variance on last count`,
      })
    })

    ;(noPurchase ?? []).forEach((i) => {
      result.push({
        id: `np-${i.id}`,
        name: i.name,
        type: 'no-recent-purchase',
        detail: 'No purchase orders in last 30 days',
      })
    })

    return result
  }, [belowPar, overduePOs, highVariance, noPurchase])

  return { alerts, isLoading: bpLoading || opLoading || hvLoading || npLoading }
}

// ─── Hook: Stock Value by Category ───────────────────────────

export function useCategoryStockValue(venueId?: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['inv-dash-category-stock', venueId],
    queryFn: async () => {
      let q = supabase
        .from('ingredients')
        .select('category, current_stock, cost_per_unit')
        .eq('active', true)
      if (venueId) q = q.eq('venue_id', venueId)
      const { data: ings, error } = await q
      if (error) throw error

      const byCategory: Record<string, number> = {}
      for (const i of ings ?? []) {
        const cat = i.category || 'Uncategorized'
        byCategory[cat] = (byCategory[cat] ?? 0) + i.current_stock * i.cost_per_unit
      }

      return Object.entries(byCategory)
        .map(([category, value]) => ({ category, value: Math.round(value * 100) / 100 }))
        .sort((a, b) => b.value - a.value)
    },
    enabled: !!venueId,
    staleTime: 60_000,
  })

  return { categories: data ?? [], isLoading }
}

// ─── Hook: Recent Activity Feed ──────────────────────────────

export function useRecentActivity(venueId?: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['inv-dash-activity', venueId],
    queryFn: async () => {
      const events: ActivityEvent[] = []

      // Completed stock counts
      let scQ = supabase
        .from('stock_counts')
        .select('id, count_number, count_date, counted_by_name, created_at')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5)
      if (venueId) scQ = scQ.eq('venue_id', venueId)
      const { data: counts } = await scQ
      for (const c of counts ?? []) {
        events.push({
          id: `sc-${c.id}`,
          type: 'count',
          description: `Stock count ${c.count_number} completed${c.counted_by_name ? ` by ${c.counted_by_name}` : ''}`,
          timestamp: c.created_at,
        })
      }

      // Waste logged
      let wQ = supabase
        .from('waste_logs')
        .select('id, ingredient_name, quantity, unit, value, created_at')
        .order('created_at', { ascending: false })
        .limit(5)
      if (venueId) wQ = wQ.eq('venue_id', venueId)
      const { data: wastes } = await wQ
      for (const w of wastes ?? []) {
        events.push({
          id: `w-${w.id}`,
          type: 'waste',
          description: `Waste: ${w.quantity} ${w.unit} ${w.ingredient_name} ($${w.value.toFixed(2)})`,
          timestamp: w.created_at,
        })
      }

      // POs received / created
      let poQ = supabase
        .from('purchase_orders')
        .select('id, po_number, supplier_name, status, created_at, delivered_at')
        .order('created_at', { ascending: false })
        .limit(10)
      if (venueId) poQ = poQ.eq('venue_id', venueId)
      const { data: pos } = await poQ
      for (const po of pos ?? []) {
        if (po.status === 'received' || po.status === 'delivered') {
          events.push({
            id: `por-${po.id}`,
            type: 'po-received',
            description: `PO ${po.po_number} received from ${po.supplier_name}`,
            timestamp: po.delivered_at ?? po.created_at,
          })
        } else {
          events.push({
            id: `poc-${po.id}`,
            type: 'po-created',
            description: `PO ${po.po_number} created for ${po.supplier_name}`,
            timestamp: po.created_at,
          })
        }
      }

      // Sort by timestamp desc, take top 15
      return events
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 15)
    },
    enabled: !!venueId,
    staleTime: 30_000,
  })

  return { events: data ?? [], isLoading }
}

// ─── Hook: Food Cost % Trend (8 weeks) ──────────────────────

export function useFoodCostTrend(venueId?: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['inv-dash-food-cost-trend', venueId],
    queryFn: async () => {
      const weeks: FoodCostWeek[] = []

      // Get 8 weeks of data (current + 7 prior)
      for (let w = 7; w >= 0; w--) {
        const { start, end } = getWeeksAgo(w)

        // Ingredient cost: sum of PO items delivered that week
        let poQ = supabase
          .from('purchase_orders')
          .select('id')
          .in('status', ['received', 'delivered'])
          .gte('delivered_at', start)
          .lte('delivered_at', end + 'T23:59:59')
        if (venueId) poQ = poQ.eq('venue_id', venueId)
        const { data: weekPOs } = await poQ

        let ingredientCost = 0
        if (weekPOs && weekPOs.length > 0) {
          const poIds = weekPOs.map((p) => p.id)
          const { data: items } = await supabase
            .from('purchase_order_items')
            .select('line_total')
            .in('purchase_order_id', poIds)
          ingredientCost = (items ?? []).reduce((s, i) => s + (i.line_total ?? 0), 0)
        }

        // Sales revenue from orders table
        let ordQ = supabase
          .from('orders')
          .select('net_amount')
          .eq('is_void', false)
          .eq('is_refund', false)
          .gte('order_datetime', start)
          .lte('order_datetime', end + 'T23:59:59')
        if (venueId) ordQ = ordQ.eq('venue_id', venueId)
        const { data: weekOrders } = await ordQ

        const revenue = (weekOrders ?? []).reduce((s, o) => s + (o.net_amount ?? 0), 0)

        weeks.push({
          weekLabel: formatWeekLabel(start),
          foodCostPct: revenue > 0 ? Math.round((ingredientCost / revenue) * 1000) / 10 : null,
          target: 30,
        })
      }

      return weeks
    },
    enabled: !!venueId,
    staleTime: 300_000, // 5 min — expensive query
  })

  const hasData = useMemo(
    () => (data ?? []).some((w) => w.foodCostPct !== null),
    [data]
  )

  return { weeks: data ?? [], hasData, isLoading }
}
