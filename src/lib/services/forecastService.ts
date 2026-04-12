/**
 * Sales Forecast Service
 *
 * Predicts future daily revenue based on historical order data.
 * Uses day-of-week seasonality with simple averaging (weeks 1-4)
 * or weighted moving average (weeks 5+).
 *
 * All amounts are in CENTS (matching the orders table).
 */

import { supabase } from "@/integrations/supabase/client";
import {
  startOfDay,
  endOfDay,
  subWeeks,
  addDays,
  getDay,
  format,
  differenceInCalendarWeeks,
  startOfWeek,
  isBefore,
  isSameDay,
} from "date-fns";

// ─── Types ──────────────────────────────────────────

export type ConfidenceLevel = "low" | "medium" | "high";
export type ForecastMethod =
  | "simple_average"
  | "weighted_moving_average"
  | "insufficient_data";

export interface DailyForecast {
  date: string; // ISO date string (YYYY-MM-DD)
  dayOfWeek: number; // 0=Sun, 1=Mon, ...
  dayLabel: string; // e.g. "Monday"
  forecastedRevenue: number; // in cents
  confidence: ConfidenceLevel;
  dataPointCount: number; // how many same-day data points were used
  method: ForecastMethod;
  actualRevenue: number | null; // null if day hasn't happened yet; cents if it has
}

export interface AccuracyReport {
  weekStartDate: string;
  days: Array<{
    date: string;
    dayLabel: string;
    forecasted: number; // cents
    actual: number; // cents
    absoluteError: number; // cents
    percentageError: number; // %
  }>;
  mape: number; // Mean Absolute Percentage Error (%)
  totalForecasted: number; // cents
  totalActual: number; // cents
  overallVariance: number; // % (positive = over-forecasted)
}

export interface WeekSummary {
  weekStartDate: string;
  mape: number;
}

interface DailyAggregate {
  date: string;
  totalNetCents: number;
  orderCount: number;
}

// ─── Day names ──────────────────────────────────────

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// ─── Internal helpers ───────────────────────────────

/**
 * Fetch daily revenue aggregates for a venue within a date range.
 * Groups by calendar date, summing net_amount (cents) for non-void orders.
 * Refund orders subtract from the daily total.
 */
async function fetchDailyRevenue(
  venueId: string,
  from: Date,
  to: Date,
): Promise<DailyAggregate[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("order_datetime, net_amount, is_void, is_refund")
    .eq("venue_id", venueId)
    .gte("order_datetime", from.toISOString())
    .lte("order_datetime", to.toISOString())
    .order("order_datetime");

  if (error) throw new Error(`Failed to fetch orders: ${error.message}`);

  const byDate = new Map<string, { total: number; count: number }>();

  for (const order of data || []) {
    if (order.is_void) continue;
    const dateKey = format(new Date(order.order_datetime), "yyyy-MM-dd");
    const entry = byDate.get(dateKey) || { total: 0, count: 0 };
    if (order.is_refund) {
      entry.total -= Math.abs(order.net_amount);
    } else {
      entry.total += order.net_amount;
      entry.count += 1;
    }
    byDate.set(dateKey, entry);
  }

  return Array.from(byDate.entries()).map(([date, { total, count }]) => ({
    date,
    totalNetCents: Math.max(total, 0),
    orderCount: count,
  }));
}

/**
 * Group daily aggregates by day of week (0=Sun..6=Sat).
 */
function groupByDayOfWeek(dailies: DailyAggregate[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const d of dailies) {
    const dow = getDay(new Date(d.date));
    const arr = map.get(dow) || [];
    arr.push(d.totalNetCents);
    map.set(dow, arr);
  }
  return map;
}

function getConfidence(dataPoints: number): ConfidenceLevel {
  if (dataPoints < 4) return "low";
  if (dataPoints < 8) return "medium";
  return "high";
}

function simpleAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Weighted moving average — more recent values weighted higher.
 * Values should be ordered oldest → newest.
 * Uses linearly increasing weights: weight[i] = i + 1.
 */
function weightedMovingAverage(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return Math.round(values[0]);

  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < values.length; i++) {
    const weight = i + 1;
    weightedSum += values[i] * weight;
    weightTotal += weight;
  }
  return Math.round(weightedSum / weightTotal);
}

async function getDataWeeksCount(venueId: string): Promise<number> {
  const { data, error } = await supabase
    .from("orders")
    .select("order_datetime")
    .eq("venue_id", venueId)
    .eq("is_void", false)
    .order("order_datetime", { ascending: true })
    .limit(1);

  if (error || !data || data.length === 0) return 0;

  const earliest = new Date(data[0].order_datetime);
  return differenceInCalendarWeeks(new Date(), earliest, { weekStartsOn: 1 });
}

