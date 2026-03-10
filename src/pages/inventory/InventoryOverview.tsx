import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import {
  useDashboardMetrics,
  useInventoryAlerts,
  useCategoryStockValue,
  useRecentActivity,
  useFoodCostTrend,
  type AlertItem,
} from '@/lib/hooks/useInventoryDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DollarSign,
  AlertTriangle,
  FileText,
  Trash2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Package,
  TrendingDown,
  ShoppingCart,
  Clock,
  BarChart3,
  Info,
} from 'lucide-react'
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
} from 'recharts'

// ─── Colors ──────────────────────────────────────────────────

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#6366f1',
]

// ─── Currency formatter ──────────────────────────────────────

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// ─── Metric Card ─────────────────────────────────────────────

function MetricCard({
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
  badgeVariant?: 'default' | 'destructive' | 'secondary' | 'outline'
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
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold">{value}</div>
          {badge && (
            <Badge variant={badgeVariant ?? 'secondary'}>{badge}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Alerts Section ──────────────────────────────────────────

function AlertsSection({
  alerts,
  isLoading,
}: {
  alerts: AlertItem[]
  isLoading: boolean
}) {
  const [open, setOpen] = useState(true)
  const navigate = useNavigate()

  const grouped = useMemo(() => {
    const groups: Record<AlertItem['type'], AlertItem[]> = {
      'below-par': [],
      'overdue-po': [],
      'high-variance': [],
      'no-recent-purchase': [],
    }
    for (const a of alerts) groups[a.type].push(a)
    return groups
  }, [alerts])

  const alertTypeConfig: Record<
    AlertItem['type'],
    { label: string; icon: React.ElementType; color: string }
  > = {
    'below-par': { label: 'Below Par Level', icon: AlertTriangle, color: 'text-red-500' },
    'overdue-po': { label: 'Overdue Purchase Orders', icon: Clock, color: 'text-orange-500' },
    'high-variance': { label: 'High Variance (Last Count)', icon: TrendingDown, color: 'text-amber-500' },
    'no-recent-purchase': { label: 'No Recent Purchase (30d)', icon: ShoppingCart, color: 'text-blue-500' },
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No alerts — all clear! ✅</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 w-full text-left">
              {open ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Alerts
                <Badge variant="destructive" className="ml-1">
                  {alerts.length}
                </Badge>
              </CardTitle>
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {(Object.keys(grouped) as AlertItem['type'][]).map((type) => {
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
                      <p className="text-xs text-muted-foreground pl-2">
                        +{items.length - 5} more
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// ─── Category Pie Chart ──────────────────────────────────────

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
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  if (categories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Stock Value by Category
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
          <BarChart3 className="h-4 w-4" />
          Stock Value by Category
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={categories}
              dataKey="value"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              label={({ category, percent }) =>
                `${category} ${(percent * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {categories.map((_, idx) => (
                <Cell
                  key={idx}
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => fmtCurrency(value)}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ─── Activity Feed ───────────────────────────────────────────

const activityIcons: Record<string, React.ElementType> = {
  count: ClipboardCheck,
  waste: Trash2,
  'po-received': Package,
  'po-created': FileText,
}

function ActivityFeed({
  events,
  isLoading,
}: {
  events: { id: string; type: string; description: string; timestamp: string }[]
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => {
              const Icon = activityIcons[event.type] ?? FileText
              return (
                <div key={event.id} className="flex gap-3 items-start">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-tight">{event.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(event.timestamp).toLocaleString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Food Cost Trend ─────────────────────────────────────────

function FoodCostTrendChart({
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
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Food Cost % Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Info className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No POS data available yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Connect Square POS to see food cost trends.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingDown className="h-4 w-4" />
          Food Cost % Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={weeks}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 12 }}
              domain={[0, 'auto']}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              formatter={(value: number | null) =>
                value !== null ? `${value}%` : 'N/A'
              }
            />
            <Legend />
            <ReferenceLine
              y={30}
              stroke="#ef4444"
              strokeDasharray="4 4"
              label={{ value: 'Target 30%', position: 'right', fontSize: 11, fill: '#ef4444' }}
            />
            <Line
              type="monotone"
              dataKey="foodCostPct"
              name="Food Cost %"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────

function InventoryDashboardContent() {
  const { currentVenue } = useAuth()
  const venueId = currentVenue?.id

  const { metrics, isLoading: metricsLoading } = useDashboardMetrics(venueId)
  const { alerts, isLoading: alertsLoading } = useInventoryAlerts(venueId)
  const { categories, isLoading: catLoading } = useCategoryStockValue(venueId)
  const { events, isLoading: activityLoading } = useRecentActivity(venueId)
  const { weeks, hasData, isLoading: trendLoading } = useFoodCostTrend(venueId)

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventory Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Real-time snapshot of stock, costs, and alerts
        </p>
      </div>

      {/* Top Metric Cards — 2x2 on mobile, 4 across on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Stock Value"
          value={metrics ? fmtCurrency(metrics.totalStockValue) : '$0'}
          icon={DollarSign}
          isLoading={metricsLoading}
        />
        <MetricCard
          title="Items Below Par"
          value={metrics ? String(metrics.itemsBelowPar) : '0'}
          icon={AlertTriangle}
          badge={
            metrics && metrics.itemsBelowPar > 0
              ? String(metrics.itemsBelowPar)
              : undefined
          }
          badgeVariant="destructive"
          isLoading={metricsLoading}
        />
        <MetricCard
          title="Pending POs"
          value={metrics ? String(metrics.pendingPOs) : '0'}
          icon={FileText}
          isLoading={metricsLoading}
        />
        <MetricCard
          title="Waste This Week"
          value={metrics ? fmtCurrency(metrics.wasteThisWeek) : '$0'}
          icon={Trash2}
          isLoading={metricsLoading}
        />
      </div>

      {/* Two-column layout: 65/35 on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.54fr] gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <AlertsSection alerts={alerts} isLoading={alertsLoading} />
          <FoodCostTrendChart
            weeks={weeks}
            hasData={hasData}
            isLoading={trendLoading}
          />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <CategoryPieChart categories={categories} isLoading={catLoading} />
          <ActivityFeed events={events} isLoading={activityLoading} />
        </div>
      </div>
    </div>
  )
}

export default function InventoryOverview() {
  return (
    <ErrorBoundary>
      <InventoryDashboardContent />
    </ErrorBoundary>
  )
}
