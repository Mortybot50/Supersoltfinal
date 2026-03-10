import { IngredientRowType, StaffRowType, MenuItemRowType, StockRowType, SalesDailyRowType } from "./schemas";

// Convert price string to cents (e.g., "14.90" -> 1490)
export function parsePriceToCents(price: string): number {
  const num = parseFloat(price);
  if (isNaN(num) || num < 0) {
    throw new Error(`Invalid price: ${price}`);
  }
  return Math.round(num * 100);
}

// Convert quantity string to number
export function parseQuantity(qty: string): number {
  const num = parseFloat(qty);
  if (isNaN(num) || num < 0) {
    throw new Error(`Invalid quantity: ${qty}`);
  }
  return num;
}

// Normalize unit to base unit ("kg" -> "g", "l" -> "ml", "each" -> "each")
export function normalizeUnit(qty: number, uom: string): { qty: number; uom: string } {
  const normalizedUom = uom.toLowerCase().trim();
  
  switch (normalizedUom) {
    case "kg":
      return { qty: qty * 1000, uom: "g" };
    case "g":
      return { qty, uom: "g" };
    case "l":
      return { qty: qty * 1000, uom: "ml" };
    case "ml":
      return { qty, uom: "ml" };
    case "each":
    case "ea":
      return { qty, uom: "each" };
    default:
      throw new Error(`Unknown unit: ${uom}`);
  }
}

// Parse pack size string (e.g., "6x 1kg" -> { packQty: 6, unitQty: 1000, uom: "g" })
export function parsePackSize(packSizeStr: string): { packQty: number; unitQty: number; uom: string } | undefined {
  if (!packSizeStr || packSizeStr.trim() === "") {
    return undefined;
  }

  const str = packSizeStr.trim().toLowerCase();
  
  // Pattern: "6x 1kg" or "6 x 1kg" or "1kg"
  const match = str.match(/^(?:(\d+)\s*x\s*)?(\d+(?:\.\d+)?)\s*(kg|g|l|ml|each)$/);
  
  if (!match) {
    throw new Error(`Invalid pack size format: ${packSizeStr}`);
  }

  const packQty = match[1] ? parseInt(match[1]) : 1;
  const unitQty = parseFloat(match[2]);
  const unitType = match[3];

  const normalized = normalizeUnit(unitQty, unitType);

  return {
    packQty,
    unitQty: normalized.qty,
    uom: normalized.uom,
  };
}

// Normalize ingredient row
export interface NormalizedIngredient {
  externalId: string;
  name: string;
  uom: string;
  packSize?: { packQty: number; unitQty: number; uom: string };
  packCostCents?: number;
  supplierExternalId?: string;
}

export function normalizeIngredient(row: IngredientRowType): NormalizedIngredient {
  const normalized: NormalizedIngredient = {
    externalId: row.external_id,
    name: row.name,
    uom: row.uom,
  };

  if (row.pack_size) {
    normalized.packSize = parsePackSize(row.pack_size);
  }

  if (row.pack_cost) {
    normalized.packCostCents = parsePriceToCents(row.pack_cost);
  }

  if (row.supplier_external_id) {
    normalized.supplierExternalId = row.supplier_external_id;
  }

  return normalized;
}

// Normalize staff row
export interface NormalizedStaff {
  externalId: string;
  name: string;
  email: string;
  phone?: string;
  roleTitle: string;
  hourlyRateCents: number;
}

export function normalizeStaff(row: StaffRowType): NormalizedStaff {
  return {
    externalId: row.external_id,
    name: row.name,
    email: row.email,
    phone: row.phone || undefined,
    roleTitle: row.role,
    hourlyRateCents: parsePriceToCents(row.hourly_rate),
  };
}

// Normalize menu item row
export interface NormalizedMenuItem {
  externalId: string;
  name: string;
  priceCents: number;
  category?: string;
  recipeJson?: any;
}

export function normalizeMenuItem(row: MenuItemRowType): NormalizedMenuItem {
  const normalized: NormalizedMenuItem = {
    externalId: row.external_id,
    name: row.name,
    priceCents: parsePriceToCents(row.price),
  };

  if (row.category) {
    normalized.category = row.category;
  }

  if (row.recipe_json) {
    try {
      normalized.recipeJson = JSON.parse(row.recipe_json);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid recipe JSON: ${message}`);
    }
  }

  return normalized;
}

// Normalize stock row
export interface NormalizedStock {
  ingredientExternalId: string;
  onHandQty: number;
  uom: string;
}

export function normalizeStock(row: StockRowType): NormalizedStock {
  const qty = parseQuantity(row.on_hand_qty);
  const normalized = normalizeUnit(qty, row.uom);
  
  return {
    ingredientExternalId: row.ingredient_external_id,
    onHandQty: normalized.qty,
    uom: normalized.uom,
  };
}

// Normalize sales daily row
export interface NormalizedSalesDaily {
  date: string;
  menuItemExternalId: string;
  qty: number;
  revenueCents?: number;
}

export function normalizeSalesDaily(row: SalesDailyRowType): NormalizedSalesDaily {
  const normalized: NormalizedSalesDaily = {
    date: row.date,
    menuItemExternalId: row.menu_item_external_id,
    qty: parseQuantity(row.qty),
  };

  if (row.revenue) {
    normalized.revenueCents = parsePriceToCents(row.revenue);
  }

  return normalized;
}