// ─── Public API ─────────────────────────────────────

/**
 * Get forecast for a single day.
 */
export async function getForecastForDay(
  venueId: string,
  date: Date,
): Promise<DailyForecast> {
  const weeksAvailable = await getDataWeeksCount(venueId);
  const lookbackWeeks = Math.min(weeksAvailable, 12);

  if (lookbackWeeks === 0) {
    return {
      date: format(date, "yyyy-MM-dd"),
      dayOfWeek: getDay(date),
      dayLabel: DAY_LABELS[getDay(date)],
      forecastedRevenue: 0,
      confidence: "low",
      dataPointCount: 0,
      method: "insufficient_data",
      actualRevenue: null,
    };
  }

  const from = startOfDay(subWeeks(date, lookbackWeeks));
  const to = endOfDay(date);

  const dailies = await fetchDailyRevenue(venueId, from, to);
  const byDow = groupByDayOfWeek(dailies);
  const targetDow = getDay(date);
  const sameDayValues = byDow.get(targetDow) || [];

  const useWeighted = weeksAvailable >= 5;
  const method: ForecastMethod =
    sameDayValues.length === 0
      ? "insufficient_data"
      : useWeighted
        ? "weighted_moving_average"
        : "simple_average";

  const forecastedRevenue =
    sameDayValues.length === 0
      ? 0
      : useWeighted
        ? weightedMovingAverage(sameDayValues)
        : simpleAverage(sameDayValues);

  // Check if we have actuals for this day
  let actualRevenue: number | null = null;
  const now = new Date();
  if (isBefore(date, startOfDay(now)) || isSameDay(date, now)) {
    const dayActuals = await fetchDailyRevenue(
      venueId,
      startOfDay(date),
      endOfDay(date),
    );
    if (dayActuals.length > 0) {
      actualRevenue = dayActuals[0].totalNetCents;
    } else if (isBefore(date, startOfDay(now))) {
      actualRevenue = 0;
    }
  }

  return {
    date: format(date, "yyyy-MM-dd"),
    dayOfWeek: targetDow,
    dayLabel: DAY_LABELS[targetDow],
    forecastedRevenue,
    confidence: getConfidence(sameDayValues.length),
    dataPointCount: sameDayValues.length,
    method,
    actualRevenue,
  };
}

/**
 * Get forecast for a full week (7 days starting from weekStartDate).
 */
export async function getForecastForWeek(
  venueId: string,
  weekStartDate: Date,
): Promise<DailyForecast[]> {
  const weeksAvailable = await getDataWeeksCount(venueId);
  const lookbackWeeks = Math.min(weeksAvailable, 12);

  if (lookbackWeeks === 0) {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStartDate, i);
      return {
        date: format(date, "yyyy-MM-dd"),
        dayOfWeek: getDay(date),
        dayLabel: DAY_LABELS[getDay(date)],
        forecastedRevenue: 0,
        confidence: "low" as ConfidenceLevel,
        dataPointCount: 0,
        method: "insufficient_data" as ForecastMethod,
        actualRevenue: null,
      };
    });
  }

  // Fetch all historical data in one query
  const histFrom = startOfDay(subWeeks(weekStartDate, lookbackWeeks));
  const histTo = endOfDay(weekStartDate);
  const historicalDailies = await fetchDailyRevenue(venueId, histFrom, histTo);
  const byDow = groupByDayOfWeek(historicalDailies);

  // Fetch actuals for the forecast week (if any days have passed)
  const now = new Date();
  const weekEnd = endOfDay(addDays(weekStartDate, 6));
  const actualsTo = isBefore(now, weekEnd) ? endOfDay(now) : weekEnd;
  const actuals = isBefore(weekStartDate, now)
    ? await fetchDailyRevenue(venueId, startOfDay(weekStartDate), actualsTo)
    : [];
  const actualsByDate = new Map(actuals.map((a) => [a.date, a.totalNetCents]));

  const useWeighted = weeksAvailable >= 5;

  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStartDate, i);
    const dow = getDay(date);
    const dateStr = format(date, "yyyy-MM-dd");
    const sameDayValues = byDow.get(dow) || [];

    const method: ForecastMethod =
      sameDayValues.length === 0
        ? "insufficient_data"
        : useWeighted
          ? "weighted_moving_average"
          : "simple_average";

    const forecastedRevenue =
      sameDayValues.length === 0
        ? 0
        : useWeighted
          ? weightedMovingAverage(sameDayValues)
          : simpleAverage(sameDayValues);

    let actualRevenue: number | null = null;
    if (actualsByDate.has(dateStr)) {
      actualRevenue = actualsByDate.get(dateStr) ?? 0;
    } else if (isBefore(date, startOfDay(now))) {
      actualRevenue = 0;
    }

    return {
      date: dateStr,
      dayOfWeek: dow,
      dayLabel: DAY_LABELS[dow],
      forecastedRevenue,
      confidence: getConfidence(sameDayValues.length),
      dataPointCount: sameDayValues.length,
      method,
      actualRevenue,
    };
  });
}

