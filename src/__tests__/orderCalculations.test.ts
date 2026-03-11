/**
 * Tests for order guide calculations:
 * - calculateRecommendedQuantity (par levels + safety buffer)
 * - determineUrgency (stock level status)
 * - calculateGST (AU 10% GST)
 */

import { describe, it, expect } from 'vitest'
import {
  calculateRecommendedQuantity,
  determineUrgency,
  calculateGST,
} from '../lib/utils/orderCalculations'

describe('calculateRecommendedQuantity', () => {
  it('recommends 0 when current stock covers par level with no usage', () => {
    // parLevel=10, current=10, usage=0
    const qty = calculateRecommendedQuantity(10, 10, 0, 1)
    expect(qty).toBe(0)
  })

  it('recommends enough to reach par with safety buffer', () => {
    // currentStock=2, parLevel=10, estimatedUsage=7/wk, delivery in 1 day
    // usageUntilDelivery = 7 * (1/7) * 1.2 = 1.2
    // recommended = 10 - (2 - 1.2) = 10 - 0.8 = 9.2 → round → 9
    const qty = calculateRecommendedQuantity(2, 10, 7, 1)
    expect(qty).toBe(9)
  })

  it('recommends 0 when fully stocked above par (no negative order)', () => {
    // Overstocked: current=20, par=10
    const qty = calculateRecommendedQuantity(20, 10, 0, 1)
    expect(qty).toBe(0)
  })

  it('includes custom safety buffer in recommendation', () => {
    // 0.5 = 50% buffer
    const qtyDefault = calculateRecommendedQuantity(0, 10, 7, 7)
    const qtyHighBuffer = calculateRecommendedQuantity(0, 10, 7, 7, 0.5)
    // Higher buffer means more stock recommended
    expect(qtyHighBuffer).toBeGreaterThan(qtyDefault)
  })
})

describe('determineUrgency', () => {
  it('returns critical when stock will run out before next delivery', () => {
    // Stock=1, dailyUsage=2 → 0.5 days remaining, delivery in 2 days
    const urgency = determineUrgency(1, 10, 5, 14, 2)
    expect(urgency).toBe('critical')
  })

  it('returns low when stock is below reorder point', () => {
    // Stock=3 < reorderPoint=5, but won't run out before delivery
    const urgency = determineUrgency(3, 10, 5, 1, 1)
    expect(urgency).toBe('low')
  })

  it('returns overstocked when > 1.5x par level', () => {
    // Stock=20, par=10 → 2x par = overstocked
    const urgency = determineUrgency(20, 10, 5, 7, 2)
    expect(urgency).toBe('overstocked')
  })

  it('returns adequate when between reorder point and par', () => {
    // Stock=7, par=10, reorder=5 → adequate
    const urgency = determineUrgency(7, 10, 5, 7, 2)
    expect(urgency).toBe('adequate')
  })

  it('returns adequate when usage is 0 (no depletion expected)', () => {
    // usage=0 → daysRemaining=999 → not critical
    const urgency = determineUrgency(5, 10, 2, 0, 2)
    // Stock 5 > reorder 2, not overstocked (5 < 15), usage=0 → adequate
    expect(urgency).toBe('adequate')
  })
})

describe('calculateGST', () => {
  it('returns 10% of amount when GST applicable', () => {
    expect(calculateGST(1000, true)).toBe(100)
  })

  it('returns 0 when GST not applicable', () => {
    expect(calculateGST(1000, false)).toBe(0)
  })

  it('rounds fractional GST to integer cents', () => {
    // 10% of 333 = 33.3 → rounds to 33
    expect(calculateGST(333, true)).toBe(33)
  })
})
