import { db } from "@/db";
import {
  menuItems,
  recipes,
  recipeLines,
  ingredients,
  opsSuggestions,
  rosterSuggestions,
  shifts,
  rosters,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { buildOrderGuide } from "@/lib/inventory-ordering";
import { GUARDRAILS_CONFIG } from "@/lib/guardrails-config";

type SuggestionInput = {
  orgId: string;
  venueId: string;
  type: string;
  title: string;
  reason?: string;
  impact?: string;
  payload: any;
};

/**
 * De-duplicate: mark previous NEW suggestions of same type+key as IGNORED
 */
async function deduplicateSuggestion(
  venueId: string,
  type: string,
  keyField: string,
  keyValue: string
) {
  // Mark existing NEW suggestions with same key as IGNORED
  await db.execute(sql`
    UPDATE ops_suggestions
    SET status = 'IGNORED', decided_at = NOW()
    WHERE venue_id = ${venueId}
      AND type = ${type}
      AND status = 'NEW'
      AND payload->>${keyField} = ${keyValue}
  `);
}

/**
 * PRICE_NUDGE: For menu items with GP% below target, suggest new price
 */
export async function generatePriceNudges(orgId: string, venueId: string): Promise<number> {
  const TARGET_COGS_PCT = GUARDRAILS_CONFIG.TARGET_COGS_PCT;
  const TARGET_GP_PCT = (1 - TARGET_COGS_PCT) * 100;

  // Get menu items with theoretical cost
  const items = await db.execute(sql`
    SELECT 
      mi.id,
      mi.name,
      mi.price_cents,
      SUM(
        CASE 
          WHEN rl.ingredient_id IS NOT NULL THEN rl.qty * i.unit_price_cents / 100.0
          ELSE 0
        END
      ) as theoretical_cost_cents
    FROM menu_items mi
    JOIN recipes r ON r.menu_item_id = mi.id
    JOIN recipe_lines rl ON rl.recipe_id = r.id
    LEFT JOIN ingredients i ON i.id = rl.ingredient_id
    WHERE mi.org_id = ${orgId} AND mi.venue_id = ${venueId}
    GROUP BY mi.id, mi.name, mi.price_cents
    HAVING SUM(
      CASE 
        WHEN rl.ingredient_id IS NOT NULL THEN rl.qty * i.unit_price_cents / 100.0
        ELSE 0
      END
    ) > 0
  `);

  let count = 0;
  for (const item of items.rows as any[]) {
    const price = Number(item.price_cents) / 100;
    const cost = Number(item.theoretical_cost_cents) / 100;
    const gpPct = ((price - cost) / price) * 100;

    if (gpPct < TARGET_GP_PCT) {
      // Calculate suggested price to hit target GP%
      const suggestedPrice = cost / (1 - TARGET_COGS_PCT);
      
      // Round to .00 or .50
      const rounded = Math.ceil(suggestedPrice * 2) / 2;

      // Deduplicate
      await deduplicateSuggestion(venueId, "PRICE_NUDGE", "menuItemId", item.id);

      // Insert suggestion
      await db.insert(opsSuggestions).values({
        orgId,
        venueId,
        type: "PRICE_NUDGE",
        status: "NEW",
        title: `Price increase for ${item.name}`,
        reason: `Current GP is ${gpPct.toFixed(1)}%, target is ${TARGET_GP_PCT.toFixed(1)}%`,
        impact: `+$${(rounded - price).toFixed(2)} per sale`,
        payload: {
          menuItemId: item.id,
          currentPrice: price,
          suggestedPrice: rounded,
          gpPct: Number(gpPct.toFixed(1)),
          targetGpPct: Number(TARGET_GP_PCT.toFixed(1)),
        },
      });
      count++;
    }
  }

  return count;
}

/**
 * ORDER_SHORTFALL: From order guide, suggest creating purchases for shortfall items
 */
export async function generateOrderShortfalls(
  orgId: string,
  venueId: string,
  days: number = 7
): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const endDate = new Date(tomorrow);
  endDate.setDate(endDate.getDate() + days - 1);

  const guide = await buildOrderGuide({
    orgId,
    venueId,
    range: { start: tomorrow, end: endDate },
    safetyDays: GUARDRAILS_CONFIG.ORDER_GUIDE_SAFETY_DAYS,
  });

  let count = 0;
  for (const group of guide.groups) {
    for (const line of group.lines) {
      if (line.packsRecommended > 0 && line.supplierId) {
        // Deduplicate
        await deduplicateSuggestion(venueId, "ORDER_SHORTFALL", "ingredientId", line.ingredientId);

        // Insert suggestion
        await db.insert(opsSuggestions).values({
          orgId,
          venueId,
          type: "ORDER_SHORTFALL",
          status: "NEW",
          title: `Order ${line.ingredientName}`,
          reason: `Shortfall: ${line.shortfallUnits.toFixed(2)} ${line.baseUnit}`,
          impact: `${line.packsRecommended} packs × $${(line.estCost / line.packsRecommended).toFixed(2)} = $${line.estCost.toFixed(2)}`,
          payload: {
            ingredientId: line.ingredientId,
            supplierId: line.supplierId,
            packs: line.packsRecommended,
            estCost: line.estCost,
          },
        });
        count++;
      }
    }
  }

  return count;
}

