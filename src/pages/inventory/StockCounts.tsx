import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardCheck,
  Plus,
  Search,
  Eye,
  Calendar,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
  Loader2,
  Trash2,
  Activity,
  Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { format, formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { PageShell, PageToolbar } from '@/components/shared'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/utils/formatters'
import {
  useStockCountsList,
  useApproveStockCount,
} from '@/lib/hooks/useStockCounts'
import {
  calculateVariancePercent,
  aggregateVarianceByCategory,
  isLargeVariance,
} from '@/lib/utils/inventoryCalculations'
import type { StockCount } from '@/types'

// ── Types ───────────────────────────────────────────────────────────────────

type StockStatus = 'healthy' | 'low' | 'critical' | 'out'

interface StockLevelItem {
  ingredient_id: string
  ingredient_name: string
  status: StockStatus
}

interface StockSummary {
  total: number
  healthy: number
  low: number
  critical: number
  out: number
  alertItems: StockLevelItem[]
}

// ── Status badge helper ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'in-progress':
      return (
        <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700 bg-amber-50">
          <Clock className="h-3 w-3" />
          In Progress
        </Badge>
      )
    case 'completed':
      return (
        <Badge variant="outline" className="gap-1 border-blue-300 text-blue-700 bg-blue-50">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      )
    case 'reviewed':
      return (
        <Badge variant="outline" className="gap-1 border-green-300 text-green-700 bg-green-50">
          <CheckCircle2 className="h-3 w-3" />
          Approved
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

// ── Variance summary dialog ─────────────────────────────────────────────────

function VarianceSummaryDialog({
  stockCount,
  open,
  onOpenChange,
}: {
  stockCount: StockCount | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [managerNote, setManagerNote] = useState('')
  const approveCount = useApproveStockCount()

  const items = useMemo(() => stockCount?.items ?? [], [stockCount])

  const topVarianceItems = useMemo(() => {
    return [...items]
      .sort((a, b) => Math.abs(b.variance_value) - Math.abs(a.variance_value))
      .slice(0, 5)
  }, [items])

  const varianceByCategory = useMemo(() => {
    return aggregateVarianceByCategory(
      items.map((item) => ({
        ingredientCategory: item.ingredient_name.split(' ')[0] ?? 'Other',
        varianceValue: item.variance_value,
      }))
    ).slice(0, 8)
  }, [items])

  const totalVariance = stockCount?.total_variance_value ?? 0
  const needsManagerNote =
    Math.abs(totalVariance) > 5000 ||
    items.some(
      (i) =>
        Math.abs(calculateVariancePercent(i.actual_quantity, i.expected_quantity)) > 15
    )

  const handleApprove = () => {
    if (!stockCount) return
    if (needsManagerNote && !managerNote.trim()) return

    approveCount.mutate(
      {
        countId: stockCount.id,
        items,
        managerNote: managerNote || undefined,
      },
      {
        onSuccess: () => {
          setManagerNote('')
          onOpenChange(false)
        },
      }
    )
  }

  if (!stockCount) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Variance Summary — {stockCount.count_number}
          </DialogTitle>
        </DialogHeader>

        {/* Total Variance */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          {totalVariance < 0 ? (
            <TrendingDown className="h-5 w-5 text-red-500" />
          ) : (
            <TrendingUp className="h-5 w-5 text-green-500" />
          )}
          <div>
            <p className="text-sm text-muted-foreground">Total Variance</p>
            <p
              className={`text-xl font-bold ${
                totalVariance < 0 ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {totalVariance >= 0 ? '+' : ''}
              {formatCurrency(totalVariance)}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm text-muted-foreground">Items Counted</p>
            <p className="text-xl font-bold">{items.length}</p>
          </div>
        </div>

        {/* Top 5 Variance Items */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Top 5 Variance Items</h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Item</th>
                  <th className="text-right p-2 font-medium">Expected</th>
                  <th className="text-right p-2 font-medium">Actual</th>
                  <th className="text-right p-2 font-medium">Var %</th>
                  <th className="text-right p-2 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {topVarianceItems.map((item) => {
                  const varPct = calculateVariancePercent(
                    item.actual_quantity,
                    item.expected_quantity
                  )
                  return (
                    <tr key={item.id} className="border-t">
                      <td className="p-2 font-medium">{item.ingredient_name}</td>
                      <td className="p-2 text-right text-muted-foreground">
                        {item.expected_quantity}
                      </td>
                      <td className="p-2 text-right">{item.actual_quantity}</td>
                      <td
                        className={`p-2 text-right font-semibold ${
                          Math.abs(varPct) > 10 ? 'text-red-600' : ''
                        }`}
                      >
                        {varPct > 0 ? '+' : ''}
                        {varPct.toFixed(1)}%
                      </td>
                      <td
                        className={`p-2 text-right font-semibold ${
                          item.variance_value < 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {formatCurrency(item.variance_value)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Variance by Category Chart */}
        {varianceByCategory.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Variance by Category</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={varianceByCategory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" fontSize={11} />
                  <YAxis
                    fontSize={11}
                    tickFormatter={(v: number) => formatCurrency(v)}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Variance']}
                  />
                  <Bar dataKey="variance" radius={[4, 4, 0, 0]}>
                    {varianceByCategory.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.variance < 0 ? '#ef4444' : '#22c55e'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Manager Note */}
        {needsManagerNote && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              <Label className="text-sm font-semibold">
                Manager note required (variance &gt;$50 or &gt;15%)
              </Label>
            </div>
            <Textarea
              value={managerNote}
              onChange={(e) => setManagerNote(e.target.value)}
              placeholder="Explain the variance..."
              rows={3}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {stockCount.status !== 'reviewed' && (
            <Button
              onClick={handleApprove}
              disabled={
                approveCount.isPending ||
                (needsManagerNote && !managerNote.trim())
              }
            >
              {approveCount.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Approve &amp; Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Overview tab ────────────────────────────────────────────────────────────

function OverviewTab({ stockCounts }: { stockCounts: StockCount[] }) {
  const { currentVenueId, organization } = useAuth()
  const orgId = organization?.id

  const { data: stockSummary, isLoading: summaryLoading } = useQuery<StockSummary>({
    queryKey: ['stock-levels-summary', orgId, currentVenueId],
    queryFn: async () => {
      const res = await fetch(
        `/api/inventory?action=get-stock-levels&org_id=${orgId}&venue_id=${currentVenueId}`
      )
      if (!res.ok) throw new Error('Failed to fetch stock levels')
      const data = await res.json()
      const levels: StockLevelItem[] = data.stock_levels ?? []
      return {
        total: levels.length,
        healthy: levels.filter((s) => s.status === 'healthy').length,
        low: levels.filter((s) => s.status === 'low').length,
        critical: levels.filter((s) => s.status === 'critical').length,
        out: levels.filter((s) => s.status === 'out').length,
        alertItems: levels.filter((s) => s.status === 'out' || s.status === 'critical').slice(0, 5),
      }
    },
    enabled: !!orgId && !!currentVenueId,
    staleTime: 60_000,
  })

  const recentCounts = useMemo(
    () =>
      [...stockCounts]
        .sort((a, b) => new Date(b.count_date).getTime() - new Date(a.count_date).getTime())
        .slice(0, 5),
    [stockCounts]
  )

  return (
    <div className="space-y-5">
      {/* Alert banner */}
      {stockSummary && stockSummary.alertItems.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              {stockSummary.out > 0 && stockSummary.critical > 0
                ? `${stockSummary.out + stockSummary.critical} ingredients need attention`
                : stockSummary.out > 0
                ? `${stockSummary.out} ingredient${stockSummary.out !== 1 ? 's' : ''} out of stock`
                : `${stockSummary.critical} ingredient${stockSummary.critical !== 1 ? 's' : ''} critically low`}
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {stockSummary.alertItems.map((i) => i.ingredient_name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Stock status summary */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Stock Status</h3>
        {summaryLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading stock levels…
          </div>
        ) : !stockSummary || stockSummary.total === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No stock level data. Set up POS mapping and run a depletion sync to see stock levels here.
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(
              [
                { label: 'Total', value: stockSummary.total, icon: Package, color: 'text-foreground' },
                { label: 'Healthy', value: stockSummary.healthy, icon: Activity, color: 'text-green-600' },
                { label: 'Low', value: stockSummary.low, icon: TrendingDown, color: 'text-amber-600' },
                { label: 'Critical', value: stockSummary.critical, icon: AlertTriangle, color: 'text-red-600' },
                { label: 'Out of Stock', value: stockSummary.out, icon: Package, color: 'text-red-800' },
              ] as const
            ).map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${color} shrink-0`} />
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent counts */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Recent Counts</h3>
        {recentCounts.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No stock counts yet. Start a count to track inventory.
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="divide-y">
              {recentCounts.map((sc) => {
                const countDate =
                  sc.count_date instanceof Date ? sc.count_date : new Date(sc.count_date)
                return (
                  <div key={sc.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{sc.count_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {sc.counted_by_name ?? 'Unknown'} · {format(countDate, 'dd MMM yyyy')}
                      </p>
                    </div>
                    <StatusBadge status={sc.status} />
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        (sc.total_variance_value ?? 0) < 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {formatCurrency(sc.total_variance_value ?? 0)}
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

// ── Main StockCounts page ───────────────────────────────────────────────────

export default function StockCounts() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: stockCounts = [], isLoading } = useStockCountsList()

  const [pageTab, setPageTab] = useState('counts')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [selectedCount, setSelectedCount] = useState<StockCount | null>(null)
  const [showVariance, setShowVariance] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<StockCount | null>(null)

  // Delete mutation — Supabase first, then invalidate query cache
  const deleteCountMutation = useMutation({
    mutationFn: async (countId: string) => {
      const { error } = await supabase.from('stock_counts').delete().eq('id', countId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-counts'] })
      toast.success('Stock count deleted')
      setDeleteTarget(null)
    },
    onError: () => {
      toast.error('Failed to delete stock count')
    },
  })

  // Filter counts
  const filteredCounts = useMemo(() => {
    let filtered = stockCounts

    if (activeTab === 'in-progress') {
      filtered = filtered.filter((sc) => sc.status === 'in-progress')
    } else if (activeTab === 'completed') {
      filtered = filtered.filter(
        (sc) => sc.status === 'completed' || sc.status === 'reviewed'
      )
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (sc) =>
          sc.count_number.toLowerCase().includes(q) ||
          sc.counted_by_name?.toLowerCase().includes(q)
      )
    }

    return filtered
  }, [stockCounts, activeTab, searchQuery])

  // Summary stats
  const stats = useMemo(() => {
    const inProgress = stockCounts.filter((sc) => sc.status === 'in-progress').length
    const completed = stockCounts.filter(
      (sc) => sc.status === 'completed' || sc.status === 'reviewed'
    ).length
    const totalVariance = stockCounts
      .filter((sc) => sc.status === 'completed' || sc.status === 'reviewed')
      .reduce((sum, sc) => sum + (sc.total_variance_value ?? 0), 0)

    return { total: stockCounts.length, inProgress, completed, totalVariance }
  }, [stockCounts])

  const openVarianceSummary = (sc: StockCount) => {
    setSelectedCount(sc)
    setShowVariance(true)
  }

  const toolbar = (
    <PageToolbar
      title="Stock Counts"
      actions={
        <div className="relative w-64 max-md:w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search counts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8"
          />
        </div>
      }
      primaryAction={{
        label: 'New Count',
        icon: Plus,
        onClick: () => navigate('/inventory/stock-counts/new'),
        variant: 'primary',
      }}
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <Tabs value={pageTab} onValueChange={setPageTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="counts">
              Counts
              <Badge variant="secondary" className="ml-1.5 text-xs">
                {stockCounts.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* ── Overview tab ── */}
          <TabsContent value="overview" className="mt-4">
            <OverviewTab stockCounts={stockCounts} />
          </TabsContent>

          {/* ── Counts tab ── */}
          <TabsContent value="counts" className="mt-4 space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total</span>
                </div>
                <p className="text-2xl font-bold mt-1">{stats.total}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-muted-foreground">In Progress</span>
                </div>
                <p className="text-2xl font-bold mt-1">{stats.inProgress}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Completed</span>
                </div>
                <p className="text-2xl font-bold mt-1">{stats.completed}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  {stats.totalVariance < 0 ? (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  )}
                  <span className="text-sm text-muted-foreground">Net Variance</span>
                </div>
                <p
                  className={`text-2xl font-bold mt-1 ${
                    stats.totalVariance < 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {formatCurrency(stats.totalVariance)}
                </p>
              </Card>
            </div>

            {/* Filter Tabs + List */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">
                  All
                  <Badge variant="secondary" className="ml-1.5 text-xs">
                    {stockCounts.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="in-progress">
                  In Progress
                  <Badge variant="secondary" className="ml-1.5 text-xs">
                    {stats.inProgress}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="completed">
                  Completed
                  <Badge variant="secondary" className="ml-1.5 text-xs">
                    {stats.completed}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredCounts.length === 0 ? (
                  <Card className="p-12 text-center">
                    <ClipboardCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No stock counts found</p>
                    <Button
                      className="mt-4"
                      onClick={() => navigate('/inventory/stock-counts/new')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Start a Count
                    </Button>
                  </Card>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {filteredCounts.map((sc) => {
                      const itemCount = sc.items?.length ?? 0
                      const largeVarCount =
                        sc.items?.filter((i) =>
                          isLargeVariance(
                            i.actual_quantity,
                            i.expected_quantity,
                            0,
                            10,
                            0
                          )
                        ).length ?? 0
                      const countDate =
                        sc.count_date instanceof Date
                          ? sc.count_date
                          : new Date(sc.count_date)

                      return (
                        <Card
                          key={sc.id}
                          className="hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => openVarianceSummary(sc)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-base">
                                  {sc.count_number}
                                </CardTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {sc.counted_by_name ?? 'Unknown'}
                                </p>
                              </div>
                              <StatusBadge status={sc.status} />
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-3">
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {format(countDate, 'dd MMM yyyy')}
                              </span>
                              <span>
                                {formatDistanceToNow(countDate, { addSuffix: true })}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {itemCount} items
                                </span>
                                <span
                                  className={`font-semibold ${
                                    (sc.total_variance_value ?? 0) < 0
                                      ? 'text-red-600'
                                      : 'text-green-600'
                                  }`}
                                >
                                  {formatCurrency(sc.total_variance_value ?? 0)}
                                </span>
                              </div>
                              <Progress
                                value={Math.min(
                                  100,
                                  itemCount > 0 ? ((itemCount - largeVarCount) / itemCount) * 100 : 100
                                )}
                                className="h-1.5"
                              />
                            </div>

                            {largeVarCount > 0 && (
                              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {largeVarCount} item{largeVarCount > 1 ? 's' : ''} with
                                large variance
                              </div>
                            )}

                            <div className="flex gap-2 pt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openVarianceSummary(sc)
                                }}
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                Review
                              </Button>
                              {sc.status === 'in-progress' && (
                                <Button
                                  size="sm"
                                  className="flex-1 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    navigate('/inventory/stock-counts/new')
                                  }}
                                >
                                  Continue
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteTarget(sc)
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      {/* Variance Summary Dialog */}
      <VarianceSummaryDialog
        stockCount={selectedCount}
        open={showVariance}
        onOpenChange={setShowVariance}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stock Count</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold">{deleteTarget?.count_number}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteCountMutation.mutate(deleteTarget.id)
              }}
              disabled={deleteCountMutation.isPending}
            >
              {deleteCountMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  )
}
