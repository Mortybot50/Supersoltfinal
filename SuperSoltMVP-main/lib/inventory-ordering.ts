import { db } from "@/db";
import {
  ingredients,
  suppliers,
  ingredientSuppliers,
  menuItems,
  recipes,
  recipeLines,
  salesForecasts,
} from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { convertUnit } from "@/lib/uom";

type Range = { start: Date; end: Date };
type UsageLine = {
  ingredientId: string;
  unit: string;
  qtyPerServe: number;
}; // normalized to ingredient base unit
type BomMap = Map<string, UsageLine[]>; // menuItemId -> lines

/**
 * Flatten a menu item to ingredient usage per serve (handles nested recipes; applies yields & wastage).
 */
export async function buildBomMap(orgId: string): Promise<BomMap> {
  // Pull all recipe_lines joined to know whether a line is ingredient or nested item
  const lines = await db.execute(sql`
    SELECT 
      r.menu_item_id,
      rl.ingredient_id,
      rl.sub_menu_item_id,
      rl.qty,
      rl.unit,
      r.yield_qty,
      r.yield_unit,
      r.wastage_pct,
      i.unit AS ingredient_unit
    FROM recipe_lines rl
    LEFT JOIN recipes r ON r.id = rl.recipe_id
    LEFT JOIN ingredients i ON i.id = rl.ingredient_id
    WHERE r.org_id = ${orgId}
  `);

  // Build adjacency lists
  const byItem = new Map<string, any[]>();
  for (const l of lines.rows as any[]) {
    if (!byItem.has(l.menu_item_id)) byItem.set(l.menu_item_id, []);
    byItem.get(l.menu_item_id)!.push(l);
  }

  const memo = new Map<string, UsageLine[]>();

  const dfs = (itemId: string, scale = 1): UsageLine[] => {
    if (memo.has(itemId) && scale === 1) return memo.get(itemId)!;
    const rows = byItem.get(itemId) ?? [];
    const out: Record<string, { unit: string; qty: number }> = {};

    for (const r of rows) {
      const yieldQty = Number(r.yield_qty ?? 1);
      const wastage = Number(r.wastage_pct ?? 0) / 100;
      const baseFactor = (1 + wastage) / (yieldQty || 1); // per-serve multiplier

      if (r.ingredient_id) {
        const ingUnit = r.ingredient_unit || r.unit; // normalize to ingredient base
        const converted = convertUnit(Number(r.qty) * baseFactor * scale, r.unit, ingUnit);
        const qtyBase = converted ?? Number(r.qty) * baseFactor * scale; // fallback if conversion fails
        const k = r.ingredient_id as string;
        if (!out[k]) out[k] = { unit: ingUnit, qty: 0 };
        out[k].qty += qtyBase;
        
        // Note: conversion errors are tracked at the order guide level where notes are available
      } else if (r.sub_menu_item_id) {
        const childLines = dfs(r.sub_menu_item_id, Number(r.qty) * baseFactor * scale);
        for (const cl of childLines) {
          const k = cl.ingredientId;
          if (!out[k]) out[k] = { unit: cl.unit, qty: 0 };
          out[k].qty += cl.qtyPerServe;
        }
      }
    }

    const flat = Object.entries(out).map(([ingredientId, v]) => ({
      ingredientId,
      unit: v.unit,
      qtyPerServe: v.qty,
    }));
    if (scale === 1) memo.set(itemId, flat);
    return flat;
  };

  // Produce for all menu items that have recipes in this org
  const items = await db.select({ id: menuItems.id }).from(menuItems).where(eq(menuItems.orgId, orgId));
  const map: BomMap = new Map();
  for (const it of items) map.set(it.id, dfs(it.id));
  return map;
}

/**
 * Aggregate forecasted units per menu item for date range.
 */
export async function forecastUnitsByItem(venueId: string, range: Range) {
  const rows = await db
    .select({
      menuItemId: salesForecasts.menuItemId,
      qty: sql<number>`SUM(CAST(${salesForecasts.qty} AS numeric))`.as("qty"),
    })
    .from(salesForecasts)
    .where(
      and(
        eq(salesForecasts.venueId, venueId),
        gte(salesForecasts.date, range.start),
        lte(salesForecasts.date, range.end)
      )
    )
    .groupBy(salesForecasts.menuItemId);

  const map = new Map<string, number>();
  for (const r of rows) map.set(r.menuItemId as string, Number(r.qty));
  return map;
}

export type OrderGuideLine = {
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  requiredUnits: number; // demand in base unit
  onHandUnits: number; // in base unit
  shortfallUnits: number; // max(0, required+ss - onHand)
  supplierId?: string;
  supplierName?: string;
  packSize?: number;
  packUnit?: string;
  unitPrice?: number; // price in dollars per purchase unit
  packsRecommended: number; // ceil(shortfall in purchase units)
  estCost: number;
  notes: string[];
};

export type OrderGuideGroup = {
  supplierId?: string;
  supplierName: string;
  lines: OrderGuideLine[];
  groupCost: number;
};

