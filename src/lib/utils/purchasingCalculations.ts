/**
 * Purchasing Calculations — Smart order suggestions
 *
 * Calculates suggested order quantities based on par levels, current stock,
 * and pending quantities from other draft/submitted POs.
 */

import type { Ingredient, PurchaseOrder, PurchaseOrderItem, Supplier } from '@/types'

export interface OrderSuggestion {
  ingredientId: string
  ingredientName: string
  category: string
  unit: string
  currentStock: number
  parLevel: number
  reorderPoint: number
  pendingQty: number // qty on other draft/submitted POs for this supplier
  suggestedQty: number // max(0, par - stock - pending)
  lastPrice: number // cents — last unit_cost from most recent PO item
  productCode?: string
  supplierId: string
  supplierName: string
}

/**
 * Calculate order suggestions for a given supplier + venue.
 *
 * @param supplierId - The supplier to calculate for
 * @param venueId - Venue to scope stock/par data
 * @param ingredients - All ingredients (already venue-scoped from store)
 * @param purchaseOrders - All POs (already loaded from store)
 * @param suppliers - All suppliers
 * @returns OrderSuggestion[] sorted by category then name
 */
export function calculateOrderSuggestions(
  supplierId: string,
  venueId: string,
  ingredients: Ingredient[],
  purchaseOrders: PurchaseOrder[],
  suppliers: Supplier[]
): OrderSuggestion[] {
  const supplier = suppliers.find((s) => s.id === supplierId)
  if (!supplier) return []

  // Filter ingredients linked to this supplier
  const supplierIngredients = ingredients.filter(
    (i) => i.supplier_id === supplierId && i.venue_id === venueId
  )

  // Calculate pending quantities from active POs (draft or submitted) for this supplier
  const activePOs = purchaseOrders.filter(
    (po) =>
      po.supplier_id === supplierId &&
      (po.status === 'draft' || po.status === 'submitted' || po.status === 'confirmed')
  )

  const pendingByIngredient: Record<string, number> = {}
  for (const po of activePOs) {
    for (const item of po.items || []) {
      if (!item.ingredient_id) continue
      const remaining = item.quantity_ordered - (item.quantity_received || 0)
      if (remaining > 0) {
        pendingByIngredient[item.ingredient_id] =
          (pendingByIngredient[item.ingredient_id] || 0) + remaining
      }
    }
  }

  // Find last price per ingredient from most recent delivered/submitted PO items
  const lastPriceByIngredient: Record<string, number> = {}
  // Sort POs newest first to get latest price
  const sortedPOs = [...purchaseOrders]
    .filter((po) => po.supplier_id === supplierId && po.status !== 'cancelled')
    .sort(
      (a, b) =>
        new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
    )

  for (const po of sortedPOs) {
    for (const item of po.items || []) {
      if (!item.ingredient_id) continue
      if (!(item.ingredient_id in lastPriceByIngredient)) {
        lastPriceByIngredient[item.ingredient_id] = item.unit_cost
      }
    }
  }

  const suggestions: OrderSuggestion[] = supplierIngredients.map((ingredient) => {
    const pending = pendingByIngredient[ingredient.id] || 0
    const gap = ingredient.par_level - ingredient.current_stock - pending
    const suggestedQty = Math.max(0, Math.ceil(gap))
    const lastPrice =
      lastPriceByIngredient[ingredient.id] || ingredient.cost_per_unit || 0

    return {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      category: ingredient.category,
      unit: ingredient.unit,
      currentStock: ingredient.current_stock,
      parLevel: ingredient.par_level,
      reorderPoint: ingredient.reorder_point,
      pendingQty: pending,
      suggestedQty,
      lastPrice,
      productCode: ingredient.product_code,
      supplierId,
      supplierName: supplier.name,
    }
  })

  // Sort: items needing reorder first, then by category, then name
  return suggestions.sort((a, b) => {
    // Below reorder point first
    const aBelow = a.currentStock <= a.reorderPoint ? 0 : 1
    const bBelow = b.currentStock <= b.reorderPoint ? 0 : 1
    if (aBelow !== bBelow) return aBelow - bBelow

    // Then by suggested qty descending (most needed first)
    if (b.suggestedQty !== a.suggestedQty) return b.suggestedQty - a.suggestedQty

    // Then alphabetical
    return a.ingredientName.localeCompare(b.ingredientName)
  })
}

/**
 * Calculate the next delivery date based on supplier schedule.
 *
 * @param supplier - Supplier with delivery_days and delivery_lead_days
 * @param orderDate - When the order is placed (defaults to now)
 * @returns Expected delivery date
 */
export function calculateExpectedDelivery(
  supplier: Supplier,
  orderDate: Date = new Date()
): Date {
  const deliveryDays = supplier.delivery_days || []
  if (deliveryDays.length === 0) {
    // Fallback: just add lead days
    const d = new Date(orderDate)
    d.setDate(d.getDate() + (supplier.delivery_lead_days || 1))
    return d
  }

  // Start from order date + lead days, find next delivery day
  const earliest = new Date(orderDate)
  earliest.setDate(earliest.getDate() + (supplier.delivery_lead_days || 1))

  // Search up to 14 days for a matching delivery day
  for (let i = 0; i < 14; i++) {
    const candidate = new Date(earliest)
    candidate.setDate(candidate.getDate() + i)
    if (deliveryDays.includes(candidate.getDay())) {
      return candidate
    }
  }

  // Fallback if no match found
  return earliest
}

/**
 * Check if we're past the cutoff time for ordering from this supplier today.
 *
 * @param supplier - Supplier with cutoff_time (HH:MM)
 * @returns true if past cutoff
 */
export function isPastCutoff(supplier: Supplier): boolean {
  if (!supplier.cutoff_time) return false
  const [hours, minutes] = supplier.cutoff_time.split(':').map(Number)
  const now = new Date()
  const cutoff = new Date()
  cutoff.setHours(hours, minutes, 0, 0)
  return now > cutoff
}

/**
 * Format delivery schedule as human-readable string.
 * e.g., "Orders by Tue 2:00 PM → delivers Thu"
 */
export function formatDeliverySchedule(supplier: Supplier): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const deliveryDays = (supplier.delivery_days || [])
    .sort((a, b) => a - b)
    .map((d) => dayNames[d])

  if (deliveryDays.length === 0) {
    return `${supplier.delivery_lead_days || 1} day lead time`
  }

  // Format cutoff time
  let cutoffStr = ''
  if (supplier.cutoff_time) {
    const [h, m] = supplier.cutoff_time.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h
    cutoffStr = ` by ${displayHour}:${String(m).padStart(2, '0')} ${period}`
  }

  const deliverStr = deliveryDays.join(', ')
  return `Order${cutoffStr} → delivers ${deliverStr}`
}

/**
 * Generate a PO number in format PO-YYYYMMDD-NNN
 */
export function generatePONumber(existingPOs: PurchaseOrder[]): string {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `PO-${dateStr}-`

  // Find highest number for today
  const todayPOs = existingPOs
    .filter((po) => po.po_number.startsWith(prefix))
    .map((po) => {
      const num = parseInt(po.po_number.slice(prefix.length), 10)
      return isNaN(num) ? 0 : num
    })

  const next = todayPOs.length > 0 ? Math.max(...todayPOs) + 1 : 1
  return `${prefix}${String(next).padStart(3, '0')}`
}
