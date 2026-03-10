"use client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SalesChart } from "@/components/SalesChart";
import { ProductsTable } from "@/components/ProductsTable";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import DateNav from "@/components/ui/DateNav";
import { track } from "@/lib/analytics";

type Period = "day" | "week" | "month";

export default function DashboardClient() {
  const [period, setPeriod] = useState<Period>("week");
  const [start, setStart] = useState<string>(new Date().toISOString());

  // Track dashboard views
  useEffect(() => {
    track("dashboard_viewed", { period });
  }, [period]);

  const handleDateChange = (p: Period, startISO: string) => {
    setPeriod(p);
    setStart(startISO);
  };

  // Fetch unified dashboard summary
  const { data: summaryData, isLoading: isLoadingSummary } = useQuery({
    queryKey: ["/api/dashboard/summary", period, start],
    queryFn: async () => {
      const res = await fetch(
        `/api/dashboard/summary?period=${period}&start=${encodeURIComponent(start)}`
      );
      if (!res.ok) throw new Error("Failed to fetch dashboard summary");
      return res.json();
    },
  });

  // Fetch suggestions separately (not date-dependent)
  const { data: suggestions } = useQuery({
    queryKey: ["/api/automation/suggestions"],
  });

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

  // Extract data from summary
  const kpis = summaryData?.kpis || { salesCents: 0, cogsPct: null, labourPct: null };
  const chartData = transformChartData(summaryData?.chart?.days || []);
  const products = (summaryData?.topProducts || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    value: item.valueCents / 100, // Convert cents to dollars
    percentOfSales: item.pctOfSales,
    change: item.changePct,
  }));

  const sales = kpis.salesCents / 100; // Convert cents to dollars
  const cogsPct = kpis.cogsPct;
  const labourPct = kpis.labourPct;

  return (
    <div className="p-6" data-testid="page-dashboard">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SectionHeader title="Dashboard" description="Overview of your venue performance" />
        <DateNav onChange={handleDateChange} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={`Sales (${period})`} value={fmt(sales)} data-testid="kpi-sales" />
        <KpiCard 
          label="Theoretical COGS %" 
          value={cogsPct == null ? "—" : `${cogsPct.toFixed(1)}%`} 
          data-testid="kpi-cogs" 
        />
        <KpiCard 
          label="Scheduled Labour %" 
          value={labourPct == null ? "—" : `${labourPct.toFixed(1)}%`} 
          data-testid="kpi-labour" 
        />
        <KpiCard 
          label="Period" 
          value={period.charAt(0).toUpperCase() + period.slice(1)} 
          data-testid="kpi-period" 
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Sales vs Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <div className="h-80 bg-muted animate-pulse rounded" />
            ) : (
              <SalesChart data={chartData} />
            )}
          </CardContent>
        </Card>

        <SuggestionsPanel 
          initialSuggestions={(suggestions as any)?.items ?? []} 
          period={period}
          start={start}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Top Products</CardTitle>
          <CardDescription>Best performing items by value</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSummary ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground" data-testid="empty-top-products">
              No product sales for this period.
            </div>
          ) : (
            <ProductsTable products={products} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Transform chart data from summary API format to chart component format
function transformChartData(days: Array<{ date: string; actualCents: number; forecastCents: number; forecastQty: number }>) {
  const getWeekday = (dateStr: string) => {
    return new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: "UTC" }).format(
      new Date(`${dateStr}T00:00:00Z`)
    );
  };

  return days.map((day) => ({
    day: getWeekday(day.date),
    sales: day.actualCents / 100, // Convert cents to dollars
    forecast: day.forecastCents / 100, // Convert cents to dollars
  }));
}
