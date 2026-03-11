/**
 * Reorder Engine — Smart Order Recommendations
 *
 * Reorder Point Formula:
 *   ROP = (avg_daily_demand × lead_time_days) + safety_stock
 *   safety_stock = Z × σ_demand × √lead_time_days
 *   Z = 1.28 for 90% service level
 *
 * Recommended Order Quantity:
 *   deficit = ROP + (avg_daily_demand × review_period) - current_stock
 *   order_qty = max(0, ceil(deficit / pack_size)) × pack_size
 *
 * AU Hospitality Notes:
 * - Stock valuation: weighted average cost (not FIFO) — simpler, adequate for cafe/restaurant
 * - Stock variance threshold: AU industry standard ≈ 2-3% of COGS before investigation
 */

import { supabase } from '@/integrations/supabase/client'
import type { OrderRecommendation } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

async function getAuthToken(): Promise<string | undefined> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token
}

// ---------------------------------------------------------------------------
// API call: get smart order recommendations
// ---------------------------------------------------------------------------

export async function getOrderRecommendations(
  orgId: string,
  venueId: string
): Promise<OrderRecommendation[]> {
  const token = await getAuthToken()
  const url =
    `${getBaseUrl()}/api/inventory?action=get-recommendations` +
    `&org_id=${encodeURIComponent(orgId)}` +
    `&venue_id=${encodeURIComponent(venueId)}`

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`getOrderRecommendations failed (${res.status}): ${body}`)
  }

  return res.json() as Promise<OrderRecommendation[]>
}

// ---------------------------------------------------------------------------
// Calculate reorder point
//
//   ROP = (avg_daily_demand × lead_time_days) + safety_stock
//   safety_stock = Z × σ_demand × √lead_time_days
//   Z values: 0.84 = 80%, 1.28 = 90%, 1.645 = 95%, 1.96 = 97.5%
// ---------------------------------------------------------------------------

export function calculateReorderPoint(params: {
  avgDailyDemand: number
  leadTimeDays: number
  demandStdDev: number
  serviceLevel?: number // 0.9 default
}): number {
  const { avgDailyDemand, leadTimeDays, demandStdDev, serviceLevel = 0.9 } = params

  const Z = serviceLevelToZ(serviceLevel)
  const safetyStock = Z * demandStdDev * Math.sqrt(leadTimeDays)
  const rop = avgDailyDemand * leadTimeDays + safetyStock

  return Math.ceil(rop)
}

/** Map common service levels to Z-scores (standard normal). */
function serviceLevelToZ(sl: number): number {
  if (sl >= 0.975) return 1.96
  if (sl >= 0.95) return 1.645
  if (sl >= 0.9) return 1.28
  if (sl >= 0.85) return 1.04
  if (sl >= 0.80) return 0.84
  return 0.67 // ~75%
}

// ---------------------------------------------------------------------------
// Calculate Economic Order Quantity (Wilson / EOQ formula)
//
//   EOQ = √(2 × annualDemand × orderingCost / holdingCostPerUnit)
// ---------------------------------------------------------------------------

export function calculateEOQ(params: {
  annualDemand: number
  orderingCost: number       // cost to place a single order
  holdingCostPerUnit: number // carrying cost per unit per year
}): number {
  const { annualDemand, orderingCost, holdingCostPerUnit } = params

  if (holdingCostPerUnit <= 0) return 0
  return Math.ceil(Math.sqrt((2 * annualDemand * orderingCost) / holdingCostPerUnit))
}

// ---------------------------------------------------------------------------
// Calculate days of stock remaining
// Returns null when avgDailyUsage is 0 (stock never depletes — infinite)
// ---------------------------------------------------------------------------

export function calculateDaysRemaining(
  currentStock: number,
  avgDailyUsage: number
): number | null {
  if (avgDailyUsage <= 0) return null
  if (currentStock <= 0) return 0
  return Math.floor(currentStock / avgDailyUsage)
}

// ---------------------------------------------------------------------------
// Determine stock status
//
//   'out'      → currentStock <= 0
//   'critical' → 0 < currentStock <= reorderPoint
//   'low'      → reorderPoint < currentStock <= parLevel
//   'healthy'  → currentStock > parLevel
// ---------------------------------------------------------------------------

export function getStockStatus(
  currentStock: number,
  parLevel: number,
  reorderPoint: number
): 'healthy' | 'low' | 'critical' | 'out' {
  if (currentStock <= 0) return 'out'
  if (currentStock <= reorderPoint) return 'critical'
  if (currentStock <= parLevel) return 'low'
  return 'healthy'
}

// ---------------------------------------------------------------------------
// Calculate weighted average cost (WAC) of an ingredient from purchase receipts
//
//   WAC = Σ(quantity × unit_cost) / Σ(quantity)
//
// Only 'purchase_receipt' movements with positive quantity and unit_cost are used.
// Returns null when no purchase receipt data is available.
// ---------------------------------------------------------------------------

export async function getWeightedAverageCost(
  ingredientId: string,
  venueId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('quantity, unit_cost')
    .eq('ingredient_id', ingredientId)
    .eq('venue_id', venueId)
    .eq('movement_type', 'purchase_receipt')
    .gt('quantity', 0)
    .not('unit_cost', 'is', null)

  if (error) throw new Error(`Failed to fetch stock movements for WAC: ${error.message}`)

  const rows = (data ?? []) as Array<{ quantity: number; unit_cost: number }>

  if (rows.length === 0) return null

  const totalQty = rows.reduce((s, r) => s + r.quantity, 0)
  if (totalQty === 0) return null

  const totalValue = rows.reduce((s, r) => s + r.quantity * r.unit_cost, 0)
  return Math.round((totalValue / totalQty) * 10000) / 10000 // 4 decimal precision
}
