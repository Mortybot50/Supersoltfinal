import { db } from "@/db";
import { dailySales, menuItems, salesForecasts, forecastHourProfiles } from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDemandMultiplier } from "@/lib/signals";

/**
 * Ensure a default hour profile exists (peaks lunch/dinner). weights sum to 1 per DOW.
 */
export async function ensureDefaultHourProfiles(orgId: string, venueId: string) {
  const existing = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(forecastHourProfiles)
    .where(eq(forecastHourProfiles.venueId, venueId));
  
  if (Number(existing[0].c) > 0) return;

  const template = (dow: number) => {
    // 24 weights; mild lunch peak (12-14), dinner peak (18-20). Slightly higher Fri/Sat.
    const base = Array(24).fill(0.02);
    const bump = (h: number, v: number) => (base[h] += v);
    // lunch
    bump(11, 0.03);
    bump(12, 0.05);
    bump(13, 0.03);
    // dinner
    bump(18, 0.05);
    bump(19, 0.06);
    bump(20, 0.03);
    if (dow === 5) {
      bump(12, 0.01);
      bump(19, 0.02);
    } // Fri
    if (dow === 6) {
      bump(13, 0.02);
      bump(19, 0.02);
    } // Sat
    // normalize
    const s = base.reduce((a, b) => a + b, 0);
    return base.map((v) => v / s);
  };

  const rows = [];
  for (let dow = 0; dow < 7; dow++) {
    const weights = template(dow);
    for (let h = 0; h < 24; h++) {
      rows.push({
        orgId,
        venueId,
        dow,
        hour: h,
        weight: weights[h].toFixed(4),
      });
    }
  }
  await db.insert(forecastHourProfiles).values(rows);
}

/**
 * Generate daily forecasts (units) per menu_item for [start..end] using 8-week DOW weighted avg with recency trend.
 * If a menu item has < 3 matching DOW observations, fall back to simple overall avg for that item.
 */
export async function generateDailyForecast({
  orgId,
  venueId,
  start,
  end,
}: {
  orgId: string;
  venueId: string;
  start: Date;
  end: Date;
}) {
  // Fetch price list (we forecast units but need item existence)
  const items = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(eq(menuItems.orgId, orgId));

  if (items.length === 0) return;

  // 8 weeks lookback window ending yesterday (use UTC to match date parsing)
  const forecastStartStr = start.toISOString().split('T')[0];
  const [forecastYear, forecastMonth, forecastDay] = forecastStartStr.split('-').map(Number);
  const endHist = new Date(Date.UTC(forecastYear, forecastMonth - 1, forecastDay - 1)); // Yesterday
  const startHist = new Date(Date.UTC(forecastYear, forecastMonth - 1, forecastDay - 1 - (7 * 8))); // 8 weeks before yesterday

  // Pull historical daily sales
  const rows = await db
    .select({
      date: dailySales.saleDate,
      menuItemId: dailySales.menuItemId,
      qty: dailySales.quantitySold,
    })
    .from(dailySales)
    .where(
      and(
        gte(dailySales.saleDate, startHist.toISOString().split("T")[0]),
        lte(dailySales.saleDate, endHist.toISOString().split("T")[0]),
        eq(dailySales.venueId, venueId)
      )
    );

  // Organise by item -> DOW -> weekIndex (0 oldest..7 latest)
  const map = new Map<string, Map<number, number[]>>(); // item -> dow -> qty per week
  for (const it of items) {
    map.set(it.id, new Map());
  }
  const weekIndex = (d: Date) => {
    const diffDays = Math.floor((+endHist - +d) / 86_400_000);
    return Math.min(7, Math.max(0, Math.floor(diffDays / 7))); // 0..7 (0 = closest)
  };
  
  for (const r of rows) {
    const id = r.menuItemId as string;
    if (!map.has(id)) continue;
    
    // Parse date string as UTC to avoid timezone offset issues
    const dateStr = typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().split('T')[0];
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    
    const dow = d.getUTCDay(); // 0..6
    const w = weekIndex(d);
    const slot = map.get(id)!.get(dow) ?? Array(8).fill(0);
    slot[7 - w] += Number(r.qty); // oldest left, newest right (index 7 = most recent)
    map.get(id)!.set(dow, slot);
  }

  // Weighted DOW average with recency (1..8 weights for oldest..newest)
  const weights = [1, 2, 3, 4, 5, 6, 7, 8];
  const sumWeights = weights.reduce((s, v) => s + v, 0); // 36
  
  const avg = (arr: number[]) => {
    // Only use weights for weeks that have data
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] > 0) {
        weightedSum += arr[i] * weights[i];
        totalWeight += weights[i];
      }
    }
    
    return totalWeight === 0 ? 0 : weightedSum / totalWeight;
  };

  // Build records for each target day
  const out: {
    orgId: string;
    venueId: string;
    date: Date;
    menuItemId: string;
    qty: string;
  }[] = [];
  
  // Use UTC-consistent date iteration
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];
  const [startYear, startMonth, startDay] = startStr.split('-').map(Number);
  
  let currentDate = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const endDate = new Date(`${endStr}T23:59:59Z`);
  
  while (currentDate <= endDate) {
    const dow = currentDate.getUTCDay(); // 0..6
    
    // Get demand multiplier for this day (applies to all items)
    const demandMult = await getDemandMultiplier({ 
      venueId, 
      at: new Date(currentDate) 
    });
    
    for (const it of items) {
      const series = map.get(it.id)!.get(dow) ?? [];
      let baseQty = 0;

      // Count non-zero values in series
      const nonZeroCount = series.filter((v: number) => v > 0).length;
      
      // Use DOW-specific data if we have at least 2 weeks of data
      if (nonZeroCount >= 2) {
        baseQty = avg(series as number[]);
      } else if (nonZeroCount > 0) {
        // If we have SOME data for this DOW, use average of non-zero values
        const nonZero = series.filter((v: number) => v > 0);
        baseQty = nonZero.reduce((s: number, v: number) => s + v, 0) / nonZero.length;
      } else {
        // Fallback: overall avg for item if DOW has no data
        let sum = 0,
          n = 0;
        for (const [, arr] of map.get(it.id)!.entries()) {
          for (const v of arr) {
            if (v > 0) {
              sum += v;
              n++;
            }
          }
        }
        baseQty = n > 0 ? sum / n : 0;
      }

      // Apply demand signals to base forecast
      const adjustedQty = baseQty * demandMult;

      // Don't clamp small but realistic values - keep forecasts even if low
      // (Removed: if (q < 0.01) q = 0;)

      out.push({
        orgId,
        venueId,
        date: new Date(currentDate),
        menuItemId: it.id,
        qty: adjustedQty.toFixed(3),
      });
    }
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  // Replace existing window
  await db
    .delete(salesForecasts)
    .where(
      and(
        eq(salesForecasts.venueId, venueId),
        gte(salesForecasts.date, start),
        lte(salesForecasts.date, end)
      )
    );
  if (out.length) await db.insert(salesForecasts).values(out);
}