export async function buildOrderGuide({
  orgId,
  venueId,
  range,
  safetyDays = 0,
}: {
  orgId: string;
  venueId: string;
  range: Range;
  safetyDays?: number;
}): Promise<{ groups: OrderGuideGroup[]; totals: { items: number; cost: number } }> {
  // 1) Demand: per item forecast × per-serve usage → ingredient demand
  const [bomMap, unitsByItem] = await Promise.all([buildBomMap(orgId), forecastUnitsByItem(venueId, range)]);

  const demand = new Map<string, { unit: string; qty: number }>(); // ingredientId -> base-unit qty
  for (const [itemId, units] of unitsByItem) {
    const bom = bomMap.get(itemId) ?? [];
    for (const line of bom) {
      const need = line.qtyPerServe * units;
      const cur = demand.get(line.ingredientId) ?? { unit: line.unit, qty: 0 };
      cur.qty += need;
      demand.set(line.ingredientId, cur);
    }
  }

  // 2) On-hand + safety stock
  //   Safety stock = average daily demand for the ingredient * safetyDays
  const days = (range.end.getTime() - range.start.getTime()) / 86_400_000 + 1;
  const lines: OrderGuideLine[] = [];

  const ingRows = await db.execute(sql`
    SELECT i.id, i.name, i.unit AS base_unit, COALESCE(i.current_stock_level, 0) AS on_hand
    FROM ingredients i
    WHERE i.org_id = ${orgId}
  `);

  for (const r of ingRows.rows as any[]) {
    const need = demand.get(r.id)?.qty ?? 0;
    const ss = safetyDays > 0 ? (need / Math.max(1, days)) * safetyDays : 0;
    const required = need;
    const onHand = Number(r.on_hand || 0);
    const shortfall = Math.max(0, required + ss - onHand);

    const notes: string[] = [];
    let supplierId: string | undefined;
    let supplierName: string | undefined;
    let packSize: number | undefined;
    let packUnit: string | undefined;
    let unitPrice: number | undefined;
    let packsRecommended = 0;
    let estCost = 0;

    if (shortfall > 0) {
      // Supplier choice: preferred first else cheapest unit price
      const supRows = await db.execute(sql`
        SELECT 
          isup.supplier_id,
          s.name as supplier_name,
          isup.pack_size,
          isup.pack_unit,
          isup.unit_price_cents,
          isup.is_preferred
        FROM ingredient_suppliers isup
        JOIN suppliers s ON s.id = isup.supplier_id
        WHERE isup.ingredient_id = ${r.id}
        ORDER BY isup.is_preferred DESC, isup.unit_price_cents ASC
        LIMIT 1
      `);
      const sup = (supRows.rows as any[])[0];
      if (sup) {
        supplierId = sup.supplier_id;
        supplierName = sup.supplier_name;
        packSize = Number(sup.pack_size || 1);
        packUnit = sup.pack_unit || r.base_unit;
        unitPrice = Number(sup.unit_price_cents || 0) / 100; // convert cents to dollars

        const converted = packUnit ? convertUnit(shortfall, r.base_unit, packUnit) : null;
        if (converted === null && packUnit && packUnit !== r.base_unit) {
          notes.push("Unit conversion missing");
          // Cannot safely calculate packs without conversion - require manual review
          packsRecommended = 0;
          estCost = 0;
        } else {
          const shortfallInPurchaseUnits = converted ?? shortfall;
          packsRecommended = Math.ceil(shortfallInPurchaseUnits / (packSize || 1));
          estCost = packsRecommended * (unitPrice || 0);
        }
      } else {
        notes.push("No supplier configured");
      }
    }

    lines.push({
      ingredientId: r.id,
      ingredientName: r.name,
      baseUnit: r.base_unit,
      requiredUnits: Number(required.toFixed(2)),
      onHandUnits: Number(onHand.toFixed(2)),
      shortfallUnits: Number(shortfall.toFixed(2)),
      supplierId,
      supplierName,
      packSize,
      packUnit,
      unitPrice,
      packsRecommended,
      estCost: Number(estCost.toFixed(2)),
      notes,
    });
  }

  // 3) Group by supplier (null supplier group at bottom)
  const bySupplier = new Map<string, OrderGuideGroup>();
  for (const l of lines.filter((x) => x.shortfallUnits > 0)) {
    const key = l.supplierId ?? "__NO_SUPPLIER__";
    const name = l.supplierName ?? "No supplier";
    if (!bySupplier.has(key))
      bySupplier.set(key, { supplierId: l.supplierId, supplierName: name, lines: [], groupCost: 0 });
    const g = bySupplier.get(key)!;
    g.lines.push(l);
    g.groupCost += l.estCost;
  }

  const groups = Array.from(bySupplier.values()).sort((a, b) =>
    (a.supplierName || "").localeCompare(b.supplierName || "")
  );

  const totals = {
    items: lines.filter((x) => x.shortfallUnits > 0).length,
    cost: groups.reduce((s, g) => s + g.groupCost, 0),
  };

  return { groups, totals };
}
