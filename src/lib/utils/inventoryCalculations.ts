/**
 * Inventory calculation utilities for stock count variance analysis
 * and theoretical stock estimation.
 */

/**
 * Calculate theoretical stock based on last count + received POs - usage - waste.
 *
 * Formula:
 *   theoretical = lastCountQty + totalReceived - totalUsage - totalWaste
 *
 * @param lastCountQty  - Quantity from the most recent completed stock count
 * @param receivedQty   - Total quantity received via purchase orders since last count
 * @param usageQty      - Total usage derived from orders × recipe quantities since last count
 * @param wasteQty      - Total waste logged since last count
 * @returns Theoretical stock level (floored at 0)
 */
export function calculateTheoreticalStock(
  lastCountQty: number,
  receivedQty: number,
  usageQty: number,
  wasteQty: number
): number {
  const theoretical = lastCountQty + receivedQty - usageQty - wasteQty
  return Math.max(0, theoretical)
}

/**
 * Calculate variance between actual counted quantity and expected quantity.
 */
export function calculateVariance(actual: number, expected: number): number {
  return actual - expected
}

/**
 * Calculate variance as a percentage of expected.
 * Returns 0 if expected is 0 and actual is also 0.
 * Returns 100 if expected is 0 but actual > 0.
 */
export function calculateVariancePercent(actual: number, expected: number): number {
  if (expected === 0) return actual > 0 ? 100 : 0
  return ((actual - expected) / expected) * 100
}

/**
 * Calculate variance value in cents.
 */
export function calculateVarianceValue(
  actual: number,
  expected: number,
  costPerUnit: number
): number {
  return (actual - expected) * costPerUnit
}

/**
 * Determine if a variance is "large" (threshold-worthy).
 * A variance is large if:
 *   - |variance%| > percentThreshold AND expected > 0, OR
 *   - |varianceValue| > valueThreshold (in cents)
 */
export function isLargeVariance(
  actual: number,
  expected: number,
  costPerUnit: number,
  percentThreshold = 10,
  valueThreshold = 5000 // $50 in cents
): boolean {
  const varPct = Math.abs(calculateVariancePercent(actual, expected))
  const varVal = Math.abs(calculateVarianceValue(actual, expected, costPerUnit))
  return (varPct > percentThreshold && expected > 0) || varVal > valueThreshold
}

/**
 * Convert between primary unit and alternative unit.
 * Uses pack_to_base_factor from the ingredient.
 *
 * @param value       - The quantity in the source unit
 * @param factor      - pack_to_base_factor (how many base units per pack)
 * @param toBase      - If true, converts packs → base units. If false, base → packs.
 */
export function convertUnit(
  value: number,
  factor: number,
  toBase: boolean
): number {
  if (factor <= 0) return value
  return toBase ? value * factor : value / factor
}

/**
 * Generate a stock count number in format SC-YYYYMMDD-NNN
 */
export function generateCountNumber(existingCountsToday: number): string {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const seq = String(existingCountsToday + 1).padStart(3, '0')
  return `SC-${yyyy}${mm}${dd}-${seq}`
}

/**
 * Aggregate variance data by category for chart display.
 */
export function aggregateVarianceByCategory(
  items: Array<{
    ingredientCategory: string
    varianceValue: number
  }>
): Array<{ category: string; variance: number }> {
  const map = new Map<string, number>()
  for (const item of items) {
    const cat = item.ingredientCategory || 'Other'
    map.set(cat, (map.get(cat) ?? 0) + item.varianceValue)
  }
  return Array.from(map.entries())
    .map(([category, variance]) => ({ category, variance }))
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
}
