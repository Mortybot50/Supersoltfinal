import { db } from "@/db";
import { 
  salesForecasts, 
  forecastHourProfiles, 
  menuItems, 
  labourRules, 
  rosterSuggestions,
  shifts,
  rosters
} from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";

export type WeekRange = { weekStart: Date; weekEnd: Date };

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function endOfWeek(d: Date) {
  const x = startOfWeek(d);
  x.setDate(x.getDate() + 6);
  return x;
}

export async function hourlyForecast(venueId: string, range: WeekRange) {
  // Daily units & revenue from forecasts
  const daily = await db.execute(sql`
    SELECT 
      sf.date::date as d,
      SUM(sf.qty) as units,
      SUM(sf.qty * mi.price_cents / 100.0) as revenue
    FROM sales_forecasts sf
    JOIN menu_items mi ON mi.id = sf.menu_item_id
    WHERE sf.venue_id = ${venueId}
      AND sf.date BETWEEN ${range.weekStart} AND ${range.weekEnd}
    GROUP BY d
    ORDER BY d
  `);

  // Hour weights per DOW
  const weights = await db.execute(sql`
    SELECT dow, hour, weight 
    FROM forecast_hour_profiles
    WHERE venue_id = ${venueId}
  `);

  const wMap = new Map<number, number[]>(); // dow -> [24]
  for (const r of weights.rows as any[]) {
    const a = wMap.get(r.dow) ?? Array(24).fill(0);
    a[r.hour] = Number(r.weight);
    wMap.set(r.dow, a);
  }

  // Expand to hourly {when, units, revenue}
  const out: { when: Date; units: number; revenue: number }[] = [];
  for (const row of daily.rows as any[]) {
    const date = new Date(row.d);
    const dow = date.getDay();
    const ws = wMap.get(dow) ?? Array(24).fill(1 / 24);
    
    for (let h = 0; h < 24; h++) {
      const when = new Date(date);
      when.setHours(h, 0, 0, 0);
      out.push({
        when,
        units: Number(row.units || 0) * ws[h],
        revenue: Number(row.revenue || 0) * ws[h],
      });
    }
  }
  return out;
}

type Rule = {
  role: string;
  metric: "orders" | "revenue";
  perStaffPerHour: number;
  minShiftMinutes: number;
  maxShiftMinutes: number;
  openHour: number;
  closeHour: number;
  daysMask: number;
};

export async function loadRules(venueId: string): Promise<Rule[]> {
  const rows = await db.select().from(labourRules).where(eq(labourRules.venueId, venueId));
  return rows.map((r) => ({
    role: r.role,
    metric: (r.metric as "orders" | "revenue") ?? "orders",
    perStaffPerHour: Number(r.perStaffPerHour),
    minShiftMinutes: Number(r.minShiftMinutes),
    maxShiftMinutes: Number(r.maxShiftMinutes),
    openHour: Number(r.openHour),
    closeHour: Number(r.closeHour),
    daysMask: Number(r.daysMask),
  }));
}

// Build contiguous blocks with constant headcount for a role/day
function buildBlocks(hours: { h: number; need: number }[], minShiftMin: number, closeHour: number) {
  const blocks: { startH: number; endH: number; headcount: number }[] = [];
  let cur = null as null | { startH: number; headcount: number };

  for (const slot of hours) {
    const head = Math.ceil(slot.need);
    if (!cur) {
      cur = { startH: slot.h, headcount: head };
      continue;
    }
    if (head === cur.headcount) continue;

    // Close previous block
    blocks.push({ startH: cur.startH, endH: slot.h, headcount: cur.headcount });
    cur = { startH: slot.h, headcount: head };
  }
  
  // End the final block at the last hour with data, clamped by closeHour
  if (cur && hours.length > 0) {
    const lastHour = hours[hours.length - 1].h + 1; // +1 because shift ends after last hour
    const endH = Math.min(lastHour, closeHour);
    blocks.push({ startH: cur.startH, endH, headcount: cur.headcount });
  }

  // Remove 0 headcount blocks and enforce min shift
  return blocks.filter((b) => b.headcount > 0 && (b.endH - b.startH) * 60 >= minShiftMin);
}

