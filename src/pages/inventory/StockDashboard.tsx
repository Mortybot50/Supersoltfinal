import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, RefreshCw, Play, Loader2, Package, TrendingDown, Clock, Activity } from 'lucide-react'
import { toast } from 'sonner'
import { format, isValid } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageShell, PageToolbar } from '@/components/shared'

// ── Types ─────────────────────────────────────────────────────────────────────

type StockStatus = 'healthy' | 'low' | 'critical' | 'out'

interface StockLevel {
  ingredient_id: string
  ingredient_name: string
  category: string
  current_stock: number
  unit: string
  par_level: number
  reorder_point: number
  days_remaining: number | null
  status: StockStatus
  last_movement_at: string | null
  last_movement_type: 'sale' | 'purchase' | 'adjustment' | 'waste' | null
}

interface StockMovement {
  id: string
  ingredient_id: string
  ingredient_name: string
  movement_type: 'sale' | 'purchase' | 'adjustment' | 'waste'
  quantity_change: number
  unit: string
  created_at: string
  source_ref: string | null
}

interface QueueStatus {
  queue_depth: number
  orders_processed_today: number
  last_sync_at: string | null
  is_processing: boolean
}

interface StockLevelsResponse {
  stock_levels: StockLevel[]
  recent_movements: StockMovement[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: StockStatus) {
  switch (status) {
    case 'healthy':
      return <Badge className="bg-green-100 text-green-800 border-green-200">Healthy</Badge>
    case 'low':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Low</Badge>
    case 'critical':
      return <Badge className="bg-red-100 text-red-800 border-red-200">Critical</Badge>
    case 'out':
      return <Badge variant="destructive">Out of Stock</Badge>
  }
}

function daysRemainingDisplay(days: number | null) {
  if (days === null) return <span className="text-muted-foreground">—</span>
  if (days <= 0) return <span className="font-semibold text-red-600">0 days</span>
  if (days < 7) return <span className="font-medium text-red-600">{days}d</span>
  if (days <= 14) return <span className="font-medium text-amber-600">{days}d</span>
  return <span>{days}d</span>
}

function movementTypeBadge(type: StockMovement['movement_type']) {
  const map: Record<string, string> = {
    sale: 'bg-blue-50 text-blue-700 border-blue-200',
    purchase: 'bg-green-50 text-green-700 border-green-200',
    adjustment: 'bg-purple-50 text-purple-700 border-purple-200',
    waste: 'bg-orange-50 text-orange-700 border-orange-200',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${map[type] ?? ''}`}>
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  )
}

function safeFormat(dateStr: string | null, fmt: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return isValid(d) ? format(d, fmt) : '—'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StockDashboard() {
  const { currentVenueId, organization } = useAuth()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<StockStatus | 'all'>('all')

  const orgId = organization?.id

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: stockData, isLoading: stockLoading } = useQuery<StockLevelsResponse>({
    queryKey: ['stock-levels', orgId, currentVenueId],
    queryFn: async () => {
      const res = await fetch(
        `/api/inventory?action=get-stock-levels&org_id=${orgId}&venue_id=${currentVenueId}`
      )
      if (!res.ok) throw new Error('Failed to fetch stock levels')
      return res.json()
    },
    enabled: !!orgId && !!currentVenueId,
    refetchInterval: 60_000,
  })

  const { data: queueData, isLoading: queueLoading } = useQuery<QueueStatus>({
    queryKey: ['depletion-queue', orgId, currentVenueId],
    queryFn: async () => {
      const res = await fetch(
        `/api/inventory?action=get-queue&org_id=${orgId}&venue_id=${currentVenueId}`
      )
      if (!res.ok) throw new Error('Failed to fetch queue status')
      return res.json()
    },
    enabled: !!orgId && !!currentVenueId,
    refetchInterval: 30_000,
  })

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const processQueueMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/inventory?action=process-queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, venue_id: currentVenueId }),
      })
      if (!res.ok) throw new Error('Failed to process queue')
      return res.json()
    },
    onMutate: () => {
      toast.loading('Processing depletion queue…', { id: 'process-queue' })
    },
    onSuccess: (result: { processed: number }) => {
      toast.success(`Depletion complete — ${result.processed ?? 0} orders processed`, {
        id: 'process-queue',
      })
      queryClient.invalidateQueries({ queryKey: ['stock-levels', orgId, currentVenueId] })
      queryClient.invalidateQueries({ queryKey: ['depletion-queue', orgId, currentVenueId] })
    },
    onError: (err: Error) => {
      toast.error(err.message, { id: 'process-queue' })
    },
  })

  // ── Derived data ──────────────────────────────────────────────────────────────

  const stockLevels = stockData?.stock_levels ?? []
  const recentMovements = (stockData?.recent_movements ?? []).slice(0, 50)

  const counts = {
    total: stockLevels.length,
    healthy: stockLevels.filter((s) => s.status === 'healthy').length,
    low: stockLevels.filter((s) => s.status === 'low').length,
    critical: stockLevels.filter((s) => s.status === 'critical').length,
    out: stockLevels.filter((s) => s.status === 'out').length,
  }

  const alertItems = stockLevels.filter((s) => s.status === 'out' || s.status === 'critical')

  const filteredLevels =
    statusFilter === 'all' ? stockLevels : stockLevels.filter((s) => s.status === statusFilter)

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <PageShell
      toolbar={
        <PageToolbar
          title="Stock Dashboard"
          actions={
            <Button
              size="sm"
              onClick={() => processQueueMutation.mutate()}
              disabled={processQueueMutation.isPending}
            >
              {processQueueMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Trigger Depletion
            </Button>
          }
        />
      }
    >
      <div className="p-6 space-y-5">
        {/* Alert banner */}
        {alertItems.length > 0 && (
          <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">
              <span className="font-semibold">{alertItems.length} ingredient{alertItems.length !== 1 ? 's' : ''}</span>{' '}
              {counts.out > 0 && counts.critical > 0
                ? `out of stock or critically low`
                : counts.out > 0
                ? `out of stock`
                : `critically low`}{' '}
              — consider ordering now.
            </p>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(
            [
              { label: 'Total', value: counts.total, icon: Package, color: 'text-foreground', filter: 'all' },
              { label: 'Healthy', value: counts.healthy, icon: Activity, color: 'text-green-600', filter: 'healthy' },
              { label: 'Low', value: counts.low, icon: TrendingDown, color: 'text-amber-600', filter: 'low' },
              { label: 'Critical', value: counts.critical, icon: AlertTriangle, color: 'text-red-600', filter: 'critical' },
              { label: 'Out of Stock', value: counts.out, icon: Package, color: 'text-red-800', filter: 'out' },
            ] as const
          ).map(({ label, value, icon: Icon, color, filter }) => (
            <Card
              key={label}
              className={`cursor-pointer transition-colors ${statusFilter === filter ? 'ring-2 ring-primary' : 'hover:bg-accent/50'}`}
              onClick={() => setStatusFilter(filter as StockStatus | 'all')}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={`h-5 w-5 ${color} shrink-0`} />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>
                    {stockLoading ? <span className="text-muted-foreground text-lg">…</span> : value}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stock levels table + movements side by side on large screens */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Stock levels table */}
          <Card className="xl:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Stock Levels
                {statusFilter !== 'all' && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground capitalize">
                    — {statusFilter}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {stockLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingredient</TableHead>
                      <TableHead className="text-right">Current Stock</TableHead>
                      <TableHead className="text-right">Par Level</TableHead>
                      <TableHead className="text-right">Days Left</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Movement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLevels.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No stock data available.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLevels.map((item) => (
                        <TableRow key={item.ingredient_id}>
                          <TableCell>
                            <div className="font-medium">{item.ingredient_name}</div>
                            <div className="text-xs text-muted-foreground capitalize">{item.category}</div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {item.current_stock.toLocaleString()} {item.unit}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {item.par_level.toLocaleString()} {item.unit}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {daysRemainingDisplay(item.days_remaining)}
                          </TableCell>
                          <TableCell>{statusBadge(item.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.last_movement_at
                              ? safeFormat(item.last_movement_at, 'd MMM, h:mma').toLowerCase()
                              : '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Right column: movements + queue */}
          <div className="space-y-4">
            {/* Processing status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Depletion Engine
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {queueLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Queue depth</span>
                      <span className="font-semibold">
                        {queueData?.queue_depth ?? 0} orders
                        {queueData?.is_processing && (
                          <span className="ml-1 text-xs text-amber-600">(processing…)</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Processed today</span>
                      <span className="font-semibold">{queueData?.orders_processed_today ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Last sync</span>
                      <span className="font-semibold">
                        {queueData?.last_sync_at
                          ? safeFormat(queueData.last_sync_at, 'h:mma')
                          : '—'}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-1"
                      onClick={() => processQueueMutation.mutate()}
                      disabled={processQueueMutation.isPending || queueData?.queue_depth === 0}
                    >
                      {processQueueMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      Process Queue
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Recent movements feed */}
            <Card className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recent Movements
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {stockLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : recentMovements.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-4 pb-4">No movements recorded yet.</p>
                ) : (
                  <div className="divide-y max-h-96 overflow-y-auto">
                    {recentMovements.map((mv) => (
                      <div key={mv.id} className="px-4 py-2.5 flex items-start gap-3">
                        <div className="mt-0.5">{movementTypeBadge(mv.movement_type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{mv.ingredient_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {mv.quantity_change > 0 ? '+' : ''}
                            {mv.quantity_change.toLocaleString()} {mv.unit}
                            {mv.source_ref && (
                              <span className="ml-1 text-muted-foreground/70">· {mv.source_ref}</span>
                            )}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                          {safeFormat(mv.created_at, 'h:mma')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