/**
 * Get the historical average revenue for a specific day of the week.
 * Returns amount in cents.
 */
export async function getHistoricalDayAverage(
  venueId: string,
  dayOfWeek: number,
  weeksBack: number = 8,
): Promise<number> {
  const to = endOfDay(new Date());
  const from = startOfDay(subWeeks(to, weeksBack));
  const dailies = await fetchDailyRevenue(venueId, from, to);
  const byDow = groupByDayOfWeek(dailies);
  const values = byDow.get(dayOfWeek) || [];
  return simpleAverage(values);
}

/**
 * Compare forecasted vs actual revenue for a past week.
 */
export async function getForecastAccuracy(
  venueId: string,
  weekStartDate: Date,
): Promise<AccuracyReport> {
  const weeksBeforeTarget = differenceInCalendarWeeks(
    weekStartDate,
    new Date(0),
    { weekStartsOn: 1 },
  );
  const lookbackWeeks = Math.min(12, Math.max(0, weeksBeforeTarget));

  const histFrom = startOfDay(subWeeks(weekStartDate, lookbackWeeks));
  const histTo = endOfDay(subWeeks(weekStartDate, 1));
  const historicalDailies = await fetchDailyRevenue(venueId, histFrom, histTo);
  const byDow = groupByDayOfWeek(historicalDailies);

  const weekEnd = endOfDay(addDays(weekStartDate, 6));
  const actuals = await fetchDailyRevenue(
    venueId,
    startOfDay(weekStartDate),
    weekEnd,
  );
  const actualsByDate = new Map(actuals.map((a) => [a.date, a.totalNetCents]));

  const useWeighted = lookbackWeeks >= 5;

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStartDate, i);
    const dow = getDay(date);
    const dateStr = format(date, "yyyy-MM-dd");
    const sameDayValues = byDow.get(dow) || [];

    const forecasted =
      sameDayValues.length === 0
        ? 0
        : useWeighted
          ? weightedMovingAverage(sameDayValues)
          : simpleAverage(sameDayValues);

    const actual = actualsByDate.get(dateStr) ?? 0;
    const absoluteError = Math.abs(forecasted - actual);
    const percentageError =
      actual > 0 ? (absoluteError / actual) * 100 : forecasted > 0 ? 100 : 0;

    return {
      date: dateStr,
      dayLabel: DAY_LABELS[dow],
      forecasted,
      actual,
      absoluteError,
      percentageError,
    };
  });

  const totalForecasted = days.reduce((s, d) => s + d.forecasted, 0);
  const totalActual = days.reduce((s, d) => s + d.actual, 0);
  const daysWithActual = days.filter((d) => d.actual > 0);
  const mape =
    daysWithActual.length > 0
      ? daysWithActual.reduce((s, d) => s + d.percentageError, 0) /
        daysWithActual.length
      : 0;

  const overallVariance =
    totalActual > 0 ? ((totalForecasted - totalActual) / totalActual) * 100 : 0;

  return {
    weekStartDate: format(weekStartDate, "yyyy-MM-dd"),
    days,
    mape,
    totalForecasted,
    totalActual,
    overallVariance,
  };
}

/**
 * Get MAPE trend across recent weeks.
 */
export async function getForecastAccuracyTrend(
  venueId: string,
  weeksBack: number = 4,
): Promise<WeekSummary[]> {
  const now = new Date();
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const results: WeekSummary[] = [];

  for (let i = weeksBack; i >= 1; i--) {
    const ws = subWeeks(currentWeekStart, i);
    try {
      const report = await getForecastAccuracy(venueId, ws);
      if (report.totalActual > 0) {
        results.push({
          weekStartDate: report.weekStartDate,
          mape: Math.round(report.mape * 10) / 10,
        });
      }
    } catch {
      // Skip weeks where we can't calculate
    }
  }

  return results;
}

/**
 * Get the number of weeks of historical data available.
 */
export async function getWeeksOfData(venueId: string): Promise<number> {
  return getDataWeeksCount(venueId);
}
