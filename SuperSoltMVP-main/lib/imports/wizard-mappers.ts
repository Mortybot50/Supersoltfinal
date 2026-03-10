import { format } from "date-fns";

// Common helper: convert to cents (accepts "$12.50" or "12.50" or 12.50)
export function toCents(v: any): number {
  if (typeof v === "number") return Math.round(v * 100);
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,\s]/g, "").trim();
    const num = parseFloat(cleaned);
    if (isNaN(num)) throw new Error(`Invalid price: ${v}`);
    return Math.round(num * 100);
  }
  throw new Error(`Invalid price value: ${v}`);
}

// Common helper: parse unit (normalize kg->g, l->ml)
export function parseUnit(v: string): string {
  const normalized = v.toLowerCase().trim();
  const unitMap: Record<string, string> = {
    kg: "g",
    g: "g",
    l: "ml",
    ml: "ml",
    each: "each",
    ea: "each",
  };
  const mapped = unitMap[normalized];
  if (!mapped) throw new Error(`Unknown unit: ${v}`);
  return mapped;
}

// Common helper: convert quantity to base units
export function toBaseUnits(qty: number, unit: string): number {
  const normalized = unit.toLowerCase().trim();
  if (normalized === "kg") return qty * 1000;
  if (normalized === "l") return qty * 1000;
  return qty;
}

