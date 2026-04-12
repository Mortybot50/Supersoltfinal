import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { TrendingUp, AlertCircle } from "lucide-react";
import { useWeeklyForecast, useWeeksOfData } from "@/lib/hooks/useForecast";
import type {
  ConfidenceLevel,
  DailyForecast,
} from "@/lib/services/forecastService";

// ─── Helpers ────────────────────────────────────────

const fmtDollars = (cents: number) =>
  "$" +
  (cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const fmtDollarsDecimal = (cents: number) =>
  "$" +
  (cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const confidenceColors: Record<ConfidenceLevel, string> = {
  low: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
  medium:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  high: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
};

const FORECAST_COLOR = "#0d9488";
const ACTUAL_COLOR = "#3b82f6";

interface ChartDatum {
  day: string;
  forecast: number;
  actual: number | null;
  confidence: ConfidenceLevel;
}

// ─── Custom tooltip ─────────────────────────────────

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function ForecastTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.dataKey === "forecast" ? "Forecast" : "Actual"}:{" "}
          {fmtDollarsDecimal(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────

interface WeeklyForecastCardProps {
  venueId: string | undefined;
  className?: string;
}

export function WeeklyForecastCard({
  venueId,
  className,
}: WeeklyForecastCardProps) {
  const { data: forecast, isLoading } = useWeeklyForecast(venueId);
  const { data: weeksOfData } = useWeeksOfData(venueId);

  const chartData = useMemo<ChartDatum[]>(() => {
    if (!forecast) return [];
    return forecast.map((d: DailyForecast) => ({
      day: d.dayLabel.slice(0, 3),
      forecast: d.forecastedRevenue,
      actual: d.actualRevenue,
      confidence: d.confidence,
    }));
  }, [forecast]);

  const totalForecast = useMemo(() => {
    if (!forecast) return 0;
    return forecast.reduce(
      (s: number, d: DailyForecast) => s + d.forecastedRevenue,
      0,
    );
  }, [forecast]);

  const totalActual = useMemo(() => {
    if (!forecast) return null;
    const daysWithActual = forecast.filter(
      (d: DailyForecast) => d.actualRevenue !== null,
    );
    if (daysWithActual.length === 0) return null;
    return daysWithActual.reduce(
      (s: number, d: DailyForecast) => s + (d.actualRevenue ?? 0),
      0,
    );
  }, [forecast]);

  const avgConfidence = useMemo<ConfidenceLevel>(() => {
    if (!forecast || forecast.length === 0) return "low";
    const scores = { low: 1, medium: 2, high: 3 };
    const avg =
      forecast.reduce(
        (s: number, d: DailyForecast) => s + scores[d.confidence],
        0,
      ) / forecast.length;
    if (avg >= 2.5) return "high";
    if (avg >= 1.5) return "medium";
    return "low";
  }, [forecast]);

  // No data state — don't render if less than 1 week of POS data
  if (!isLoading && (!weeksOfData || weeksOfData < 1)) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-teal-600" />
            <CardTitle className="text-sm font-medium">
              Weekly Sales Forecast
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={confidenceColors[avgConfidence]}
            >
              {avgConfidence} confidence
            </Badge>
            {weeksOfData !== undefined && (
              <span className="text-xs text-muted-foreground">
                Based on {weeksOfData} week{weeksOfData !== 1 ? "s" : ""} of
                data
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-[200px] w-full" />
            <div className="flex gap-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-32" />
            </div>
          </div>
        ) : (
          <>
            {/* Summary row */}
            <div className="flex items-center gap-6 mb-4">
              <div>
                <p className="text-xs text-muted-foreground">Week Forecast</p>
                <p className="text-xl font-bold text-teal-600">
                  {fmtDollars(totalForecast)}
                </p>
              </div>
              {totalActual !== null && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    Actual (so far)
                  </p>
                  <p className="text-xl font-bold text-blue-500">
                    {fmtDollars(totalActual)}
                  </p>
                </div>
              )}
              {totalActual !== null && totalForecast > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Tracking</p>
                  <p
                    className={`text-lg font-semibold ${
                      totalActual >= totalForecast * 0.95
                        ? "text-green-600"
                        : totalActual >= totalForecast * 0.85
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {((totalActual / totalForecast) * 100).toFixed(0)}%
                  </p>
                </div>
              )}
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v: number) => `$${(v / 100).toFixed(0)}`}
                  tick={{ fontSize: 11 }}
                  width={55}
                />
                <Tooltip content={<ForecastTooltip />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="forecast"
                  name="Forecast"
                  fill={FORECAST_COLOR}
                  radius={[2, 2, 0, 0]}
                  opacity={0.7}
                />
                <Bar dataKey="actual" name="Actual" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={
                        entry.actual !== null ? ACTUAL_COLOR : "transparent"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Day-by-day confidence */}
            <div className="flex gap-1 mt-3 justify-between">
              {forecast?.map((d: DailyForecast) => (
                <div key={d.date} className="text-center flex-1">
                  <p className="text-[10px] text-muted-foreground">
                    {d.dayLabel.slice(0, 3)}
                  </p>
                  <p className="text-xs font-medium">
                    {fmtDollars(d.forecastedRevenue)}
                  </p>
                  <div
                    className={`mx-auto mt-1 w-2 h-2 rounded-full ${
                      d.confidence === "high"
                        ? "bg-green-500"
                        : d.confidence === "medium"
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                  />
                </div>
              ))}
            </div>

            {avgConfidence === "low" && (
              <div className="flex items-center gap-2 mt-3 p-2 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-xs">
                <AlertCircle className="h-3 w-3 flex-shrink-0" />
                <span>
                  Forecast accuracy improves with more data. 4+ weeks
                  recommended.
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
