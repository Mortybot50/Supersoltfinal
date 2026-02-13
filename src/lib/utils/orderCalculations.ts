import { addDays, getDay, format } from 'date-fns'
import { Supplier, PurchaseOrder, Ingredient } from '@/types'

/**
 * Calculate usage per thousand dollars of sales
 * Formula: (Total Usage / Total Sales) * 1000
 */
export function calculateUsagePerThousandSales(
  productUsage: number,
  totalSales: number
): number {
  if (totalSales === 0) return 0
  return (productUsage / totalSales) * 1000
}

/**
 * Calculate estimated usage based on forecasted sales
 * Formula: (Forecast Sales / 1000) * Usage Per Thousand
 */
export function calculateEstimatedUsage(
  forecastedSales: number,
  usagePerThousand: number
): number {
  return (forecastedSales / 1000) * usagePerThousand
}

/**
 * Get next delivery date based on supplier schedule
 * Returns the next available delivery date considering:
 * - Supplier's delivery days (e.g., Mon, Wed, Fri)
 * - Cutoff times (e.g., must order by 2pm day before)
 * - Lead time (e.g., 1 day between order and delivery)
 */
export function getNextDeliveryDate(
  supplier: Supplier,
  orderDate: Date = new Date()
): Date {
  const delivery_days = supplier.delivery_days ?? [1, 3, 5]
  const cutoff_time = supplier.cutoff_time || '14:00'
  const delivery_lead_days = supplier.delivery_lead_days ?? 1

  // Parse cutoff time (HH:MM format)
  const [cutoffHour, cutoffMinute] = cutoff_time.split(':').map(Number)
  
  let currentDate = new Date(orderDate)
  
  // If current time is past cutoff, start from tomorrow
  const now = new Date()
  if (
    now.getHours() > cutoffHour ||
    (now.getHours() === cutoffHour && now.getMinutes() >= cutoffMinute)
  ) {
    currentDate = addDays(currentDate, 1)
  }
  
  // Add lead time
  currentDate = addDays(currentDate, delivery_lead_days)
  
  // Find next delivery day
  let daysChecked = 0
  while (daysChecked < 14) { // Check up to 2 weeks ahead
    const dayOfWeek = getDay(currentDate)
    
    if (delivery_days.includes(dayOfWeek)) {
      return currentDate
    }
    
    currentDate = addDays(currentDate, 1)
    daysChecked++
  }
  
  // Fallback: return date with lead time added
  return addDays(orderDate, delivery_lead_days)
}

/**
 * Calculate recommended order quantity
 * Takes into account:
 * - Current stock
 * - Par level
 * - Estimated usage until next delivery
 * - Safety buffer (20% extra)
 */
export function calculateRecommendedQuantity(
  currentStock: number,
  parLevel: number,
  estimatedUsage: number,
  daysUntilDelivery: number,
  safetyBuffer: number = 0.2 // 20% safety buffer
): number {
  // Usage until next delivery (with buffer)
  const usageUntilDelivery = estimatedUsage * (daysUntilDelivery / 7) * (1 + safetyBuffer)
  
  // Target stock after order arrives
  const targetStock = parLevel
  
  // Recommended quantity = Target - (Current - Usage)
  const recommended = targetStock - (currentStock - usageUntilDelivery)
  
  // Don't recommend negative quantities
  return Math.max(0, Math.round(recommended))
}

/**
 * Determine urgency level for ordering
 */
export function determineUrgency(
  currentStock: number,
  parLevel: number,
  reorderPoint: number,
  estimatedUsage: number,
  daysUntilDelivery: number
): 'critical' | 'low' | 'adequate' | 'overstocked' {
  // Calculate days of stock remaining
  const dailyUsage = estimatedUsage / 7
  const daysRemaining = dailyUsage > 0 ? currentStock / dailyUsage : 999
  
  // Critical: will run out before next delivery
  if (daysRemaining < daysUntilDelivery) {
    return 'critical'
  }
  
  // Low: below reorder point
  if (currentStock < reorderPoint) {
    return 'low'
  }
  
  // Overstocked: significantly above par level
  if (currentStock > parLevel * 1.5) {
    return 'overstocked'
  }
  
  // Adequate: between reorder point and par level
  return 'adequate'
}

/**
 * Generate PO number
 * Format: PO-YYYYMMDD-XXX
 */
export function generatePONumber(existingPOs: PurchaseOrder[]): string {
  const today = format(new Date(), 'yyyyMMdd')
  const todayPOs = existingPOs.filter((po) => po.po_number.includes(today))
  const sequence = todayPOs.length + 1
  
  return `PO-${today}-${sequence.toString().padStart(3, '0')}`
}

/**
 * Calculate GST (10% in Australia)
 */
export function calculateGST(amount: number, gstApplicable: boolean): number {
  if (!gstApplicable) return 0
  return Math.round(amount * 0.1)
}