// Common helper: date to ISO YYYY-MM-DD in local timezone
export function dateISO(v: any, tz: string = "Australia/Melbourne"): string {
  let date: Date;
  
  if (v instanceof Date) {
    date = v;
  } else if (typeof v === "string") {
    // Try parsing various formats
    date = new Date(v);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${v}`);
    }
  } else {
    throw new Error(`Invalid date value: ${v}`);
  }

  // Format as YYYY-MM-DD (UTC safe)
  return format(date, "yyyy-MM-dd");
}

// Row status type
export type RowStatus = {
  status: "ok" | "error";
  message?: string;
  data?: any;
};

/**
 * INGREDIENTS MAPPER
 * Fields: name, purchase_unit, preferred_supplier, supplier_sku, pack_size, pack_unit, pack_cost(¢|$), cost_per_unit_cents(optional)
 */
export function mapIngredients(rows: any[], mapping: Record<string, string>): RowStatus[] {
  return rows.map((row, idx) => {
    try {
      const name = row[mapping.name];
      const purchaseUnit = row[mapping.purchase_unit];
      const preferredSupplier = row[mapping.preferred_supplier];
      const supplierSku = row[mapping.supplier_sku];
      const packSize = row[mapping.pack_size];
      const packUnit = row[mapping.pack_unit];
      const packCost = row[mapping.pack_cost];

      if (!name) throw new Error("Name is required");
      if (!purchaseUnit) throw new Error("Purchase unit is required");

      const baseUnit = parseUnit(purchaseUnit);
      const packSizeQty = packSize ? parseFloat(packSize) : undefined;
      const packUnitBase = packUnit ? parseUnit(packUnit) : undefined;
      const packCostCents = packCost ? toCents(packCost) : undefined;

      let costPerUnitCents: number | undefined;
      if (packSizeQty && packUnitBase && packCostCents) {
        const packSizeInBase = toBaseUnits(packSizeQty, packUnitBase);
        costPerUnitCents = Math.round(packCostCents / packSizeInBase);
      }

      return {
        status: "ok" as const,
        data: {
          name: name.trim(),
          purchaseUnit: baseUnit,
          preferredSupplier: preferredSupplier?.trim(),
          supplierSku: supplierSku?.trim(),
          packSize: packSizeQty,
          packUnit: packUnitBase,
          packCostCents,
          costPerUnitCents,
        },
      };
    } catch (error: any) {
      return {
        status: "error" as const,
        message: error.message,
      };
    }
  });
}

/**
 * MENU ITEMS MAPPER
 * Fields: name, price(¢|$), tax(optional)
 */
export function mapMenuItems(rows: any[], mapping: Record<string, string>): RowStatus[] {
  return rows.map((row) => {
    try {
      const name = row[mapping.name];
      const price = row[mapping.price];
      const tax = row[mapping.tax];

      if (!name) throw new Error("Name is required");
      if (!price && price !== 0) throw new Error("Price is required");

      const priceCents = toCents(price);
      const taxCents = tax ? toCents(tax) : undefined;

      return {
        status: "ok" as const,
        data: {
          name: name.trim(),
          priceCents,
          taxCents,
        },
      };
    } catch (error: any) {
      return {
        status: "error" as const,
        message: error.message,
      };
    }
  });
}

/**
 * RECIPES MAPPER
 * Fields: menu_item_name|id, ingredient_name|id, qty, unit, yield_pct(optional), wastage_pct(optional)
 */
export function mapRecipes(rows: any[], mapping: Record<string, string>): RowStatus[] {
  return rows.map((row) => {
    try {
      const menuItemName = row[mapping.menu_item_name];
      const menuItemId = row[mapping.menu_item_id];
      const ingredientName = row[mapping.ingredient_name];
      const ingredientId = row[mapping.ingredient_id];
      const qty = row[mapping.qty];
      const unit = row[mapping.unit];
      const yieldPct = row[mapping.yield_pct];
      const wastagePct = row[mapping.wastage_pct];

      if (!menuItemName && !menuItemId) throw new Error("Menu item name or ID is required");
      if (!ingredientName && !ingredientId) throw new Error("Ingredient name or ID is required");
      if (!qty) throw new Error("Quantity is required");
      if (!unit) throw new Error("Unit is required");

      const qtyNum = parseFloat(qty);
      if (isNaN(qtyNum) || qtyNum <= 0) throw new Error("Quantity must be > 0");

      const baseUnit = parseUnit(unit);
      const qtyBase = toBaseUnits(qtyNum, unit);

      return {
        status: "ok" as const,
        data: {
          menuItemName: menuItemName?.trim(),
          menuItemId: menuItemId?.trim(),
          ingredientName: ingredientName?.trim(),
          ingredientId: ingredientId?.trim(),
          qty: qtyNum,
          unit: baseUnit,
          qtyBase,
          yieldPct: yieldPct ? parseFloat(yieldPct) : 100,
          wastagePct: wastagePct ? parseFloat(wastagePct) : 0,
        },
      };
    } catch (error: any) {
      return {
        status: "error" as const,
        message: error.message,
      };
    }
  });
}

/**
 * STAFF MAPPER
 * Fields: name, email, role, hourly_rate(¢|$)
 */
export function mapStaff(rows: any[], mapping: Record<string, string>): RowStatus[] {
  const validRoles = ["FOH", "BOH", "Bar", "Manager"];
  
  return rows.map((row) => {
    try {
      const name = row[mapping.name];
      const email = row[mapping.email];
      const role = row[mapping.role];
      const hourlyRate = row[mapping.hourly_rate];

      if (!name) throw new Error("Name is required");
      if (!email) throw new Error("Email is required");
      if (!role) throw new Error("Role is required");
      if (!hourlyRate && hourlyRate !== 0) throw new Error("Hourly rate is required");

      // Basic email validation
      if (!email.includes("@")) throw new Error("Invalid email format");

      // Role validation
      if (!validRoles.includes(role)) {
        throw new Error(`Role must be one of: ${validRoles.join(", ")}`);
      }

      const hourlyRateCents = toCents(hourlyRate);

      return {
        status: "ok" as const,
        data: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role: role.trim(),
          hourlyRateCents,
        },
      };
    } catch (error: any) {
      return {
        status: "error" as const,
        message: error.message,
      };
    }
  });
}

/**
 * SALES MAPPER
 * Fields: date, menu_item_name|id, qty, unit_price(¢|$ optional)
 */
export function mapSales(rows: any[], mapping: Record<string, string>): RowStatus[] {
  return rows.map((row) => {
    try {
      const date = row[mapping.date];
      const menuItemName = row[mapping.menu_item_name];
      const menuItemId = row[mapping.menu_item_id];
      const qty = row[mapping.qty];
      const unitPrice = row[mapping.unit_price];

      if (!date) throw new Error("Date is required");
      if (!menuItemName && !menuItemId) throw new Error("Menu item name or ID is required");
      if (!qty) throw new Error("Quantity is required");

      const dateISO = format(new Date(date), "yyyy-MM-dd");
      const qtyNum = parseFloat(qty);
      if (isNaN(qtyNum) || qtyNum < 1) throw new Error("Quantity must be >= 1");

      const unitPriceCents = unitPrice ? toCents(unitPrice) : undefined;

      return {
        status: "ok" as const,
        data: {
          date: dateISO,
          menuItemName: menuItemName?.trim(),
          menuItemId: menuItemId?.trim(),
          qty: Math.round(qtyNum),
          unitPriceCents,
        },
      };
    } catch (error: any) {
      return {
        status: "error" as const,
        message: error.message,
      };
    }
  });
}

/**
 * STOCK MAPPER
 * Fields: ingredient_name|id, qty, unit
 */
export function mapStock(rows: any[], mapping: Record<string, string>): RowStatus[] {
  return rows.map((row) => {
    try {
      const ingredientName = row[mapping.ingredient_name];
      const ingredientId = row[mapping.ingredient_id];
      const qty = row[mapping.qty];
      const unit = row[mapping.unit];

      if (!ingredientName && !ingredientId) throw new Error("Ingredient name or ID is required");
      if (!qty && qty !== 0) throw new Error("Quantity is required");
      if (!unit) throw new Error("Unit is required");

      const qtyNum = parseFloat(qty);
      if (isNaN(qtyNum)) throw new Error("Quantity must be a number");

      const baseUnit = parseUnit(unit);
      const qtyBase = toBaseUnits(qtyNum, unit);

      return {
        status: "ok" as const,
        data: {
          ingredientName: ingredientName?.trim(),
          ingredientId: ingredientId?.trim(),
          qty: qtyNum,
          unit: baseUnit,
          qtyBase,
        },
      };
    } catch (error: any) {
      return {
        status: "error" as const,
        message: error.message,
      };
    }
  });
}
