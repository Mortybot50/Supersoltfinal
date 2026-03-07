/**
 * Window-aware guardrails that generate suggestions based on a specific date range
 */
import { db } from "@/db";
import {
  menuItems,
  recipes,
  recipeLines,
  ingredients,
  dailySales,
  salesForecasts,
  shifts,
  rosters,
  staff,
  opsSuggestions,
} from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { buildOrderGuide } from "@/lib/inventory-ordering";
import {
  TARGET_COGS_PCT,
  TARGET_LABOUR_PCT,
  MIN_MENU_OBS,
  LABOUR_TOLERANCE,
  SHORTFALL_LOOKAHEAD_DAYS,
  PRICE_NUDGE_STEP,
  PRICE_NUDGE_MAX,
} from "@/lib/guardrails-config";

export type GuardrailsInput = {
  start: Date;
  end: Date;
  period: "day" | "week" | "month";
  venueId: string;
  orgId: string;
};

export type Suggestion = {
  type: "PRICE_NUDGE" | "ORDER_SHORTFALL" | "LABOUR_TRIM" | "LABOUR_ADD";
  title: string;
  reason: string;
  impact?: string;
  payload: any;
};

/**
 * Main entry point: Run all guardrails for a window
 */
export async function runGuardrails(input: GuardrailsInput): Promise<Suggestion[]> {
  try {
    const suggestions: Suggestion[] = [];

    // Run all guardrails in parallel
    const [priceNudges, orderShortfalls, labourSuggestions] = await Promise.all([
      generatePriceNudges(input),
      generateOrderShortfalls(input),
      generateLabourSuggestions(input),
    ]);

    suggestions.push(...priceNudges, ...orderShortfalls, ...labourSuggestions);

    return suggestions;
  } catch (error) {
    console.error("Guardrails error:", error);
    // Never throw - return empty array on error
    return [];
  }
}

/**
 * PRICE_NUDGE: Suggest price increases for items with low GP%
 */
async function generatePriceNudges(input: GuardrailsInput): Promise<Suggestion[]> {
  const { orgId, venueId, start, end } = input;
  const suggestions: Suggestion[] = [];

  try {
    // Get menu items with sales in this window and their theoretical cost per serve
    // Use subquery to avoid Cartesian product between sales and recipe lines
    const itemsQuery = await db.execute(sql`
      WITH recipe_costs AS (
        SELECT 
          r.menu_item_id,
          SUM(CAST(rl.qty AS numeric) * i.cost_per_unit_cents) as cost_per_serve_cents
        FROM recipes r
        JOIN recipe_lines rl ON rl.recipe_id = r.id
        LEFT JOIN ingredients i ON i.id = rl.ingredient_id
        WHERE r.org_id = ${orgId}
        GROUP BY r.menu_item_id
      ),
      sales_summary AS (
        SELECT 
          ds.menu_item_id,
          COUNT(DISTINCT ds.sale_date) as sales_days,
          SUM(CAST(ds.quantity_sold AS numeric)) as total_qty
        FROM daily_sales ds
        WHERE ds.venue_id = ${venueId}
          AND ds.sale_date >= ${start.toISOString().split("T")[0]}
          AND ds.sale_date <= ${end.toISOString().split("T")[0]}
        GROUP BY ds.menu_item_id
      )
      SELECT 
        mi.id,
        mi.name,
        mi.price_cents,
        COALESCE(ss.sales_days, 0) as sales_days,
        COALESCE(ss.total_qty, 0) as total_qty,
        COALESCE(rc.cost_per_serve_cents, 0) as cost_per_serve_cents
      FROM menu_items mi
      LEFT JOIN sales_summary ss ON ss.menu_item_id = mi.id
      LEFT JOIN recipe_costs rc ON rc.menu_item_id = mi.id
      WHERE mi.org_id = ${orgId}
        AND mi.is_active = true
        AND COALESCE(ss.sales_days, 0) >= ${MIN_MENU_OBS}
        AND COALESCE(rc.cost_per_serve_cents, 0) > 0
    `);

    for (const item of itemsQuery.rows as any[]) {
      const price = Number(item.price_cents) / 100;
      const costPerServe = Number(item.cost_per_serve_cents) / 100;
      
      if (price === 0 || costPerServe === 0) continue;

      // Calculate GP% for this item
      const itemGp = 1 - costPerServe / price;
      const targetGp = 1 - TARGET_COGS_PCT;

      // Only suggest if GP is below target
      if (itemGp < targetGp) {
        // Calculate how many +5% steps needed to reach target (capped at +20%)
        let suggestedPrice = price;
        let steps = 0;
        const maxSteps = Math.floor(PRICE_NUDGE_MAX / PRICE_NUDGE_STEP);

        while (steps < maxSteps) {
          suggestedPrice *= 1 + PRICE_NUDGE_STEP;
          steps++;
          const newGp = 1 - costPerServe / suggestedPrice;
          if (newGp >= targetGp) break;
        }

        // Round to .00 or .50
        suggestedPrice = Math.ceil(suggestedPrice * 2) / 2;

        const increase = suggestedPrice - price;
        if (increase > 0.10) {
          // Only suggest if increase is meaningful (>$0.10)
          suggestions.push({
            type: "PRICE_NUDGE",
            title: `Price increase for ${item.name}`,
            reason: `Current GP is ${(itemGp * 100).toFixed(1)}%, target is ${(targetGp * 100).toFixed(1)}%`,
            impact: `+A$${increase.toFixed(2)} per sale`,
            payload: {
              menuItemId: item.id,
              currentPrice: price,
              suggestedPrice,
              currentGpPct: Number((itemGp * 100).toFixed(1)),
              targetGpPct: Number((targetGp * 100).toFixed(1)),
            },
          });
        }
      }
    }
  } catch (error) {
    console.error("Price nudges error:", error);
  }

  return suggestions;
}

