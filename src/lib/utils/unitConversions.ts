// Unit conversion factors (to base unit)
export const CONVERSION_FACTORS: Record<string, number> = {
  // Weight
  g: 1,
  kg: 1000,

  // Volume
  mL: 1,
  L: 1000,

  // Count
  ea: 1,
  each: 1,
};

/**
 * Get compatible units for a given unit
 */
export function getCompatibleUnits(unit: string): string[] {
  if (["g", "kg"].includes(unit)) {
    return ["g", "kg"];
  }
  if (["mL", "L"].includes(unit)) {
    return ["mL", "L"];
  }
  return ["ea"];
}

// Map units to their base unit
export const BASE_UNIT_MAP: Record<string, string> = {
  g: "g",
  kg: "g",
  mL: "mL",
  L: "mL",
  ea: "ea",
  each: "each",
};

export function getBaseUnit(unit: string): string {
  return BASE_UNIT_MAP[unit] || unit;
}

export function calculatePackToBaseFactor(
  unitsPerPack: number,
  unitSize: number,
  unit: string,
): number {
  const factor = CONVERSION_FACTORS[unit] || 1;
  return unitsPerPack * unitSize * factor;
}

export function convertQtyToBaseUnits(qty: number, unit: string): number {
  const factor = CONVERSION_FACTORS[unit] || 1;
  return qty * factor;
}

export function calculateLineCost(
  qty: number,
  recipeUnit: string,
  costPerBaseUnitCents: number,
): number {
  const qtyInBase = convertQtyToBaseUnits(qty, recipeUnit);
  return Math.round(qtyInBase * costPerBaseUnitCents);
}

export function calculateCostPerBaseUnit(
  costCents: number,
  packToBaseFactor: number,
): number {
  if (packToBaseFactor === 0) return 0;
  return costCents / packToBaseFactor;
}

export function formatPackSizeText(
  unitsPerPack: number,
  unitSize: number,
  unit: string,
): string {
  const sizeStr =
    unitSize % 1 === 0 ? unitSize.toFixed(0) : unitSize.toString();
  if (unitsPerPack === 1 && unitSize === 1) return "1" + unit;
  if (unitsPerPack === 1) return sizeStr + unit;
  return unitsPerPack + "×" + sizeStr + unit;
}

export function formatBaseUnitCost(
  costPerBaseUnitCents: number,
  baseUnit: string,
): string {
  const dollars = costPerBaseUnitCents / 100;
  if (dollars < 0.0001) return "A$" + dollars.toFixed(6) + "/" + baseUnit;
  if (dollars < 0.01) return "A$" + dollars.toFixed(4) + "/" + baseUnit;
  if (dollars < 0.1) return "A$" + dollars.toFixed(3) + "/" + baseUnit;
  return "A$" + dollars.toFixed(2) + "/" + baseUnit;
}