export async function generateRosterSuggestions({
  orgId,
  venueId,
  weekStart,
}: {
  orgId: string;
  venueId: string;
  weekStart: Date;
}) {
  const range = { weekStart: startOfWeek(weekStart), weekEnd: endOfWeek(weekStart) };
  const hrs = await hourlyForecast(venueId, range);
  const rules = await loadRules(venueId);

  // Clear previous suggestions for week
  await db.delete(rosterSuggestions).where(
    and(
      eq(rosterSuggestions.venueId, venueId),
      eq(rosterSuggestions.weekStart, range.weekStart as any)
    )
  );

  // For each day, role → compute staffing need per hour
  for (let i = 0; i < 7; i++) {
    const day = new Date(range.weekStart);
    day.setDate(day.getDate() + i);
    const dow = day.getDay();
    const dayHours = hrs.filter((x) => x.when.getDay() === dow);

    for (const r of rules) {
      // Skip day if days_mask bit is 0
      const maskBit = (r.daysMask >> dow) & 1;
      if (!maskBit) continue;

      // Find last hour with actual forecast data
      const lastForecastHour = dayHours.length > 0
        ? Math.max(...dayHours.map(x => x.when.getHours()))
        : r.openHour;
      
      // Only build series up to the minimum of lastForecastHour+1 or closeHour
      const effectiveCloseHour = Math.min(lastForecastHour + 1, r.closeHour);

      const series: { h: number; need: number }[] = [];
      for (let h = r.openHour; h < effectiveCloseHour; h++) {
        const x = dayHours.find((y) => y.when.getHours() === h) ?? { units: 0, revenue: 0 };
        const metricVal = r.metric === "orders" ? x.units : x.revenue;
        const need = r.perStaffPerHour > 0 ? metricVal / r.perStaffPerHour : 0;
        series.push({ h, need });
      }

      const blocks = buildBlocks(series, r.minShiftMinutes, effectiveCloseHour);
      for (const b of blocks) {
        const start = new Date(day);
        start.setHours(b.startH, 0, 0, 0);
        const end = new Date(day);
        end.setHours(b.endH, 0, 0, 0);

        // Store aggregated headcount; we'll explode to n shifts on import
        await db.insert(rosterSuggestions).values({
          orgId: orgId,
          venueId: venueId,
          weekStart: range.weekStart as any,
          role: r.role,
          startAt: start as any,
          endAt: end as any,
          headcount: b.headcount,
        });
      }
    }
  }
}

export async function importSuggestionsAsDraft({
  orgId,
  venueId,
  weekStart,
}: {
  orgId: string;
  venueId: string;
  weekStart: Date;
}) {
  const ws = startOfWeek(weekStart);
  const rows = await db
    .select()
    .from(rosterSuggestions)
    .where(and(eq(rosterSuggestions.venueId, venueId), eq(rosterSuggestions.weekStart, ws as any)));

  // Get or create roster for week
  let roster = await db
    .select()
    .from(rosters)
    .where(
      and(
        eq(rosters.orgId, orgId),
        eq(rosters.venueId, venueId),
        eq(rosters.weekStartDate, ws.toISOString().split("T")[0] as any)
      )
    )
    .limit(1);

  let rosterId: string;
  if (roster.length === 0) {
    const [newRoster] = await db
      .insert(rosters)
      .values({
        orgId,
        venueId,
        weekStartDate: ws.toISOString().split("T")[0] as any,
      })
      .returning();
    rosterId = newRoster.id;
  } else {
    rosterId = roster[0].id;
  }

  let created = 0;
  for (const r of rows) {
    for (let k = 0; k < Number(r.headcount); k++) {
      await db.insert(shifts).values({
        rosterId: rosterId,
        staffId: null, // Manager assigns later
        roleTitle: r.role, // Use role as roleTitle for now
        role: r.role, // Set role for categorization
        status: "draft",
        startTs: r.startAt as any,
        endTs: r.endAt as any,
        breakMinutes: 0,
      });
      created++;
    }
  }

  return { created, suggestions: rows.length };
}