/**
 * ORDER_SHORTFALL: Suggest ordering ingredients based on forecast
 */
async function generateOrderShortfalls(input: GuardrailsInput): Promise<Suggestion[]> {
  const { orgId, venueId, start, period } = input;
  const suggestions: Suggestion[] = [];

  try {
    // Use lookahead days for day period, otherwise use window end
    const days = period === "day" ? SHORTFALL_LOOKAHEAD_DAYS : Math.ceil((input.end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    const tomorrow = new Date(start);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endDate = new Date(tomorrow);
    endDate.setDate(endDate.getDate() + days - 1);

    const guide = await buildOrderGuide({
      orgId,
      venueId,
      range: { start: tomorrow, end: endDate },
      safetyDays: 1,
    });

    for (const group of guide.groups) {
      for (const line of group.lines) {
        if (line.packsRecommended > 0 && line.supplierId) {
          suggestions.push({
            type: "ORDER_SHORTFALL",
            title: `Order ${line.ingredientName}`,
            reason: `Shortfall: ${line.shortfallUnits.toFixed(2)} ${line.baseUnit}`,
            impact: `${line.packsRecommended} packs × A$${(line.estCost / line.packsRecommended).toFixed(2)} = A$${line.estCost.toFixed(2)}`,
            payload: {
              ingredientId: line.ingredientId,
              supplierId: line.supplierId,
              packs: line.packsRecommended,
              estCost: line.estCost,
            },
          });
        }
      }
    }
  } catch (error) {
    console.error("Order shortfalls error:", error);
  }

  return suggestions;
}

/**
 * LABOUR_TRIM/ADD: Compare scheduled labour vs sales for the window
 */
async function generateLabourSuggestions(input: GuardrailsInput): Promise<Suggestion[]> {
  const { orgId, venueId, start, end } = input;
  const suggestions: Suggestion[] = [];

  try {
    // Get actual sales in the window
    const salesData = await db
      .select({
        revenue: sql<number>`COALESCE(SUM(CAST(${dailySales.quantitySold} AS numeric) * ${menuItems.priceCents}), 0)`,
      })
      .from(dailySales)
      .leftJoin(menuItems, eq(dailySales.menuItemId, menuItems.id))
      .where(
        and(
          eq(dailySales.venueId, venueId),
          gte(dailySales.saleDate, start.toISOString().split("T")[0]),
          lte(dailySales.saleDate, end.toISOString().split("T")[0])
        )
      );

    const salesCents = salesData[0]?.revenue || 0;

    // Get scheduled labour cost in the window
    const labourData = await db
      .select({
        startTs: shifts.startTs,
        endTs: shifts.endTs,
        breakMinutes: shifts.breakMinutes,
        wageRateCentsSnapshot: shifts.wageRateCentsSnapshot,
        hourlyRateCents: staff.hourlyRateCents,
      })
      .from(shifts)
      .innerJoin(rosters, eq(shifts.rosterId, rosters.id))
      .leftJoin(staff, eq(shifts.staffId, staff.id))
      .where(
        and(
          eq(rosters.venueId, venueId),
          eq(rosters.orgId, orgId),
          gte(shifts.startTs, start),
          lte(shifts.startTs, end)
        )
      );

    let totalLabourCents = 0;
    for (const shift of labourData) {
      const shiftStart = new Date(shift.startTs);
      const shiftEnd = new Date(shift.endTs);
      const totalMinutes = (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60);
      const workedMinutes = totalMinutes - (shift.breakMinutes || 0);
      const workedHours = workedMinutes / 60;
      const rateCents = shift.wageRateCentsSnapshot || shift.hourlyRateCents || 0;
      totalLabourCents += workedHours * rateCents;
    }

    // Calculate labour %
    if (salesCents > 0) {
      const labourPct = totalLabourCents / salesCents;
      const targetPct = TARGET_LABOUR_PCT;
      const deviation = Math.abs(labourPct - targetPct);

      if (deviation > LABOUR_TOLERANCE) {
        if (labourPct > targetPct + LABOUR_TOLERANCE) {
          // Too much labour scheduled
          const excessCents = totalLabourCents - salesCents * targetPct;
          suggestions.push({
            type: "LABOUR_TRIM",
            title: "Reduce labour costs",
            reason: `Labour at ${(labourPct * 100).toFixed(1)}%, target is ${(targetPct * 100).toFixed(1)}%`,
            impact: `Save ~A$${(excessCents / 100).toFixed(2)} by reducing shifts`,
            payload: {
              currentLabourPct: Number((labourPct * 100).toFixed(1)),
              targetLabourPct: Number((targetPct * 100).toFixed(1)),
              excessCents,
            },
          });
        } else if (labourPct < targetPct - LABOUR_TOLERANCE) {
          // Not enough labour scheduled (and likely understaffed)
          const shortfallCents = salesCents * targetPct - totalLabourCents;
          suggestions.push({
            type: "LABOUR_ADD",
            title: "Add more staff shifts",
            reason: `Labour at ${(labourPct * 100).toFixed(1)}%, target is ${(targetPct * 100).toFixed(1)}%`,
            impact: `Budget ~A$${(shortfallCents / 100).toFixed(2)} for additional shifts`,
            payload: {
              currentLabourPct: Number((labourPct * 100).toFixed(1)),
              targetLabourPct: Number((targetPct * 100).toFixed(1)),
              shortfallCents,
            },
          });
        }
      }
    }
  } catch (error) {
    console.error("Labour suggestions error:", error);
  }

  return suggestions;
}
