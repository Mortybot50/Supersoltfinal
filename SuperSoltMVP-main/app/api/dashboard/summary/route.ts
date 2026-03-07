export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { 
  dailySales, 
  salesForecasts, 
  menuItems, 
  recipes, 
  recipeLines,
  ingredients,
  shifts,
  rosters,
  staff,
  venues
} from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getSessionUser, requireOrg } from "@/lib/authz";
import { getWindow, eachDay } from "@/lib/date-window";
import { ensureDefaultHourProfiles, generateDailyForecast } from "@/lib/forecasting";

export async function GET(req: Request) {
  try {
    await getSessionUser();

    const cookieStore = await cookies();
    const orgId = cookieStore.get("activeOrgId")?.value || cookieStore.get("orgId")?.value;
    const venueId = cookieStore.get("activeVenueId")?.value || cookieStore.get("venueId")?.value;

    if (!orgId || !venueId) {
      return NextResponse.json({ error: "No organization or venue selected" }, { status: 400 });
    }

    await requireOrg(orgId);

    // Validate venue belongs to org
    const venue = await db
      .select()
      .from(venues)
      .where(and(eq(venues.id, venueId), eq(venues.orgId, orgId)))
      .limit(1);
    
    if (venue.length === 0) {
      return NextResponse.json({ error: "Venue not found or access denied" }, { status: 403 });
    }

    const url = new URL(req.url);
    const period = (url.searchParams.get("period") || "week") as "day" | "week" | "month";
    const startISO = url.searchParams.get("start") || new Date().toISOString();

    const { start, end, days } = getWindow(period, startISO);
    const dayKeys = eachDay(start, end);

    // Trigger forecast generation directly (no auth issues)
    try {
      await ensureDefaultHourProfiles(orgId, venueId);
      await generateDailyForecast({ orgId, venueId, start, end });
    } catch (error) {
      console.error("Forecast generation failed:", error);
      // Continue anyway - forecasts are optional
    }

    // Parallel data fetching
    const [actualsResult, forecastsResult, prevActualsResult] = await Promise.all([
      // 1) Actuals for current window
      db
        .select({
          date: dailySales.saleDate,
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
        )
        .groupBy(dailySales.saleDate),

      // 2) Forecasts for current window
      db
        .select({
          date: salesForecasts.date,
          qty: sql<number>`COALESCE(SUM(CAST(${salesForecasts.qty} AS numeric)), 0)`,
          revenue: sql<number>`COALESCE(SUM(CAST(${salesForecasts.qty} AS numeric) * ${menuItems.priceCents}), 0)`,
        })
        .from(salesForecasts)
        .leftJoin(menuItems, eq(salesForecasts.menuItemId, menuItems.id))
        .where(
          and(
            eq(salesForecasts.venueId, venueId),
            gte(salesForecasts.date, start),
            lte(salesForecasts.date, end)
          )
        )
        .groupBy(salesForecasts.date),

      // 3) Previous window actuals for comparison
      (() => {
        const prevEnd = new Date(start);
        prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - days + 1);
        prevStart.setHours(0, 0, 0, 0);

        return db
          .select({
            date: dailySales.saleDate,
            revenue: sql<number>`COALESCE(SUM(CAST(${dailySales.quantitySold} AS numeric) * ${menuItems.priceCents}), 0)`,
          })
          .from(dailySales)
          .leftJoin(menuItems, eq(dailySales.menuItemId, menuItems.id))
          .where(
            and(
              eq(dailySales.venueId, venueId),
              gte(dailySales.saleDate, prevStart.toISOString().split("T")[0]),
              lte(dailySales.saleDate, prevEnd.toISOString().split("T")[0])
            )
          )
          .groupBy(dailySales.saleDate);
      })(),
    ]);

    // Build maps for quick lookup
    const actualByDay = new Map<string, number>();
    for (const row of actualsResult) {
      const dateKey = typeof row.date === "string" 
        ? row.date.split("T")[0] 
        : new Date(row.date).toISOString().split("T")[0];
      actualByDay.set(dateKey, Number(row.revenue));
    }

    const forecastQtyByDay = new Map<string, number>();
    const forecastCentsByDay = new Map<string, number>();
    for (const row of forecastsResult) {
      const dateKey = row.date instanceof Date
        ? row.date.toISOString().split("T")[0]
        : String(row.date).split("T")[0];
      forecastQtyByDay.set(dateKey, Number(row.qty));
      forecastCentsByDay.set(dateKey, Number(row.revenue));
    }

    // Default-fill chart days
    const chartDays = dayKeys.map((d) => ({
      date: d,
      actualCents: actualByDay.get(d) ?? 0,
      forecastCents: forecastCentsByDay.get(d) ?? 0,
      forecastQty: forecastQtyByDay.get(d) ?? 0,
    }));

    // Calculate KPIs
    const salesCents = chartDays.reduce((sum, day) => sum + day.actualCents, 0);

    // OPTIMIZATION: Run COGS, labour, and top products calculations in parallel
    if (process.env.NODE_ENV !== "production") {
      console.time("dashboard-summary-calculations");
    }

    const [cogsCents, labourCents, topProducts] = await Promise.all([
      salesCents > 0 ? calculateCOGS(venueId, orgId, start, end).catch((e) => {
        console.error("COGS calculation error:", e);
        return null;
      }) : Promise.resolve(null),
      salesCents > 0 ? calculateLabourCost(venueId, orgId, start, end).catch((e) => {
        console.error("Labour calculation error:", e);
        return null;
      }) : Promise.resolve(null),
      calculateTopProducts(venueId, orgId, start, end, days, salesCents),
    ]);

    if (process.env.NODE_ENV !== "production") {
      console.timeEnd("dashboard-summary-calculations");
    }

    const cogsPct = cogsCents !== null && salesCents > 0 ? (cogsCents / salesCents) * 100 : null;
    const labourPct = labourCents !== null && salesCents > 0 ? (labourCents / salesCents) * 100 : null;

    return NextResponse.json(
      {
        kpis: {
          salesCents,
          cogsPct,
          labourPct,
        },
        chart: {
          days: chartDays,
        },
        topProducts,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Dashboard summary error:", e);
    return NextResponse.json(
      { error: e?.message ?? "summary_error" },
      { status: e?.statusCode ?? 500 }
    );
  }
}

// Helper: Calculate theoretical COGS based on recipes (optimized with batched queries)
async function calculateCOGS(
  venueId: string,
  orgId: string,
  start: Date,
  end: Date
): Promise<number | null> {
  try {
    // Get all sales in the window with quantities
    const sales = await db
      .select({
        menuItemId: dailySales.menuItemId,
        qty: sql<number>`SUM(CAST(${dailySales.quantitySold} AS numeric))`,
      })
      .from(dailySales)
      .where(
        and(
          eq(dailySales.venueId, venueId),
          gte(dailySales.saleDate, start.toISOString().split("T")[0]),
          lte(dailySales.saleDate, end.toISOString().split("T")[0])
        )
      )
      .groupBy(dailySales.menuItemId);

    if (sales.length === 0) return null;

    const menuItemIds = sales.map((s) => s.menuItemId);

    // OPTIMIZATION: Batch fetch all recipes and recipe lines in parallel
    const [allRecipes, allRecipeLines] = await Promise.all([
      // Get all recipes for sold menu items in one query
      db
        .select({
          id: recipes.id,
          menuItemId: recipes.menuItemId,
        })
        .from(recipes)
        .where(
          and(
            eq(recipes.orgId, orgId),
            sql`${recipes.menuItemId} = ANY(${menuItemIds})`
          )
        ),

      // Get all recipe lines for those recipes in one query (with ingredients joined)
      db
        .select({
          recipeId: recipeLines.recipeId,
          ingredientId: recipeLines.ingredientId,
          qty: recipeLines.qty,
          costPerUnitCents: ingredients.costPerUnitCents,
        })
        .from(recipeLines)
        .innerJoin(recipes, eq(recipeLines.recipeId, recipes.id))
        .leftJoin(ingredients, eq(recipeLines.ingredientId, ingredients.id))
        .where(
          and(
            eq(recipes.orgId, orgId),
            sql`${recipes.menuItemId} = ANY(${menuItemIds})`
          )
        ),
    ]);

    // Build lookup maps
    const recipeByMenuItemId = new Map<string, string>(); // menuItemId -> recipeId
    for (const r of allRecipes) {
      recipeByMenuItemId.set(r.menuItemId, r.id);
    }

    const linesByRecipeId = new Map<string, typeof allRecipeLines>();
    for (const line of allRecipeLines) {
      if (!linesByRecipeId.has(line.recipeId)) {
        linesByRecipeId.set(line.recipeId, []);
      }
      linesByRecipeId.get(line.recipeId)!.push(line);
    }

    let totalCogsCents = 0;
    let hasIncompleteRecipes = false;

    // Calculate COGS using the lookup maps
    for (const sale of sales) {
      const recipeId = recipeByMenuItemId.get(sale.menuItemId);
      if (!recipeId) {
        hasIncompleteRecipes = true;
        continue;
      }

      const lines = linesByRecipeId.get(recipeId) || [];
      let recipeCostCents = 0;

      for (const line of lines) {
        if (line.ingredientId && line.costPerUnitCents) {
          recipeCostCents += Number(line.qty) * line.costPerUnitCents;
        } else {
          hasIncompleteRecipes = true;
        }
      }

      totalCogsCents += recipeCostCents * Number(sale.qty);
    }

    // Return null if we're missing critical recipe data
    return hasIncompleteRecipes ? null : totalCogsCents;
  } catch (e) {
    console.error("COGS calc error:", e);
    return null;
  }
}

// Helper: Calculate scheduled labour cost
async function calculateLabourCost(
  venueId: string,
  orgId: string,
  start: Date,
  end: Date
): Promise<number | null> {
  try {
    // Get all rosters in the period
    const startDate = start.toISOString().split("T")[0];
    const endDate = end.toISOString().split("T")[0];

    // Get all shifts in the window
    const shiftsData = await db
      .select({
        shiftId: shifts.id,
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

    if (shiftsData.length === 0) return null;

    let totalLabourCents = 0;

    for (const shift of shiftsData) {
      const shiftStart = new Date(shift.startTs);
      const shiftEnd = new Date(shift.endTs);
      const totalMinutes = (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60);
      const workedMinutes = totalMinutes - (shift.breakMinutes || 0);
      const workedHours = workedMinutes / 60;

      // Use snapshot wage if published, otherwise use current rate
      const rateCents = shift.wageRateCentsSnapshot || shift.hourlyRateCents || 0;
      totalLabourCents += workedHours * rateCents;
    }

    return totalLabourCents;
  } catch (e) {
    console.error("Labour calc error:", e);
    return null;
  }
}

// Helper: Calculate top products with comparison
async function calculateTopProducts(
  venueId: string,
  orgId: string,
  start: Date,
  end: Date,
  days: number,
  totalSalesCents: number
): Promise<Array<{ id: string; name: string; valueCents: number; pctOfSales: number; changePct: number }>> {
  try {
    // Current window product sales
    const currentProducts = await db
      .select({
        id: menuItems.id,
        name: menuItems.name,
        valueCents: sql<number>`COALESCE(SUM(CAST(${dailySales.quantitySold} AS numeric) * ${menuItems.priceCents}), 0)`,
      })
      .from(dailySales)
      .innerJoin(menuItems, eq(dailySales.menuItemId, menuItems.id))
      .where(
        and(
          eq(dailySales.venueId, venueId),
          gte(dailySales.saleDate, start.toISOString().split("T")[0]),
          lte(dailySales.saleDate, end.toISOString().split("T")[0])
        )
      )
      .groupBy(menuItems.id, menuItems.name)
      .orderBy(sql`SUM(CAST(${dailySales.quantitySold} AS numeric) * ${menuItems.priceCents}) DESC`)
      .limit(10);

    // Previous window for comparison
    const prevEnd = new Date(start);
    prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days + 1);
    prevStart.setHours(0, 0, 0, 0);

    const previousProducts = await db
      .select({
        id: menuItems.id,
        valueCents: sql<number>`COALESCE(SUM(CAST(${dailySales.quantitySold} AS numeric) * ${menuItems.priceCents}), 0)`,
      })
      .from(dailySales)
      .innerJoin(menuItems, eq(dailySales.menuItemId, menuItems.id))
      .where(
        and(
          eq(dailySales.venueId, venueId),
          gte(dailySales.saleDate, prevStart.toISOString().split("T")[0]),
          lte(dailySales.saleDate, prevEnd.toISOString().split("T")[0])
        )
      )
      .groupBy(menuItems.id);

    // Build previous window map
    const prevMap = new Map<string, number>();
    for (const prod of previousProducts) {
      prevMap.set(prod.id, Number(prod.valueCents));
    }

    // Calculate change %
    return currentProducts.map((prod) => {
      const currentValue = Number(prod.valueCents);
      const prevValue = prevMap.get(prod.id) || 0;
      const changePct = prevValue > 0 
        ? ((currentValue - prevValue) / prevValue) * 100 
        : currentValue > 0 ? 100 : 0;

      return {
        id: prod.id,
        name: prod.name,
        valueCents: currentValue,
        pctOfSales: totalSalesCents > 0 ? (currentValue / totalSalesCents) * 100 : 0,
        changePct,
      };
    });
  } catch (e) {
    console.error("Top products calc error:", e);
    return [];
  }
}
