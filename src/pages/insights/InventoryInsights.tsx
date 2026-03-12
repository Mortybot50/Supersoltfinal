import { useNavigate } from "react-router-dom"
import { useMemo, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import {
  useDashboardMetrics,
  useInventoryAlerts,
  useCategoryStockValue,
  useFoodCostTrend,
  type AlertItem,
} from "@/lib/hooks/useInventoryDashboard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageShell, PageToolbar } from "@/components/shared"
import {
  DollarSign,
  AlertTriangle,
  Trash2,
  Package,
  TrendingDown,
  ShoppingCart,
  BarChart3,
  Info,
  Clock,
} from "lucide-react"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts"

const CHART_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#ec4899", "#84cc16", "#6366f1",
]

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// ─── KPI Card ─────────────────────────────────────────────────

function KPICard({
  title,
  value,
  icon: Icon,
  badge,
  badgeVariant,
  isLoading,
}: {
  title: string
  value: string
  icon: React.ElementType
  badge?: string
  badgeVariant?: "default" | "destructive" | "secondary" | "outline"
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold">{value}</div>
          {badge && <Badge variant={badgeVariant ?? "secondary"}>{badge}</Badge>}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Alerts Panel ─────────────────────────────────────────────

const alertTypeConfig: Record<
  AlertItem["type"],
  { label: string; icon: React.ElementType; color: string }
> = {
  "below-par": { label: "Below Par Level", icon: AlertTriangle, color: "text-red-500" },
  "overdue-po": { label: "Overdue Purchase Orders", icon: Clock, color: "text-orange-500" },
  "high-variance": { label: "High Variance", icon: TrendingDown, color: "text-amber-500" },
  "no-recent-purchase": { label: "No Recent Purchase (30d)", icon: ShoppingCart, color: "text-blue-500" },
}

function AlertsPanel({ alerts, isLoading }: { alerts: AlertItem[]; isLoading: boolean }) {
  const navigate = useNavigate()

  const grouped = useMemo(() => {
    const groups: Record<AlertItem["type"], AlertItem[]> = {
      "below-par": [],
      "overdue-po": [],
      "high-variance": [],
      "no-recent-purchase": [],
    }
    for (const a of alerts) groups[a.type].push(a)
    return groups
  }, [alerts])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    )
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Alerts & Warnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No alerts — all clear!</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Alerts & Warnings
          <Badge variant="destructive" className="ml-1">{alerts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {(Object.keys(grouped) as AlertItem["type"][]).map((type) => {
          const items = grouped[type]
          if (items.length === 0) return null
          const config = alertTypeConfig[type]
          const TypeIcon = config.icon
          return (
            <div key={type}>
              <div className={`flex items-center gap-1.5 mb-2 text-sm font-medium ${config.color}`}>
                <TypeIcon className="h-3.5 w-3.5" />
                {config.label} ({items.length})
              </div>
              <div className="space-y-1.5">
                {items.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between text-sm py-1.5 px-2 rounded-md bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{alert.name}</span>
                      <span className="text-muted-foreground ml-2">{alert.detail}</span>
                    </div>
                    {alert.actionLabel && alert.actionUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-2 h-7 text-xs shrink-0"
                        onClick={() => navigate(alert.actionUrl!)}
                      >
                        {alert.actionLabel}
                      </Button>
                    )}
                  </div>
                ))}
                {items.length > 5 && (
                  <p className="text-xs text-muted-foreground pl-2">+{items.length - 5} more</p>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ─── Stock Value by Category ──────────────────────────────────

function CategoryPieChart({
  categories,
  isLoading,
}: {
  categories: { category: string; value: number }[]
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-[220px] w-full rounded-lg" /></CardContent>
      </Card>
    )
  }

  if (categories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Stock Value by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No ingredient data yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Stock Value by Category
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={categories}
              dataKey="value"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {categories.map((_, idx) => (
                <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => fmtCurrency(value)} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ─── Food Cost Trend ──────────────────────────────────────────

function FoodCostTrend({
  weeks,
  hasData,
  isLoading,
}: {
  weeks: { weekLabel: string; foodCostPct: number | null; target: number }[]
  hasData: boolean
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-[220px] w-full rounded-lg" /></CardContent>
      </Card>
    )
  }

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4" /> Food Cost % Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Info className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No POS data available yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Connect Square POS to see food cost trends.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingDown className="h-4 w-4" /> Food Cost % Trend
        </CardTitle>
        <CardDescription>Weekly food cost as % of revenue vs 30% target</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={weeks}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, "auto"]} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(value: number | null) => (value !== null ? `${value}%` : "N/A")} />
            <Legend />
            <ReferenceLine
              y={30}
              stroke="#ef4444"
              strokeDasharray="4 4"
              label={{ value: "Target 30%", position: "right", fontSize: 10, fill: "#ef4444" }}
            />
            <Line
              type="monotone"
              dataKey="foodCostPct"
              name="Food Cost %"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ─── High Variance Items ──────────────────────────────────────

function HighVariancePanel({ alerts, isLoading }: { alerts: AlertItem[]; isLoading: boolean }) {
  const items = alerts.filter((a) => a.type === "high-variance")

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingDown className="h-4 w-4" />
          High-Variance Items
          {items.length > 0 && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 ml-1">{items.length}</Badge>
          )}
        </CardTitle>
        <CardDescription>Items with large discrepancies vs expected counts</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No high-variance items detected.</p>
        ) : (
          <div className="space-y-1.5">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-sm py-1.5 px-2 rounded-md bg-amber-50 dark:bg-amber-950/20"
              >
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground text-xs">{item.detail}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Par Level Alerts Panel ───────────────────────────────────

function ParLevelAlerts({ alerts, isLoading }: { alerts: AlertItem[]; isLoading: boolean }) {
  const navigate = useNavigate()
  const items = alerts.filter((a) => a.type === "below-par")

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" />
          Par Level Alerts
          {items.length > 0 && (
            <Badge variant="destructive" className="ml-1">{items.length}</Badge>
          )}
        </CardTitle>
        <CardDescription>Items currently below their par level</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">All items are above par level.</p>
        ) : (
          <div className="space-y-1.5">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-sm py-1.5 px-2 rounded-md bg-red-50 dark:bg-red-950/20"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{item.detail}</span>
                </div>
                {item.actionUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 h-7 text-xs shrink-0 text-red-600 hover:text-red-700"
                    onClick={() => navigate(item.actionUrl!)}
                  >
                    Order
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main ─────────────────────────────────────────────────────

function InventoryInsightsContent() {
  const { currentVenue } = useAuth()
  const venueId = currentVenue?.id

  const { metrics, isLoading: metricsLoading } = useDashboardMetrics(venueId)
  const { alerts, isLoading: alertsLoading } = useInventoryAlerts(venueId)
  const { categories, isLoading: catLoading } = useCategoryStockValue(venueId)
  const { weeks, hasData, isLoading: trendLoading } = useFoodCostTrend(venueId)

  const toolbar = (
    <PageToolbar title="Inventory" />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-6 py-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Total Stock Value"
            value={metrics ? fmtCurrency(metrics.totalStockValue) : "$0"}
            icon={DollarSign}
            isLoading={metricsLoading}
          />
          <KPICard
            title="Items Below Par"
            value={metrics ? String(metrics.itemsBelowPar) : "0"}
            icon={AlertTriangle}
            badge={metrics && metrics.itemsBelowPar > 0 ? String(metrics.itemsBelowPar) : undefined}
            badgeVariant="destructive"
            isLoading={metricsLoading}
          />
          <KPICard
            title="Waste This Week"
            value={metrics ? fmtCurrency(metrics.wasteThisWeek) : "$0"}
            icon={Trash2}
            isLoading={metricsLoading}
          />
          <KPICard
            title="Pending POs"
            value={metrics ? String(metrics.pendingPOs) : "0"}
            icon={Package}
            isLoading={metricsLoading}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FoodCostTrend weeks={weeks} hasData={hasData} isLoading={trendLoading} />
          <CategoryPieChart categories={categories} isLoading={catLoading} />
        </div>

        {/* Alerts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ParLevelAlerts alerts={alerts} isLoading={alertsLoading} />
          <HighVariancePanel alerts={alerts} isLoading={alertsLoading} />
        </div>

        {/* Full alerts */}
        <AlertsPanel alerts={alerts} isLoading={alertsLoading} />
      </div>
    </PageShell>
  )
}

export default function InventoryInsights() {
  return (
    <ErrorBoundary>
      <InventoryInsightsContent />
    </ErrorBoundary>
  )
}
