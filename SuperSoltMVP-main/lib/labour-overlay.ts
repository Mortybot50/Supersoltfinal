import { db } from "@/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { shifts, rosters, staff, labourRules, salesForecasts, forecastHourProfiles, menuItems } from "@/db/schema";

/**
 * Labour Overlay - Calculate hourly coverage, cost, and labour % vs forecast
 * Used to visualize staffing efficiency and identify over/under-staffed periods
 */

export interface LabourOverlayHour {
  date: string; // YYYY-MM-DD
  hour: number; // 0-23
  headcountByRole: Record<string, number>;
  scheduledCostCents: number;
  forecastRevenueCents: number;
  labourPct: number;
  targetPct: number;
  deficitByRole: Record<string, number>; // negative = over-staffed, positive = under-staffed
}

export interface LabourOverlaySummary {
  totalScheduledCostCents: number;
  totalForecastRevenueCents: number;
  weekLabourPct: number;
  weekTargetPct: number;
}

export interface LabourOverlayResult {
  hours: LabourOverlayHour[];
  summary: LabourOverlaySummary;
}

interface ShiftSegment {
  date: string;
  hour: number;
  role: string;
  staffCount: number;
  costCents: number;
  wageRateCents: number;
}

/**
 * Compute labour overlay for a given week
 */