/**
 * LABOUR_TRIM/ADD: Compare scheduled vs suggested headcount per hour
 */
export async function generateLabourAdjustments(
  orgId: string,
  venueId: string,
  weekStart: Date
): Promise<number> {
  const THRESHOLD = GUARDRAILS_CONFIG.LABOUR_DEVIATION_THRESHOLD;

  // Get roster suggestions for the week
  const suggestions = await db
    .select()
    .from(rosterSuggestions)
    .where(and(eq(rosterSuggestions.venueId, venueId), eq(rosterSuggestions.weekStart, weekStart as any)));

  // Get current roster and shifts for the week
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const roster = await db
    .select()
    .from(rosters)
    .where(
      and(
        eq(rosters.orgId, orgId),
        eq(rosters.venueId, venueId),
        eq(rosters.weekStartDate, weekStartStr as any)
      )
    )
    .limit(1);

  if (roster.length === 0) {
    // No roster yet, suggest adding all suggested shifts
    for (const sug of suggestions) {
      await deduplicateSuggestion(
        venueId,
        "LABOUR_ADD",
        "role",
        `${sug.role}_${sug.startAt}_${sug.endAt}`
      );

      await db.insert(opsSuggestions).values({
        orgId,
        venueId,
        type: "LABOUR_ADD",
        status: "NEW",
        title: `Add ${sug.headcount} ${sug.role} shift${sug.headcount > 1 ? "s" : ""}`,
        reason: `Forecast suggests ${sug.headcount} staff needed`,
        impact: `${new Date(sug.startAt).toLocaleTimeString()} - ${new Date(sug.endAt).toLocaleTimeString()}`,
        payload: {
          role: sug.role,
          startAt: sug.startAt,
          endAt: sug.endAt,
          deltaHeadcount: sug.headcount,
        },
      });
    }
    return suggestions.length;
  }

  // Compare scheduled vs suggested by hour and role
  const rosterId = roster[0].id;
  const scheduledShifts = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.rosterId, rosterId)));

  let count = 0;

  // Group suggestions by role and hour blocks
  for (const sug of suggestions) {
    const sugStart = new Date(sug.startAt);
    const sugEnd = new Date(sug.endAt);
    const sugHeadcount = Number(sug.headcount);

    // Count scheduled shifts that overlap this time block for this role
    const overlapping = scheduledShifts.filter((shift) => {
      if (shift.role !== sug.role) return false;
      const shiftStart = new Date(shift.startTs);
      const shiftEnd = new Date(shift.endTs);
      // Check overlap: shift starts before sug ends AND shift ends after sug starts
      return shiftStart < sugEnd && shiftEnd > sugStart;
    });

    const scheduledCount = overlapping.length;
    const delta = scheduledCount - sugHeadcount;
    const deviation = Math.abs(delta) / Math.max(sugHeadcount, 1);

    if (deviation > THRESHOLD) {
      if (delta > 0) {
        // TRIM: too many staff scheduled
        await deduplicateSuggestion(
          venueId,
          "LABOUR_TRIM",
          "role",
          `${sug.role}_${sug.startAt}_${sug.endAt}`
        );

        await db.insert(opsSuggestions).values({
          orgId,
          venueId,
          type: "LABOUR_TRIM",
          status: "NEW",
          title: `Reduce ${sug.role} staffing`,
          reason: `${scheduledCount} scheduled vs ${sugHeadcount} needed`,
          impact: `Consider removing ${Math.abs(delta)} shift${Math.abs(delta) > 1 ? "s" : ""}`,
          payload: {
            role: sug.role,
            startAt: sug.startAt,
            endAt: sug.endAt,
            deltaHeadcount: -Math.abs(delta),
          },
        });
        count++;
      } else {
        // ADD: not enough staff scheduled
        await deduplicateSuggestion(
          venueId,
          "LABOUR_ADD",
          "role",
          `${sug.role}_${sug.startAt}_${sug.endAt}`
        );

        await db.insert(opsSuggestions).values({
          orgId,
          venueId,
          type: "LABOUR_ADD",
          status: "NEW",
          title: `Add ${sug.role} staffing`,
          reason: `${scheduledCount} scheduled vs ${sugHeadcount} needed`,
          impact: `Consider adding ${Math.abs(delta)} shift${Math.abs(delta) > 1 ? "s" : ""}`,
          payload: {
            role: sug.role,
            startAt: sug.startAt,
            endAt: sug.endAt,
            deltaHeadcount: Math.abs(delta),
          },
        });
        count++;
      }
    }
  }

  return count;
}

/**
 * Run all guardrails and generate suggestions
 */
export async function generateAllSuggestions({
  orgId,
  venueId,
  days = 7,
}: {
  orgId: string;
  venueId: string;
  days?: number;
}): Promise<{ priceNudges: number; orderShortfalls: number; labourAdjustments: number }> {
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diff);

  const [priceNudges, orderShortfalls, labourAdjustments] = await Promise.all([
    generatePriceNudges(orgId, venueId),
    generateOrderShortfalls(orgId, venueId, days),
    generateLabourAdjustments(orgId, venueId, weekStart),
  ]);

  return { priceNudges, orderShortfalls, labourAdjustments };
}
