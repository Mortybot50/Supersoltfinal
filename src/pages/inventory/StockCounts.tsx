import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
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
import { PageShell, PageToolbar } from '@/components/shared'
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

// ── Status badge helper ─────────────────────────────────────────────

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

// ── Variance summary dialog ─────────────────────────────────────────

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

  // Top 5 variance items by absolute value
  const topVarianceItems = useMemo(() => {
    return [...items]
      .sort((a, b) => Math.abs(b.variance_value) - Math.abs(a.variance_value))
      .slice(0, 5)
  }, [items])

  // Variance by category for chart
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
    Math.abs(totalVariance) > 5000 || // > $50
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

// ── Main StockCounts page ───────────────────────────────────────────

export default function StockCounts() {
  const navigate = useNavigate()
  const { data: stockCounts = [], isLoading } = useStockCountsList()

  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [selectedCount, setSelectedCount] = useState<StockCount | null>(null)
  const [showVariance, setShowVariance] = useState(false)

  // Filter counts
  const filteredCounts = useMemo(() => {
    let filtered = stockCounts

    // Tab filter
    if (activeTab === 'in-progress') {
      filtered = filtered.filter((sc) => sc.status === 'in-progress')
    } else if (activeTab === 'completed') {
      filtered = filtered.filter(
        (sc) => sc.status === 'completed' || sc.status === 'reviewed'
      )
    }

    // Search
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
      <div className="p-4 md:p-6 space-y-6">
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

        {/* Tabs + List */}
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
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filteredCounts.map((sc) => {
                  const itemCount = sc.items?.length ?? 0
                  const largeVarCount =
                    sc.items?.filter((i) =>
                      isLargeVariance(
                        i.actual_quantity,
                        i.expected_quantity,
                        0, // cost not used for % check
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
                        {/* Date & items */}
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(countDate, 'dd MMM yyyy')}
                          </span>
                          <span>
                            {formatDistanceToNow(countDate, { addSuffix: true })}
                          </span>
                        </div>

                        {/* Variance bar */}
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

                        {/* Flags */}
                        {largeVarCount > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-amber-600">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {largeVarCount} item{largeVarCount > 1 ? 's' : ''} with
                            large variance
                          </div>
                        )}

                        {/* Actions */}
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
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Variance Summary Dialog */}
      <VarianceSummaryDialog
        stockCount={selectedCount}
        open={showVariance}
        onOpenChange={setShowVariance}
      />
    </PageShell>
  )
}