export async function computeLabourOverlay({
  orgId,
  venueId,
  weekStart, // YYYY-MM-DD (Monday)
}: {
  orgId: string;
  venueId: string;
  weekStart: string;
}): Promise<LabourOverlayResult> {
  // Get week end (Sunday)
  const weekStartDate = new Date(weekStart + "T00:00:00Z");
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
  const weekEnd = weekEndDate.toISOString().split("T")[0];

  // 1. Get labour rules for venue (target %, open/close hours)
  const rules = await db
    .select()
    .from(labourRules)
    .where(and(eq(labourRules.orgId, orgId), eq(labourRules.venueId, venueId)))
    .execute();

  if (rules.length === 0) {
    // No rules configured, return empty overlay
    return {
      hours: [],
      summary: {
        totalScheduledCostCents: 0,
        totalForecastRevenueCents: 0,
        weekLabourPct: 0,
        weekTargetPct: 0,
      },
    };
  }

  // Get default open/close hours and target %
  const defaultRule = rules[0];
  const openHour = defaultRule.openHour || 9;
  const closeHour = defaultRule.closeHour || 22;
  const targetLabourPct = parseFloat(defaultRule.targetLabourPct || "22.0");

  // Build role-specific rules map
  const rulesByRole = new Map<string, typeof defaultRule>();
  for (const rule of rules) {
    rulesByRole.set(rule.role, rule);
  }

  // 2. Get all shifts for the week (DRAFT + PUBLISHED)
  const weekShifts = await db
    .select({
      id: shifts.id,
      rosterId: shifts.rosterId,
      staffId: shifts.staffId,
      role: shifts.role,
      roleTitle: shifts.roleTitle,
      startTs: shifts.startTs,
      endTs: shifts.endTs,
      breakMinutes: shifts.breakMinutes,
      wageRateCentsSnapshot: shifts.wageRateCentsSnapshot,
      status: shifts.status,
      weekStartDate: rosters.weekStartDate,
      staffHourlyRateCents: staff.hourlyRateCents,
    })
    .from(shifts)
    .innerJoin(rosters, eq(rosters.id, shifts.rosterId))
    .leftJoin(staff, eq(staff.id, shifts.staffId))
    .where(
      and(
        eq(rosters.orgId, orgId),
        eq(rosters.venueId, venueId),
        eq(rosters.weekStartDate, weekStart)
      )
    )
    .execute();

  // 3. Break shifts into hourly segments
  const hourlySegments: ShiftSegment[] = [];

  for (const shift of weekShifts) {
    const startTs = new Date(shift.startTs);
    const endTs = new Date(shift.endTs);
    const role = shift.role || shift.roleTitle || "Unknown";

    // Calculate wage rate (use snapshot if available, otherwise staff rate)
    const wageRateCents = shift.wageRateCentsSnapshot || shift.staffHourlyRateCents || 0;

    // Break shift into hour segments
    let currentTs = new Date(startTs);
    while (currentTs < endTs) {
      const date = currentTs.toISOString().split("T")[0];
      const hour = currentTs.getUTCHours();
      const nextHour = new Date(currentTs);
      nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);

      const segmentEnd = nextHour > endTs ? endTs : nextHour;
      const durationMs = segmentEnd.getTime() - currentTs.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);

      hourlySegments.push({
        date,
        hour,
        role,
        staffCount: 1,
        costCents: Math.round(wageRateCents * durationHours),
        wageRateCents,
      });

      currentTs = segmentEnd;
    }
  }

  // 4. Get forecast revenue for the week
  const weekForecasts = await db
    .select({
      date: salesForecasts.date,
      menuItemId: salesForecasts.menuItemId,
      qty: salesForecasts.qty,
      priceCents: menuItems.priceCents,
    })
    .from(salesForecasts)
    .innerJoin(menuItems, eq(menuItems.id, salesForecasts.menuItemId))
    .where(
      and(
        eq(salesForecasts.orgId, orgId),
        eq(salesForecasts.venueId, venueId),
        gte(salesForecasts.date, new Date(weekStart + "T00:00:00Z")),
        lte(salesForecasts.date, new Date(weekEnd + "T23:59:59Z"))
      )
    )
    .execute();

  // Get hour profiles for distributing daily revenue
  const hourProfiles = await db
    .select()
    .from(forecastHourProfiles)
    .where(and(eq(forecastHourProfiles.orgId, orgId), eq(forecastHourProfiles.venueId, venueId)))
    .execute();

  // Build hour profile map: dow -> hour -> weight
  const profileMap = new Map<number, Map<number, number>>();
  for (const profile of hourProfiles) {
    if (!profileMap.has(profile.dow)) {
      profileMap.set(profile.dow, new Map());
    }
    profileMap.get(profile.dow)!.set(profile.hour, parseFloat(profile.weight.toString()));
  }

  // Calculate daily forecast revenue
  const dailyRevenue = new Map<string, number>();
  for (const forecast of weekForecasts) {
    const date = forecast.date.toISOString().split("T")[0];
    const revenue = Math.round(parseFloat(forecast.qty.toString()) * forecast.priceCents);
    dailyRevenue.set(date, (dailyRevenue.get(date) || 0) + revenue);
  }

  // 5. Build hourly grid (7 days × operating hours)
  const hourlyGrid = new Map<string, LabourOverlayHour>();

  // Initialize grid for all operating hours
  for (let day = 0; day < 7; day++) {
    const currentDate = new Date(weekStartDate);
    currentDate.setUTCDate(currentDate.getUTCDate() + day);
    const dateStr = currentDate.toISOString().split("T")[0];
    const dow = currentDate.getUTCDay(); // 0 = Sunday, 6 = Saturday

    for (let hour = openHour; hour <= closeHour; hour++) {
      const key = `${dateStr}-${hour}`;

      // Get hourly forecast revenue (distribute daily revenue by hour profile)
      const dayRevenue = dailyRevenue.get(dateStr) || 0;
      const hourProfile = profileMap.get(dow)?.get(hour) || 0;
      const hourRevenue = Math.round(dayRevenue * hourProfile);

      hourlyGrid.set(key, {
        date: dateStr,
        hour,
        headcountByRole: {},
        scheduledCostCents: 0,
        forecastRevenueCents: hourRevenue,
        labourPct: 0,
        targetPct: targetLabourPct,
        deficitByRole: {},
      });
    }
  }

  // 6. Aggregate shift segments into hourly grid
  for (const segment of hourlySegments) {
    const key = `${segment.date}-${segment.hour}`;
    const cell = hourlyGrid.get(key);
    if (!cell) continue;

    // Add headcount by role
    cell.headcountByRole[segment.role] = (cell.headcountByRole[segment.role] || 0) + segment.staffCount;

    // Add cost
    cell.scheduledCostCents += segment.costCents;
  }

  // 7. Calculate labour % and deficits
  let totalScheduledCostCents = 0;
  let totalForecastRevenueCents = 0;

  for (const cell of hourlyGrid.values()) {
    // Calculate labour %
    if (cell.forecastRevenueCents > 0) {
      cell.labourPct = (cell.scheduledCostCents / cell.forecastRevenueCents) * 100;
    } else {
      cell.labourPct = 0;
    }

    // Calculate deficits by role (simplified: based on target headcount from rules)
    for (const [role, rule] of rulesByRole.entries()) {
      const currentHeadcount = cell.headcountByRole[role] || 0;
      const targetHeadcount = 0; // TODO: Calculate from forecast orders/revenue and rule.perStaffPerHour

      // For now, deficit is just a placeholder (0 = on target)
      cell.deficitByRole[role] = targetHeadcount - currentHeadcount;
    }

    totalScheduledCostCents += cell.scheduledCostCents;
    totalForecastRevenueCents += cell.forecastRevenueCents;
  }

  // 8. Build result
  const hours = Array.from(hourlyGrid.values()).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.hour - b.hour;
  });

  const weekLabourPct =
    totalForecastRevenueCents > 0 ? (totalScheduledCostCents / totalForecastRevenueCents) * 100 : 0;

  return {
    hours,
    summary: {
      totalScheduledCostCents,
      totalForecastRevenueCents,
      weekLabourPct,
      weekTargetPct: targetLabourPct,
    },
  };
}
