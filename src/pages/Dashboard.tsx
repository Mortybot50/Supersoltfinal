import { WeeklyForecastCard } from "@/components/forecast/WeeklyForecastCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  subDays,
  subWeeks,
  subMonths,
  differenceInDays,
  addDays,
  eachDayOfInterval,
  eachHourOfInterval,
  startOfHour,
  isSameDay,
  isSameHour,
} from "date-fns"
import {
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Users,
  Calendar,
  DollarSign,
  ShoppingCart,
  ClipboardList,
  Trash2,
  Package,
  FileText,
  ChevronRight,
  ShoppingBag,
  Plug,
} from "lucide-react"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { useSalesMetrics } from "@/lib/hooks/useSalesMetrics"
import { useLabourMetrics } from "@/lib/hooks/useLabourMetrics"
import { useCOGSMetrics } from "@/lib/hooks/useCOGSMetrics"
import { useInventoryMetrics } from "@/lib/hooks/useInventoryMetrics"
import { useRosterMetrics } from "@/lib/hooks/useRosterMetrics"
import { useDataStore } from "@/lib/store/dataStore"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/integrations/supabase/client"
import { useState, useMemo, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import { PageShell, PageToolbar, DateRangePicker } from "@/components/shared"
import { Skeleton } from "@/components/ui/skeleton"

// ============================================
// DATE RANGE UTILITIES
// ============================================
type DatePreset =
  | "today"
  | "yesterday"
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-month"
  | "custom"

function getDateRange(preset: DatePreset): { from: Date; to: Date } {
  const now = new Date()
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) }
    case "yesterday": {
      const y = subDays(now, 1)
      return { from: startOfDay(y), to: endOfDay(y) }
    }
    case "this-week":
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
      }
    case "last-week": {
      const lw = subWeeks(now, 1)
      return {
        from: startOfWeek(lw, { weekStartsOn: 1 }),
        to: endOfWeek(lw, { weekStartsOn: 1 }),
      }
    }
    case "this-month":
      return { from: startOfMonth(now), to: endOfMonth(now) }
    case "last-month": {
      const lm = subMonths(now, 1)
      return { from: startOfMonth(lm), to: endOfMonth(lm) }
    }
  }
}

function getPreviousPeriod(from: Date, to: Date): { from: Date; to: Date } {
  const days = differenceInDays(to, from) + 1
  return { from: subDays(from, days), to: subDays(from, 1) }
}

