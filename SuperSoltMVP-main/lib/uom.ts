/**
 * Unit of Measure (UOM) conversion utilities
 * Handles normalization and conversion between common cooking units
 */

// Conversion factors to base units
const CONVERSIONS: Record<string, { base: string; factor: number }> = {
  // Mass conversions (base: g)
  'g': { base: 'g', factor: 1 },
  'gram': { base: 'g', factor: 1 },
  'grams': { base: 'g', factor: 1 },
  'kg': { base: 'g', factor: 1000 },
  'kilogram': { base: 'g', factor: 1000 },
  'kilograms': { base: 'g', factor: 1000 },
  
  // Volume conversions (base: ml)
  'ml': { base: 'ml', factor: 1 },
  'milliliter': { base: 'ml', factor: 1 },
  'milliliters': { base: 'ml', factor: 1 },
  'millilitre': { base: 'ml', factor: 1 },
  'millilitres': { base: 'ml', factor: 1 },
  'l': { base: 'ml', factor: 1000 },
  'liter': { base: 'ml', factor: 1000 },
  'liters': { base: 'ml', factor: 1000 },
  'litre': { base: 'ml', factor: 1000 },
  'litres': { base: 'ml', factor: 1000 },
}

/**
 * Normalize a unit string to lowercase and trim whitespace
 */
export function normalizeUnit(unit: string): string {
  return unit.toLowerCase().trim()
}

/**
 * Get the base unit for a given unit (e.g., 'kg' -> 'g', 'l' -> 'ml')
 */
export function getBaseUnit(unit: string): string | null {
  const normalized = normalizeUnit(unit)
  return CONVERSIONS[normalized]?.base || null
}

/**
 * Convert a quantity from one unit to another
 * Returns null if conversion is not possible (incompatible units)
 */
export function convertUnit(quantity: number, fromUnit: string, toUnit: string): number | null {
  const normalizedFrom = normalizeUnit(fromUnit)
  const normalizedTo = normalizeUnit(toUnit)
  
  // Same unit, no conversion needed
  if (normalizedFrom === normalizedTo) {
    return quantity
  }
  
  const fromConversion = CONVERSIONS[normalizedFrom]
  const toConversion = CONVERSIONS[normalizedTo]
  
  // Units not found in conversion table
  if (!fromConversion || !toConversion) {
    return null
  }
  
  // Units have different base units (e.g., trying to convert g to ml)
  if (fromConversion.base !== toConversion.base) {
    return null
  }
  
  // Convert to base unit, then to target unit
  const inBaseUnits = quantity * fromConversion.factor
  return inBaseUnits / toConversion.factor
}

/**
 * Check if two units are compatible for conversion
 */
export function areUnitsCompatible(unit1: string, unit2: string): boolean {
  const base1 = getBaseUnit(unit1)
  const base2 = getBaseUnit(unit2)
  
  if (!base1 || !base2) {
    return false
  }
  
  return base1 === base2
}

/**
 * Convert quantity to the preferred base unit (g for mass, ml for volume)
 * Returns { quantity, unit } in base units, or null if unit is unknown
 */
export function toBaseUnit(quantity: number, unit: string): { quantity: number; unit: string } | null {
  const normalized = normalizeUnit(unit)
  const conversion = CONVERSIONS[normalized]
  
  if (!conversion) {
    return null
  }
  
  return {
    quantity: quantity * conversion.factor,
    unit: conversion.base,
  }
}
