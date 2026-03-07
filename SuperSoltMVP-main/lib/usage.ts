/**
 * Theoretical Usage Engine
 * Calculates expected ingredient usage based on sales (actual or forecast) and recipes
 */

import { db } from "@/db";
import { dailySales, salesForecasts, ingredients, stockMovements } from "@/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { buildBomMap } from "./inventory-ordering";

/**
 * Compute theoretical ingredient usage for a time window
 * @returns Map of ingredientId -> qty in base units
 */
export async function computeTheoreticalUsage(params: {
  orgId: string;
  venueId: string;
  start: Date;
  end: Date;
  useForecast?: boolean; // Fall back to forecast if actual sales not available
}): Promise<Map<string, number>> {
  const { orgId, venueId, start, end, useForecast = false } = params;

  // Build BOM (ingredient usage per serve for each menu item)
  const bomMap = await buildBomMap(orgId);

  // Get actual sales for the window
  const actualSales = await db
    .select({
      menuItemId: dailySales.menuItemId,
      qty: sql<string>`COALESCE(SUM(${dailySales.quantitySold}), 0)`,
    })
    .from(dailySales)
    .where(
      and(
        eq(dailySales.orgId, orgId),
        eq(dailySales.venueId, venueId),
        gte(sql`${dailySales.saleDate}::date`, start.toISOString().split('T')[0]),
        lte(sql`${dailySales.saleDate}::date`, end.toISOString().split('T')[0])
      )
    )
    .groupBy(dailySales.menuItemId);

  // Build sales map (menuItemId -> total qty sold)
  const salesMap = new Map<string, number>();
  for (const row of actualSales) {
    salesMap.set(row.menuItemId, Number(row.qty));
  }

  // If useForecast enabled and we have missing items, fetch forecasts
  if (useForecast) {
    const forecastSales = await db
      .select({
        menuItemId: salesForecasts.menuItemId,
        qty: sql<string>`COALESCE(SUM(${salesForecasts.qty}), 0)`,
      })
      .from(salesForecasts)
      .where(
        and(
          eq(salesForecasts.orgId, orgId),
          eq(salesForecasts.venueId, venueId),
          gte(salesForecasts.date, start),
          lte(salesForecasts.date, end)
        )
      )
      .groupBy(salesForecasts.menuItemId);

    // Add forecast data for items not in actual sales
    for (const row of forecastSales) {
      if (!salesMap.has(row.menuItemId)) {
        salesMap.set(row.menuItemId, Number(row.qty));
      }
    }
  }

  // Calculate ingredient usage
  const usageMap = new Map<string, number>();

  for (const [menuItemId, qtySold] of salesMap.entries()) {
    const bomLines = bomMap.get(menuItemId) || [];
    for (const line of bomLines) {
      const currentUsage = usageMap.get(line.ingredientId) || 0;
      usageMap.set(
        line.ingredientId,
        currentUsage + line.qtyPerServe * qtySold
      );
    }
  }

  return usageMap;
}

/**
 * Get on-hand stock snapshot at a specific point in time
 * For multi-venue setup: stock is venue-specific via stockMovements
 * @param ingredientId - The ingredient to check
 * @param atTime - The point in time to snapshot (default: now)
 * @returns Stock level in base units
 */
export async function windowSnapshotOnHand(params: {
  orgId: string;
  venueId: string;
  ingredientId: string;
  atTime?: Date;
}): Promise<number> {
  const { orgId, venueId, ingredientId, atTime = new Date() } = params;

  // Calculate on-hand from stockMovements up to atTime
  // Sum all movements that occurred on or before atTime
  const movements = await db
    .select({
      total: sql<string>`COALESCE(SUM(${stockMovements.qtyBase}), 0)`,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.orgId, orgId),
        eq(stockMovements.venueId, venueId),
        eq(stockMovements.ingredientId, ingredientId),
        sql`${stockMovements.occurredAt} <= ${atTime}`
      )
    );

  return Number(movements[0]?.total || 0);
}

/**
 * Sum stock movements within a time window
 * @returns Total movement qty in base units (positive for receipts, negative for usage/waste)
 */
export async function sumMovementsInWindow(params: {
  orgId: string;
  venueId: string;
  ingredientId: string;
  start: Date;
  end: Date;
  type?: string; // Optional filter by movement type (RECEIPT, WASTE, ADJUSTMENT)
}): Promise<number> {
  const { orgId, venueId, ingredientId, start, end, type } = params;

  const conditions = [
    eq(stockMovements.orgId, orgId),
    eq(stockMovements.venueId, venueId),
    eq(stockMovements.ingredientId, ingredientId),
    gte(stockMovements.occurredAt, start),
    lte(stockMovements.occurredAt, end),
  ];

  if (type) {
    conditions.push(eq(stockMovements.type, type));
  }

  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(${stockMovements.qtyBase}), 0)`,
    })
    .from(stockMovements)
    .where(and(...conditions));

  return Number(result[0]?.total || 0);
}

/**
 * Get all ingredients that have either on-hand stock or sales activity
 * Used to determine which ingredients should be included in a count session
 */
export async function getActiveIngredients(params: {
  orgId: string;
  venueId: string;
  start: Date;
  end: Date;
}): Promise<string[]> {
  const { orgId, venueId, start, end } = params;

  // Get active ingredients for this org
  const allIngredients = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(
      and(
        eq(ingredients.orgId, orgId),
        eq(ingredients.isActive, true)
      )
    );

  // Get ingredients with stock movements (have been received/used in this venue)
  const withMovements = await db
    .select({ ingredientId: stockMovements.ingredientId })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.orgId, orgId),
        eq(stockMovements.venueId, venueId)
      )
    )
    .groupBy(stockMovements.ingredientId);

  // Get ingredients with theoretical usage (have sales/forecasts)
  const theoreticalUsage = await computeTheoreticalUsage({
    orgId,
    venueId,
    start,
    end,
    useForecast: true,
  });

  // Combine: ingredients with movements OR theoretical usage
  const activeIds = new Set<string>();
  for (const ing of withMovements) {
    activeIds.add(ing.ingredientId);
  }
  for (const ingId of theoreticalUsage.keys()) {
    activeIds.add(ingId);
  }

  return Array.from(activeIds);
}