// ============================================
// FORMATTERS
// ============================================
const fmtDollars = (cents: number) =>
  "$" + (cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtCompact = (cents: number) => {
  const dollars = cents / 100
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`
  return `$${dollars.toFixed(0)}`
}

const fmtPct = (v: number) => `${(Object.is(v, -0) ? 0 : v).toFixed(1)}%`

// ============================================
// CHART COLORS
// ============================================
const BRAND_TEAL = "#14b8a6"
const BRAND_TEAL_LIGHT = "#5eead4"
const CHART_COLORS = ["#14b8a6", "#B8E636", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"]

// ============================================
// SPARKLINE COMPONENT
// ============================================
function Sparkline({ data, color = BRAND_TEAL }: { data: number[]; color?: string }) {
  const chartData = data.map((v, i) => ({ v, i }))
  return (
    <ResponsiveContainer width="100%" height={32}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-${color.replace("#", "")})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ============================================
// CUSTOM TOOLTIP
// ============================================
function DollarTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-lg px-3 py-2 text-sm">
      <div className="font-medium text-muted-foreground mb-1">{label}</div>
      {payload.map((p, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">
            ${Number(p.value).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      ))}
    </div>
  )
}

// ============================================
// DASHBOARD
// ============================================
export default function Dashboard() {
  const navigate = useNavigate()
  const { currentVenue, venues } = useAuth()
  const venueId = currentVenue?.id
  const { ingredients, staff: allStaff } = useDataStore()

  // POS connection status
  const [posStatus, setPosStatus] = useState<{ connected: boolean; lastSync: string | null } | null>(null)
  useEffect(() => {
    if (!currentVenue) return
    supabase
      .from('pos_connections')
      .select('is_active, last_sync_at')
      .eq('provider', 'square')
      .eq('is_active', true)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setPosStatus({ connected: true, lastSync: data[0].last_sync_at })
        } else {
          setPosStatus({ connected: false, lastSync: null })
        }
      })
  }, [currentVenue])

  const [preset, setPreset] = useState<DatePreset>("this-week")
  const [customFrom, setCustomFrom] = useState<Date | undefined>()
  const [customTo, setCustomTo] = useState<Date | undefined>()
  const [pickerOpen, setPickerOpen] = useState(false)

  const dateRange = useMemo(() => {
    if (preset === "custom") {
      const now = new Date()
      return { from: customFrom ?? startOfDay(now), to: customTo ?? endOfDay(now) }
    }
    return getDateRange(preset)
  }, [preset, customFrom, customTo])
  const prevRange = useMemo(
    () => getPreviousPeriod(dateRange.from, dateRange.to),
    [dateRange]
  )

  const startDate = dateRange.from.toISOString()
  const endDate = dateRange.to.toISOString()
  const prevStartDate = prevRange.from.toISOString()
  const prevEndDate = prevRange.to.toISOString()

  // Current period data
  const sales = useSalesMetrics({ venueId, startDate, endDate })
  const labour = useLabourMetrics({ venueId, startDate, endDate })
  const cogs = useCOGSMetrics({ venueId, startDate, endDate })
  const inventory = useInventoryMetrics({ venueId, startDate, endDate })
  const roster = useRosterMetrics()

  // Previous period data (for comparison)
  const prevSales = useSalesMetrics({
    venueId,
    startDate: prevStartDate,
    endDate: prevEndDate,
  })

  const isLoading = sales.isLoading
  const hasData = sales.hasData

  // ============ KPI CALCULATIONS ============

  // Net Revenue
  const netRevenue = (sales.metrics?.net_sales ?? 0) / 100
  const prevNetRevenue = (prevSales.metrics?.net_sales ?? 0) / 100
  const revenueChange =
    prevNetRevenue > 0 ? ((netRevenue - prevNetRevenue) / prevNetRevenue) * 100 : 0

  // Avg Check
  const avgCheck = (sales.metrics?.avg_check ?? 0) / 100
  const prevAvgCheck = (prevSales.metrics?.avg_check ?? 0) / 100
  const avgCheckChange =
    prevAvgCheck > 0 ? ((avgCheck - prevAvgCheck) / prevAvgCheck) * 100 : 0

  // Labour %
  const labourPct = useMemo(() => {
    if (labour.metrics && labour.metrics.labour_percent > 0) {
      return labour.metrics.labour_percent
    }
    if (netRevenue > 0 && roster.metrics.totalCost > 0) {
      return (roster.metrics.totalCost / 100 / netRevenue) * 100
    }
    return 0
  }, [labour.metrics, netRevenue, roster.metrics.totalCost])

  // GP% = (revenue - COGS) / revenue × 100
  const actualCOGS = (cogs.metrics?.actual_cogs ?? 0) / 100
  const gpPct = netRevenue > 0 ? ((netRevenue - actualCOGS) / netRevenue) * 100 : 0

  // COGS % = actual_cogs / net_revenue × 100
  const cogsPct = netRevenue > 0 ? (actualCOGS / netRevenue) * 100 : 0

  // ============ SPARKLINE DATA (last 7 days of orders) ============
  const sparklineData = useMemo(() => {
    if (!sales.orders.length) return { revenue: [], checks: [] }
    const days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date(),
    })
    const revenue = days.map((day) => {
      return sales.orders
        .filter((o) => !o.is_void && !o.is_refund && isSameDay(new Date(o.order_datetime), day))
        .reduce((sum, o) => sum + o.net_amount / 100, 0)
    })
    const checks = days.map((day) => {
      const dayOrders = sales.orders.filter(
        (o) => !o.is_void && !o.is_refund && isSameDay(new Date(o.order_datetime), day)
      )
      const total = dayOrders.reduce((sum, o) => sum + o.net_amount / 100, 0)
      return dayOrders.length > 0 ? total / dayOrders.length : 0
    })
    return { revenue, checks }
  }, [sales.orders])

  // ============ REVENUE TREND CHART DATA ============
  const trendData = useMemo(() => {
    if (!sales.orders.length) return []
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to })
    const prevDays = eachDayOfInterval({ start: prevRange.from, end: prevRange.to })

    return days.map((day, i) => {
      const daySales = sales.orders
        .filter((o) => !o.is_void && !o.is_refund && isSameDay(new Date(o.order_datetime), day))
        .reduce((sum, o) => sum + o.net_amount / 100, 0)

      const prevDay = prevDays[i]
      const prevDaySales = prevDay
        ? (prevSales.orders || [])
            .filter(
              (o) =>
                !o.is_void && !o.is_refund && isSameDay(new Date(o.order_datetime), prevDay)
            )
            .reduce((sum, o) => sum + o.net_amount / 100, 0)
        : 0

      return {
        date: format(day, "EEE d"),
        current: Math.round(daySales * 100) / 100,
        previous: Math.round(prevDaySales * 100) / 100,
      }
    })
  }, [sales.orders, prevSales.orders, dateRange, prevRange])

  // ============ CHANNEL DONUT DATA ============
  const channelData = useMemo(() => {
    return sales.channelMix.map((c) => ({
      name: c.channel,
      value: c.sales / 100,
      orders: c.orders,
      share: c.share_pct,
    }))
  }, [sales.channelMix])

  // ============ HOURLY SALES (today only) ============
  const hourlyData = useMemo(() => {
    if (preset !== "today") return []
    const now = new Date()
    const hours = eachHourOfInterval({
      start: startOfDay(now),
      end: now,
    })
    return hours.map((hour) => {
      const hourSales = sales.orders
        .filter(
          (o) =>
            !o.is_void &&
            !o.is_refund &&
            isSameHour(new Date(o.order_datetime), hour)
        )
        .reduce((sum, o) => sum + o.net_amount / 100, 0)
      return {
        hour: format(hour, "ha"),
        revenue: Math.round(hourSales * 100) / 100,
      }
    })
  }, [sales.orders, preset])

  // ============ ALERTS ============
  const alerts = useMemo(() => {
    const items: { type: "warning" | "info"; message: string; action: string; path: string }[] =
      []

    // Low stock
    const lowStockCount = inventory.metrics?.items_below_par ?? 0
    if (lowStockCount > 0) {
      items.push({
        type: "warning",
        message: `${lowStockCount} ingredients below par level`,
        action: "View Order Guide",
        path: "/inventory/order-guide",
      })
    }

    // Pending timesheets
    if (roster.pendingTimesheetCount > 0) {
      items.push({
        type: "warning",
        message: `${roster.pendingTimesheetCount} timesheets awaiting approval`,
        action: "Approve",
        path: "/workforce/timesheets",
      })
    }

    // Compliance warnings
    if (roster.allWarningsCount > 0) {
      items.push({
        type: "warning",
        message: `${roster.allWarningsCount} roster compliance warnings`,
        action: "Review",
        path: "/workforce/roster",
      })
    }

    // Draft shifts
    if (roster.draftShiftCount > 0) {
      items.push({
        type: "info",
        message: `${roster.draftShiftCount} draft shifts to publish`,
        action: "Publish",
        path: "/workforce/roster",
      })
    }

    // Labour % warning
    if (labourPct > 32 && labourPct > 0) {
      items.push({
        type: "warning",
        message: `Labour at ${labourPct.toFixed(1)}% — above 32% threshold (target: 28%)`,
        action: "View Reports",
        path: "/workforce/reports",
      })
    }

    // GP% warning
    if (gpPct < 55 && gpPct > 0) {
      items.push({
        type: "warning",
        message: `GP at ${gpPct.toFixed(1)}% — below 55% warning zone (target: 65%)`,
        action: "View COGS",
        path: "/menu/recipes",
      })
    }

    return items
  }, [inventory.metrics, roster, labourPct, gpPct])

  // ============ ROSTER TODAY (mini view) ============
  const rosterToday = useMemo(() => {
    const today = new Date()
    const todayStr = today.toISOString().split("T")[0]
    return roster.weekShifts
      .filter((s) => {
        const shiftDate = new Date(s.date).toISOString().split("T")[0]
        return shiftDate === todayStr && s.status !== "cancelled"
      })
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [roster.weekShifts])

  // ============ LAST IMPORT TIMESTAMP ============
  const lastOrderDate = useMemo(() => {
    if (!sales.orders.length) return null
    const sorted = [...sales.orders].sort(
      (a, b) =>
        new Date(b.order_datetime).getTime() - new Date(a.order_datetime).getTime()
    )
    return new Date(sorted[0].order_datetime)
  }, [sales.orders])

  // ============ PERIOD LABEL ============
  const periodLabel = useMemo(() => {
    if (preset === "custom") {
      return customFrom && customTo
        ? `${format(customFrom, "d MMM")} – ${format(customTo, "d MMM yyyy")}`
        : "Custom"
    }
    const presetLabels: Record<Exclude<DatePreset, "custom">, string> = {
      today: "Today",
      yesterday: "Yesterday",
      "this-week": "This Week",
      "last-week": "Last Week",
      "this-month": "This Month",
      "last-month": "Last Month",
    }
    return presetLabels[preset]
  }, [preset, customFrom, customTo])

  // ============ RENDER ============

  const toolbar = (
    <PageToolbar
      title="Dashboard"
      filters={
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={preset}
            onValueChange={(v) => {
              const val = v as DatePreset
              setPreset(val)
              if (val === "custom") setPickerOpen(true)
            }}
          >
            <SelectTrigger className="h-9 w-[150px] border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="last-week">Last Week</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="custom">Custom...</SelectItem>
            </SelectContent>
          </Select>
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onApply={(from, to) => {
              setCustomFrom(from)
              setCustomTo(to)
            }}
          />
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {format(dateRange.from, "d MMM")} – {format(dateRange.to, "d MMM yyyy")}
          </span>
          {lastOrderDate && (
            <span className="text-xs text-muted-foreground border-l pl-3 hidden md:inline">
              Last data: {format(lastOrderDate, "d MMM h:mma")}
            </span>
          )}
          {posStatus?.connected ? (
            <span className="text-xs border-l pl-3 hidden md:flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
              <span className="text-muted-foreground">Square live</span>
            </span>
          ) : posStatus !== null ? (
            <Button asChild size="sm" variant="outline" className="h-7 text-xs hidden md:flex gap-1.5 border-border/60">
              <Link to="/admin/integrations">
                <Plug className="h-3 w-3" />
                Connect POS
              </Link>
            </Button>
          ) : null}
        </div>
      }
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-6 py-6 space-y-6 max-w-[1400px] mx-auto">

        {/* ====== HERO METRIC ====== */}
        <div className="rounded-xl border border-border/60 bg-card shadow-sm p-6 card-hover">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                Net Revenue · {periodLabel}
              </p>
              {isLoading ? (
                <Skeleton className="h-12 w-48" />
              ) : (
                <p className="text-4xl font-bold tracking-tight tabular-nums">
                  ${netRevenue.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2">
                {revenueChange !== 0 && (
                  <span className={`inline-flex items-center gap-1 text-sm font-medium ${
                    revenueChange >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-500 dark:text-red-400"
                  }`}>
                    {revenueChange >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    {Math.abs(revenueChange).toFixed(1)}%
                  </span>
                )}
                <span className="text-sm text-muted-foreground">vs prev {periodLabel.toLowerCase()}</span>
              </div>
            </div>
            {sparklineData.revenue.length > 0 && (
              <div className="w-48 h-16">
                <Sparkline data={sparklineData.revenue} color={BRAND_TEAL} />
              </div>
            )}
          </div>
        </div>

        {/* ====== ROW 1: 4 SECONDARY KPI CARDS ====== */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <KPICardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link to="/insights/inventory" className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <KPICard
                title="COGS %"
                value={cogsPct === 0 ? "—" : fmtPct(cogsPct)}
                subtitle="Target: <30%"
                status={cogsPct === 0 ? "neutral" : cogsPct <= 30 ? "good" : cogsPct <= 35 ? "warn" : "bad"}
                icon={ShoppingBag}
                iconBg="bg-blue-50 dark:bg-blue-900/20"
                iconColor="text-blue-600 dark:text-blue-400"
              />
            </Link>
            <Link to="/workforce/reports" className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <KPICard
                title="Labour %"
                value={fmtPct(labourPct)}
                subtitle="Target: 28%"
                status={labourPct === 0 ? "neutral" : labourPct <= 28 ? "good" : labourPct <= 32 ? "warn" : "bad"}
                icon={Users}
                iconBg="bg-teal-50 dark:bg-teal-900/20"
                iconColor="text-teal-600 dark:text-teal-400"
              />
            </Link>
            <Link to="/sales" className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <KPICard
                title="Avg Check"
                value={`$${avgCheck.toFixed(2)}`}
                change={avgCheckChange}
                subtitle={`${sales.metrics?.total_orders ?? 0} orders`}
                sparkline={sparklineData.checks}
                sparkColor="#3b82f6"
                icon={ShoppingCart}
                iconBg="bg-violet-50 dark:bg-violet-900/20"
                iconColor="text-violet-600 dark:text-violet-400"
              />
            </Link>
            <Link to="/insights/pl" className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <KPICard
                title="Gross Profit %"
                value={fmtPct(gpPct)}
                subtitle="Target: 65%"
                status={gpPct === 0 ? "neutral" : gpPct >= 65 ? "good" : gpPct >= 55 ? "warn" : "bad"}
                icon={TrendingUp}
                iconBg="bg-brand-50 dark:bg-brand-900/20"
                iconColor="text-brand-600 dark:text-brand-400"
              />
            </Link>
          </div>
        )}

        {/* ====== SALES FORECAST ====== */}
        <WeeklyForecastCard venueId={venueId} />

        {/* ====== ROW 2: CHARTS (2-col) ====== */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Revenue Trend — 2/3 */}
          <div className="lg:col-span-2 rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Revenue Trend</h3>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 rounded bg-teal-500" /> {periodLabel}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 rounded bg-slate-300 dark:bg-slate-600" /> Previous
                </span>
              </div>
            </div>
            <div className="p-5">
              {isLoading ? (
                <ChartSkeleton height={260} />
              ) : !hasData ? (
                <EmptyChart message="No sales data for this period" />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={BRAND_TEAL} stopOpacity={0.18} />
                        <stop offset="95%" stopColor={BRAND_TEAL} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                    />
                    <Tooltip content={<DollarTooltip />} />
                    <Area type="monotone" dataKey="current" stroke={BRAND_TEAL} strokeWidth={2} fill="url(#trendFill)" name={periodLabel} />
                    <Area type="monotone" dataKey="previous" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" fill="none" name="Previous" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Channel Mix — 1/3 */}
          <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40">
              <h3 className="text-sm font-semibold">Channel Mix</h3>
            </div>
            <div className="p-5">
              {isLoading ? (
                <ChartSkeleton height={260} />
              ) : channelData.length === 0 ? (
                <EmptyChart message="No channel data" height={260} />
              ) : (
                <div>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={channelData} cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={2} dataKey="value">
                        {channelData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`$${value.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`, ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-3">
                    {channelData.map((ch, i) => (
                      <div key={ch.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="capitalize text-sm">{ch.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground tabular-nums">{ch.orders} orders</span>
                          <span className="text-sm font-semibold tabular-nums">{ch.share.toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ====== ROW 3: OPERATIONS GRID ====== */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Hourly Sales (today) / Daily Breakdown (other) */}
          <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40">
              <h3 className="text-sm font-semibold">
                {preset === "today" ? "Hourly Sales Today" : "Daily Breakdown"}
              </h3>
            </div>
            <div className="p-5">
              {preset === "today" ? (
                hourlyData.length === 0 ? (
                  <EmptyChart message="No sales yet today" height={220} />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={hourlyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip content={<DollarTooltip />} />
                      <Bar dataKey="revenue" fill={BRAND_TEAL} radius={[4, 4, 0, 0]} name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                )
              ) : trendData.length === 0 ? (
                <EmptyChart message="No data for this period" height={220} />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trendData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
                    />
                    <Tooltip content={<DollarTooltip />} />
                    <Bar dataKey="current" fill={BRAND_TEAL} radius={[4, 4, 0, 0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Roster Today */}
          <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Roster Today</h3>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate("/workforce/roster")}>
                View <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
            <div className="p-5">
              {rosterToday.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                    <Users className="h-6 w-6 opacity-40" />
                  </div>
                  <p className="text-sm">No shifts today</p>
                  <Button variant="link" size="sm" className="text-xs mt-1" onClick={() => navigate("/workforce/roster")}>
                    Create Roster
                  </Button>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[200px] overflow-auto">
                  {rosterToday.map((shift) => (
                    <div key={shift.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors">
                      <div>
                        <div className="font-medium text-sm">{shift.staff_name || "Open"}</div>
                        <div className="text-xs text-muted-foreground capitalize">{shift.role}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium tabular-nums">{shift.start_time}–{shift.end_time}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">{(shift.total_hours ?? 0).toFixed(1)}h</div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-border/40 text-xs text-muted-foreground flex justify-between tabular-nums">
                    <span>{rosterToday.length} shifts · {rosterToday.reduce((s, sh) => s + (sh.total_hours ?? 0), 0).toFixed(1)}h</span>
                    <span className="font-medium">{roster.formatLabourCost(rosterToday.reduce((s, sh) => s + (sh.total_cost ?? 0), 0))}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Alerts Panel */}
          <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Alerts</h3>
              {alerts.length > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5">
                  {alerts.filter((a) => a.type === "warning").length}
                </Badge>
              )}
            </div>
            <div className="p-5">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-3">
                    <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">All clear</p>
                  <p className="text-xs text-muted-foreground mt-1">No issues to review</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-auto">
                  {alerts.map((alert, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
                      alert.type === "warning" ? "bg-amber-50 dark:bg-amber-900/20" : "bg-blue-50 dark:bg-blue-900/20"
                    }`}>
                      <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${alert.type === "warning" ? "text-amber-500" : "text-blue-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-relaxed">{alert.message}</p>
                        <Button variant="link" size="sm" className="h-auto p-0 text-xs mt-1" onClick={() => navigate(alert.path)}>
                          {alert.action} →
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ====== ROW 4: QUICK ACTIONS ====== */}
        <div className="grid gap-4 md:grid-cols-3">
          <QuickAction icon={Calendar} label="Create Roster" description="Schedule next week" onClick={() => navigate("/workforce/roster")} />
          <QuickAction icon={ClipboardList} label="Start Stock Count" description="Count current inventory" onClick={() => navigate("/inventory/stock-counts/new")} />
          <QuickAction icon={Trash2} label="Log Waste" description="Record spoiled items" onClick={() => navigate("/inventory/waste")} />
        </div>

        {/* ====== PAYMENT MIX ====== */}
        {sales.paymentMix.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-card shadow-sm p-5">
            <h3 className="text-sm font-semibold mb-3">Payment Methods</h3>
            <div className="flex gap-6 flex-wrap">
              {sales.paymentMix.map((pm) => (
                <div key={pm.payment_method} className="flex items-center gap-2 text-sm">
                  <span className="capitalize text-muted-foreground">{pm.payment_method}</span>
                  <span className="font-medium tabular-nums">{fmtDollars(pm.amount)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">({pm.share_pct.toFixed(0)}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}

// ============================================
// SUB-COMPONENTS
// ============================================

function KPICardSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="w-10 h-10 rounded-lg" />
      </div>
      <Skeleton className="h-3 w-20 mb-2" />
      <Skeleton className="h-8 w-24 mb-2" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex-1 rounded-t shimmer" style={{ height: `${35 + (i % 4) * 18}%` }} />
      ))}
    </div>
  )
}

function KPICard({
  title,
  value,
  change,
  subtitle,
  sparkline,
  sparkColor,
  status,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  title: string
  value: string
  change?: number
  subtitle?: string
  sparkline?: number[]
  sparkColor?: string
  status?: "good" | "warn" | "bad" | "neutral"
  icon?: React.ComponentType<{ className?: string }>
  iconBg?: string
  iconColor?: string
}) {
  const statusColors = {
    good: "text-emerald-600 dark:text-emerald-400",
    warn: "text-amber-600 dark:text-amber-400",
    bad: "text-red-600 dark:text-red-400",
    neutral: "text-muted-foreground",
  }
  const statusDots = {
    good: "bg-emerald-400",
    warn: "bg-amber-400",
    bad: "bg-red-400",
    neutral: "bg-slate-300",
  }
  const statusLabels = { good: "On target", warn: "Watch", bad: "Over", neutral: "No data" }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm card-hover">
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg || "bg-brand-50 dark:bg-brand-900/20"}`}>
            <Icon className={`h-5 w-5 ${iconColor || "text-brand-600 dark:text-brand-400"}`} />
          </div>
        )}
        {sparkline && sparkline.length > 0 && (
          <div className="w-16">
            <Sparkline data={sparkline} color={sparkColor || BRAND_TEAL} />
          </div>
        )}
      </div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
      <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      <div className="flex items-center gap-2 mt-2">
        {change !== undefined && change !== 0 ? (
          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
            {change >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        ) : status ? (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${statusColors[status]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusDots[status]}`} />
            {statusLabels[status]}
          </span>
        ) : null}
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>
    </div>
  )
}

function QuickAction({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      className="rounded-xl border border-border/60 bg-card p-5 shadow-sm text-left cursor-pointer card-hover hover:border-teal-200 dark:hover:border-teal-800 group w-full transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center group-hover:bg-teal-100 dark:group-hover:bg-teal-900/40 transition-colors shrink-0">
          <Icon className="h-5 w-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
      </div>
    </button>
  )
}

function EmptyChart({ message, height = 260 }: { message: string; height?: number }) {
  return (
    <div className="flex flex-col items-center justify-center text-muted-foreground" style={{ height }}>
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
        <TrendingUp className="h-6 w-6 opacity-30" />
      </div>
      <p className="text-sm">{message}</p>
      <p className="text-xs mt-1 text-muted-foreground/60">Import data to see analytics</p>
    </div>
  )
}
