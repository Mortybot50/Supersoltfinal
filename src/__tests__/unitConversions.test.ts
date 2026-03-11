/**
 * Tests for unit conversion utilities used in recipe costing.
 *
 * Covers:
 * - convertQtyToBaseUnits (g/kg, mL/L, each)
 * - calculatePackToBaseFactor
 * - calculateLineCost (recipe ingredient costing)
 * - calculateCostPerBaseUnit (price-per-base-unit calculation)
 */

import { describe, it, expect } from 'vitest'
import {
  convertQtyToBaseUnits,
  calculatePackToBaseFactor,
  calculateLineCost,
  calculateCostPerBaseUnit,
} from '../lib/utils/unitConversions'

describe('convertQtyToBaseUnits', () => {
  it('converts kg → g (1kg = 1000g)', () => {
    expect(convertQtyToBaseUnits(1, 'kg')).toBe(1000)
  })

  it('converts g → g (no change)', () => {
    expect(convertQtyToBaseUnits(500, 'g')).toBe(500)
  })

  it('converts L → mL (1L = 1000mL)', () => {
    expect(convertQtyToBaseUnits(1, 'L')).toBe(1000)
  })

  it('converts mL → mL (no change)', () => {
    expect(convertQtyToBaseUnits(250, 'mL')).toBe(250)
  })

  it('converts ea (count stays 1:1)', () => {
    expect(convertQtyToBaseUnits(3, 'ea')).toBe(3)
  })

  it('treats unknown units with factor 1', () => {
    expect(convertQtyToBaseUnits(5, 'box')).toBe(5)
  })
})

describe('calculatePackToBaseFactor', () => {
  it('calculates pack-to-base for 1×1kg bag (1 unit × 1kg = 1000g)', () => {
    // 1 unit, 1kg size → 1 * 1 * 1000 = 1000g per pack
    expect(calculatePackToBaseFactor(1, 1, 'kg')).toBe(1000)
  })

  it('calculates pack-to-base for 6×250mL carton (6 × 250mL = 1500mL)', () => {
    expect(calculatePackToBaseFactor(6, 250, 'mL')).toBe(1500)
  })

  it('calculates pack-to-base for 12×1ea eggs (12 each)', () => {
    expect(calculatePackToBaseFactor(12, 1, 'ea')).toBe(12)
  })
})

describe('calculateCostPerBaseUnit', () => {
  it('calculates cost per gram for a 1kg bag costing $5 (500c)', () => {
    // $5 for 1000g = 0.5c/g
    const costPerG = calculateCostPerBaseUnit(500, 1000)
    expect(costPerG).toBeCloseTo(0.5)
  })

  it('calculates cost per mL for a 1L bottle costing $3 (300c)', () => {
    // $3 for 1000mL = 0.3c/mL
    const costPerML = calculateCostPerBaseUnit(300, 1000)
    expect(costPerML).toBeCloseTo(0.3)
  })

  it('returns 0 when packToBaseFactor is 0 (no div-by-zero)', () => {
    expect(calculateCostPerBaseUnit(500, 0)).toBe(0)
  })
})

describe('calculateLineCost — recipe ingredient line costing', () => {
  it('calculates cost for 200g of ingredient at 0.5c/g', () => {
    // 200g × 0.5c/g = 100c
    expect(calculateLineCost(200, 'g', 0.5)).toBe(100)
  })

  it('calculates cost for 0.5kg of ingredient at 0.5c/g (converts kg → g first)', () => {
    // 0.5kg = 500g, 500g × 0.5c/g = 250c
    expect(calculateLineCost(0.5, 'kg', 0.5)).toBe(250)
  })

  it('calculates cost for 100mL at 0.3c/mL', () => {
    // 100mL × 0.3c/mL = 30c
    expect(calculateLineCost(100, 'mL', 0.3)).toBe(30)
  })

  it('calculates cost for 2 each at 150c/ea', () => {
    // 2 × 150 = 300c
    expect(calculateLineCost(2, 'ea', 150)).toBe(300)
  })

  it('rounds fractional cents correctly', () => {
    // 3g × 0.333c/g ≈ 1c (rounds to integer)
    const cost = calculateLineCost(3, 'g', 0.333)
    expect(Number.isInteger(cost)).toBe(true)
    expect(cost).toBe(1)
  })
})
