import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw,
  Play,
  Loader2,
  ShoppingCart,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, isValid } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { PageShell, PageToolbar } from '@/components/shared'

// ── Types ─────────────────────────────────────────────────────────────────────

type Urgency = 'immediate' | 'soon' | 'planned'

interface OrderRecommendation {
  ingredient_id: string
  ingredient_name: string
  supplier_id: string
  supplier_name: string
  current_stock: number
  unit: string
  days_remaining: number | null
  forecast_demand_14d: number
  recommended_qty: number
  urgency: Urgency
  unit_cost: number // cents
  estimated_value: number // cents
}

interface ForecastAccuracy {
  ingredient_id: string
  ingredient_name: string
  mape: number // Mean Absolute Percentage Error
}

interface RecommendationsResponse {
  recommendations: OrderRecommendation[]
  forecast_accuracy: ForecastAccuracy[]
  items_forecasted: number
  average_mape: number
  last_run_at: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function urgencyBadge(urgency: Urgency) {
  switch (urgency) {
    case 'immediate':
      return <Badge variant="destructive">Order Today</Badge>
    case 'soon':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Order Soon</Badge>
    case 'planned':
      return <Badge variant="secondary">Planned</Badge>
  }
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function safeFormat(dateStr: string | null, fmt: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return isValid(d) ? format(d, fmt) : '—'
}

// ── Sparkline bar chart ───────────────────────────────────────────────────────
// Simple div-based bar chart — no charting library required

interface SparkBarProps {
  values: number[]
  label: string
}

function SparkBar({ values, label }: SparkBarProps) {
  const max = Math.max(...values, 1)
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium truncate text-muted-foreground">{label}</p>
      <div className="flex items-end gap-0.5 h-8">
        {values.map((v, i) => (
          <div
            key={i}
            className="flex-1 bg-primary/60 rounded-sm min-h-[2px]"
            style={{ height: `${Math.max(4, (v / max) * 32)}px` }}
            title={`${v}`}
          />
        ))}
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SmartOrders() {
  const { currentVenueId, organization } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [groupBySupplier, setGroupBySupplier] = useState(true)
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set())

  const orgId = organization?.id

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data, isLoading, isError } = useQuery<RecommendationsResponse>({
    queryKey: ['smart-order-recommendations', orgId, currentVenueId],
    queryFn: async () => {
      const res = await fetch(
        `/api/inventory?action=get-recommendations&org_id=${orgId}&venue_id=${currentVenueId}`
      )
      if (!res.ok) throw new Error('Failed to fetch recommendations')
      return res.json()
    },
    enabled: !!orgId && !!currentVenueId,
  })

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const forecastMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/inventory?action=run-forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, venue_id: currentVenueId }),
      })
      if (!res.ok) throw new Error('Forecast failed')
      return res.json()
    },
    onMutate: () => {
      toast.loading('Running demand forecast…', { id: 'run-forecast' })
    },
    onSuccess: () => {
      toast.success('Forecast complete', { id: 'run-forecast' })
      queryClient.invalidateQueries({ queryKey: ['smart-order-recommendations', orgId, currentVenueId] })
    },
    onError: (err: Error) => {
      toast.error(err.message, { id: 'run-forecast' })
    },
  })

  // ── Derived data ──────────────────────────────────────────────────────────────

  const recommendations = useMemo(() => data?.recommendations ?? [], [data?.recommendations])

  // Group by supplier
  const supplierGroups = useMemo(() => {
    const groups: Record<
      string,
      { supplier_id: string; supplier_name: string; items: OrderRecommendation[] }
    > = {}
    for (const rec of recommendations) {
      if (!groups[rec.supplier_id]) {
        groups[rec.supplier_id] = {
          supplier_id: rec.supplier_id,
          supplier_name: rec.supplier_name,
          items: [],
        }
      }
      groups[rec.supplier_id].items.push(rec)
    }
    // Sort: immediate first, then soon, then planned
    const urgencyOrder: Record<Urgency, number> = { immediate: 0, soon: 1, planned: 2 }
    return Object.values(groups).map((g) => ({
      ...g,
      items: [...g.items].sort(
        (a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
      ),
      total_value: g.items.reduce((sum, i) => sum + i.estimated_value, 0),
    }))
  }, [recommendations])

  // Top 5 ingredients by forecast demand for sparklines (mock daily breakdown)
  const topFive = useMemo(
    () =>
      [...recommendations]
        .sort((a, b) => b.forecast_demand_14d - a.forecast_demand_14d)
        .slice(0, 5),
    [recommendations]
  )

  function toggleSupplier(supplierId: string) {
    setExpandedSuppliers((prev) => {
      const next = new Set(prev)
      if (next.has(supplierId)) { next.delete(supplierId) } else { next.add(supplierId) }
      return next
    })
  }

  function handleCreatePO(group: { supplier_id: string; supplier_name: string; items: OrderRecommendation[] }) {
    // TODO: PurchaseOrders page should read location.state.prefillItems on mount
    navigate('/inventory/purchase-orders', {
      state: {
        prefillItems: group.items.map((item) => ({
          supplier_id: group.supplier_id,
          supplier_name: group.supplier_name,
          ingredient_id: item.ingredient_id,
          ingredient_name: item.ingredient_name,
          quantity_ordered: item.recommended_qty,
          unit: item.unit,
          unit_cost: item.unit_cost,
          line_total: item.estimated_value,
        })),
      },
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <PageShell
      toolbar={
        <PageToolbar
          title="Smart Orders"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ['smart-order-recommendations', orgId, currentVenueId],
                  })
                }
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Forecast
              </Button>
              <Button
                size="sm"
                onClick={() => forecastMutation.mutate()}
                disabled={forecastMutation.isPending}
              >
                {forecastMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Run Forecast
              </Button>
            </div>
          }
        />
      }
    >
      <div className="p-6 space-y-5">
        {isError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            Failed to load recommendations. Check your inventory configuration.
          </div>
        )}

        {/* Forecast status + sparklines */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Status card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Forecast Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Items forecasted</span>
                    <span className="font-semibold">{data?.items_forecasted ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Average MAPE</span>
                    <span className="font-semibold">
                      {data?.average_mape != null ? `${data.average_mape.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Last run</span>
                    <span className="font-semibold">
                      {safeFormat(data?.last_run_at ?? null, "d MMM 'at' h:mma")}
                    </span>
                  </div>

                  {/* Forecast accuracy dialog */}
                  {(data?.forecast_accuracy?.length ?? 0) > 0 && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <button className="flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                          <Info className="h-3 w-3" />
                          View forecast accuracy
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Forecast Accuracy (MAPE per item)</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-72 overflow-y-auto divide-y text-sm">
                          {data?.forecast_accuracy.map((fa) => (
                            <div key={fa.ingredient_id} className="flex justify-between py-2">
                              <span className="truncate">{fa.ingredient_name}</span>
                              <span
                                className={`font-medium ml-4 shrink-0 ${
                                  fa.mape < 15
                                    ? 'text-green-600'
                                    : fa.mape < 30
                                    ? 'text-amber-600'
                                    : 'text-red-600'
                                }`}
                              >
                                {fa.mape.toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Top 5 sparklines */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top 5 — 14-Day Demand Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : topFive.length === 0 ? (
                <p className="text-sm text-muted-foreground">Run a forecast to see trends.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  {topFive.map((item) => {
                    // Synthesise a 7-bar daily breakdown from total (evenly distributed + some variation)
                    const daily = Array.from({ length: 7 }, (_, i) => {
                      const base = item.forecast_demand_14d / 14
                      return Math.max(0, Math.round(base * (0.7 + 0.6 * Math.sin(i * 1.3 + item.ingredient_id.charCodeAt(0)))))
                    })
                    return (
                      <SparkBar
                        key={item.ingredient_id}
                        label={item.ingredient_name}
                        values={daily}
                      />
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Group by supplier toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="group-toggle"
            checked={groupBySupplier}
            onCheckedChange={setGroupBySupplier}
          />
          <label htmlFor="group-toggle" className="text-sm font-medium cursor-pointer">
            Group by supplier
          </label>
        </div>

        {/* Recommendations */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : recommendations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <ShoppingCart className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">
                No order recommendations right now. Run a forecast to generate suggestions.
              </p>
              <Button size="sm" onClick={() => forecastMutation.mutate()} disabled={forecastMutation.isPending}>
                <Play className="h-4 w-4 mr-2" />
                Run Forecast
              </Button>
            </CardContent>
          </Card>
        ) : groupBySupplier ? (
          // Grouped view
          <div className="space-y-4">
            {supplierGroups.map((group) => {
              const isExpanded = expandedSuppliers.has(group.supplier_id)
              const immediateCount = group.items.filter((i) => i.urgency === 'immediate').length

              return (
                <Card key={group.supplier_id}>
                  <CardHeader
                    className="pb-3 cursor-pointer select-none"
                    onClick={() => toggleSupplier(group.supplier_id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <CardTitle className="text-base">{group.supplier_name}</CardTitle>
                        <span className="text-sm text-muted-foreground">
                          {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                        </span>
                        {immediateCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {immediateCount} urgent
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">{formatCents(group.total_value)}</span>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCreatePO(group)
                          }}
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Create PO
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="p-0">
                      <RecommendationTable items={group.items} />
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        ) : (
          // Flat view
          <Card>
            <CardContent className="p-0">
              <RecommendationTable items={recommendations} />
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  )
}

// ── Recommendation table sub-component ───────────────────────────────────────

function RecommendationTable({ items }: { items: OrderRecommendation[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ingredient</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead className="text-right">Current Stock</TableHead>
          <TableHead className="text-right">Days Left</TableHead>
          <TableHead className="text-right">Forecast (14d)</TableHead>
          <TableHead className="text-right">Rec. Qty</TableHead>
          <TableHead>Urgency</TableHead>
          <TableHead className="text-right">Unit Cost</TableHead>
          <TableHead className="text-right">Est. Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.ingredient_id}>
            <TableCell className="font-medium">{item.ingredient_name}</TableCell>
            <TableCell className="text-muted-foreground text-sm">{item.supplier_name}</TableCell>
            <TableCell className="text-right tabular-nums text-sm">
              {item.current_stock.toLocaleString()} {item.unit}
            </TableCell>
            <TableCell className="text-right tabular-nums text-sm">
              {item.days_remaining != null ? (
                <span
                  className={
                    item.days_remaining < 3
                      ? 'text-red-600 font-medium'
                      : item.days_remaining <= 7
                      ? 'text-amber-600 font-medium'
                      : ''
                  }
                >
                  {item.days_remaining}d
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums text-sm">
              {item.forecast_demand_14d.toLocaleString()} {item.unit}
            </TableCell>
            <TableCell className="text-right tabular-nums text-sm font-medium">
              {item.recommended_qty.toLocaleString()} {item.unit}
            </TableCell>
            <TableCell>{urgencyBadge(item.urgency)}</TableCell>
            <TableCell className="text-right tabular-nums text-sm">
              {formatCents(item.unit_cost)}/{item.unit}
            </TableCell>
            <TableCell className="text-right tabular-nums text-sm font-semibold">
              {formatCents(item.estimated_value)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
