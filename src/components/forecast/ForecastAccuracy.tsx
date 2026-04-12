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
  LineChart,
  Line,
} from "recharts";
import { Target, TrendingDown, TrendingUp } from "lucide-react";
import { useLastWeekAccuracy, useAccuracyTrend } from "@/lib/hooks/useForecast";
import type { WeekSummary } from "@/lib/services/forecastService";

// ─── Helpers ────────────────────────────────────────

const fmtDollars = (cents: number) =>
  "$" +
  (cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

function getMapeLabel(mape: number): { text: string; color: string } {
  if (mape <= 10) return { text: "Excellent", color: "text-green-600" };
  if (mape <= 20) return { text: "Good", color: "text-teal-600" };
  if (mape <= 30) return { text: "Fair", color: "text-amber-600" };
  return { text: "Needs more data", color: "text-red-600" };
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

function AccuracyTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.dataKey === "forecasted" ? "Forecast" : "Actual"}:{" "}
          {fmtDollars(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────

interface ForecastAccuracyProps {
  venueId: string | undefined;
  className?: string;
}

export function ForecastAccuracy({
  venueId,
  className,
}: ForecastAccuracyProps) {
  const { data: report, isLoading: reportLoading } =
    useLastWeekAccuracy(venueId);
  const { data: trend, isLoading: trendLoading } = useAccuracyTrend(venueId, 6);

  const isLoading = reportLoading || trendLoading;

  const chartData = useMemo(() => {
    if (!report) return [];
    return report.days.map((d) => ({
      day: d.dayLabel.slice(0, 3),
      forecasted: d.forecasted,
      actual: d.actual,
    }));
  }, [report]);

  const trendData = useMemo(() => {
    if (!trend) return [];
    return trend.map((w: WeekSummary) => ({
      week: w.weekStartDate.slice(5),
      mape: w.mape,
    }));
  }, [trend]);

  const isTrendImproving = useMemo(() => {
    if (!trend || trend.length < 2) return null;
    const recent = trend[trend.length - 1].mape;
    const older = trend[0].mape;
    return recent < older;
  }, [trend]);

  // Don't render if no data
  if (!isLoading && !report) return null;
  if (!isLoading && report && report.totalActual === 0) return null;

  const mapeInfo = report ? getMapeLabel(report.mape) : null;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-sm font-medium">
              Forecast Accuracy
            </CardTitle>
          </div>
          {report && mapeInfo && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={mapeInfo.color}>
                MAPE: {report.mape.toFixed(1)}%
              </Badge>
              <span className={`text-xs ${mapeInfo.color}`}>
                {mapeInfo.text}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-[180px] w-full" />
            <Skeleton className="h-4 w-48" />
          </div>
        ) : report ? (
          <div className="space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Total Forecast</p>
                <p className="text-sm font-semibold">
                  {fmtDollars(report.totalForecasted)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Actual</p>
                <p className="text-sm font-semibold">
                  {fmtDollars(report.totalActual)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Variance</p>
                <p
                  className={`text-sm font-semibold ${
                    Math.abs(report.overallVariance) <= 10
                      ? "text-green-600"
                      : Math.abs(report.overallVariance) <= 20
                        ? "text-amber-600"
                        : "text-red-600"
                  }`}
                >
                  {report.overallVariance > 0 ? "+" : ""}
                  {report.overallVariance.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Forecast vs Actual chart */}
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={(v: number) => `$${(v / 100).toFixed(0)}`}
                  tick={{ fontSize: 11 }}
                  width={55}
                />
                <Tooltip content={<AccuracyTooltip />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="forecasted"
                  name="Forecast"
                  fill="#0d9488"
                  radius={[2, 2, 0, 0]}
                  opacity={0.6}
                />
                <Bar
                  dataKey="actual"
                  name="Actual"
                  fill="#3b82f6"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>

            {/* Daily breakdown table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1 font-medium">Day</th>
                    <th className="text-right py-1 font-medium">Forecast</th>
                    <th className="text-right py-1 font-medium">Actual</th>
                    <th className="text-right py-1 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {report.days.map((d) => (
                    <tr key={d.date} className="border-b border-muted/50">
                      <td className="py-1">{d.dayLabel.slice(0, 3)}</td>
                      <td className="text-right py-1">
                        {fmtDollars(d.forecasted)}
                      </td>
                      <td className="text-right py-1">
                        {fmtDollars(d.actual)}
                      </td>
                      <td
                        className={`text-right py-1 ${
                          d.percentageError <= 10
                            ? "text-green-600"
                            : d.percentageError <= 20
                              ? "text-amber-600"
                              : "text-red-600"
                        }`}
                      >
                        {d.actual > 0
                          ? `${d.percentageError.toFixed(0)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Accuracy trend */}
            {trendData.length >= 2 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Accuracy Trend (MAPE)
                  </p>
                  {isTrendImproving !== null && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs ${
                        isTrendImproving ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {isTrendImproving ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : (
                        <TrendingUp className="h-3 w-3" />
                      )}
                      {isTrendImproving ? "Improving" : "Declining"}
                    </span>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={trendData}>
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      width={30}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Line
                      type="monotone"
                      dataKey="mape"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground text-center">
              Last completed week: {report.weekStartDate}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
