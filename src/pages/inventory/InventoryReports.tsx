import { useState, useMemo, useEffect } from 'react'
import { BarChart3, Download, Package, TrendingDown, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDataStore } from '@/lib/store/dataStore'
import { format, subDays, startOfMonth, isAfter } from 'date-fns'
import { toast } from 'sonner'
import { PageShell, PageToolbar } from '@/components/shared'
import { StatCards } from '@/components/ui/StatCards'
import { SecondaryStats } from '@/components/ui/SecondaryStats'

type ReportView = 'stock-on-hand' | 'stock-movement' | 'category-summary'
type SortField = 'name' | 'stock' | 'value' | 'category'
type SortDir = 'asc' | 'desc'

const CATEGORY_LABELS: Record<string, string> = {
  produce: 'Produce',
  meat: 'Meat & Protein',
  seafood: 'Seafood',
  dairy: 'Dairy',
  'dry-goods': 'Dry Goods',
  beverages: 'Beverages',
  other: 'Other',
}

export default function InventoryReports() {
  const {
    ingredients,
    wasteLogs: wasteEntries,
    purchaseOrders,
    stockCounts,
    loadIngredientsFromDB,
    loadWasteLogsFromDB,
    loadPurchaseOrdersFromDB,
    loadStockCountsFromDB,
  } = useDataStore()

  const [reportView, setReportView] = useState<ReportView>('stock-on-hand')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<string>('month')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  useEffect(() => {
    loadIngredientsFromDB()
    loadWasteLogsFromDB()
    loadPurchaseOrdersFromDB()
    loadStockCountsFromDB()
  }, [loadIngredientsFromDB, loadWasteLogsFromDB, loadPurchaseOrdersFromDB, loadStockCountsFromDB])

  const activeIngredients = useMemo(() => {
    let filtered = ingredients.filter((i) => i.active)
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((i) => i.category === categoryFilter)
    }
    return filtered
  }, [ingredients, categoryFilter])

  const dateStart = useMemo(() => {
    const now = new Date()
    switch (dateRange) {
      case 'week': return subDays(now, 7)
      case 'month': return startOfMonth(now)
      case '3months': return subDays(now, 90)
      default: return new Date(0)
    }
  }, [dateRange])

  // Stock on hand data
  const stockOnHand = useMemo(() => {
    return activeIngredients
      .map((ing) => ({
        id: ing.id,
        name: ing.name,
        category: ing.category,
        unit: ing.unit,
        current_stock: ing.current_stock,
        par_level: ing.par_level,
        reorder_point: ing.reorder_point || ing.par_level * 0.5,
        cost_per_unit: ing.cost_per_unit,
        stock_value: ing.current_stock * ing.cost_per_unit,
        stock_pct: ing.par_level > 0 ? (ing.current_stock / ing.par_level) * 100 : 0,
      }))
      .sort((a, b) => {
        let cmp = 0
        switch (sortField) {
          case 'name': cmp = a.name.localeCompare(b.name); break
          case 'stock': cmp = a.current_stock - b.current_stock; break
          case 'value': cmp = a.stock_value - b.stock_value; break
          case 'category': cmp = a.category.localeCompare(b.category); break
        }
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [activeIngredients, sortField, sortDir])

  // Stock movement data (purchases in - waste out)
  const stockMovement = useMemo(() => {
    return activeIngredients.map((ing) => {
      // Purchases received in the period
      const receivedQty = purchaseOrders
        .filter((po) => po.status === 'delivered' && po.delivered_at && isAfter(new Date(po.delivered_at), dateStart))
        .reduce((sum, po) => {
          const items = po.items?.filter((item) => item.ingredient_id === ing.id) || []
          return sum + items.reduce((s, item) => s + (item.quantity_received || 0), 0)
        }, 0)

      const receivedValue = receivedQty * ing.cost_per_unit

      // Waste in the period
      const wastedQty = wasteEntries
        .filter((w) => w.ingredient_id === ing.id && isAfter(new Date(w.waste_date), dateStart))
        .reduce((sum, w) => sum + w.quantity, 0)

      const wastedValue = wasteEntries
        .filter((w) => w.ingredient_id === ing.id && isAfter(new Date(w.waste_date), dateStart))
        .reduce((sum, w) => sum + w.value, 0)

      return {
        id: ing.id,
        name: ing.name,
        category: ing.category,
        unit: ing.unit,
        received_qty: receivedQty,
        received_value: receivedValue,
        wasted_qty: wastedQty,
        wasted_value: wastedValue,
        net_movement: receivedQty - wastedQty,
        current_stock: ing.current_stock,
      }
    })
    .filter((row) => row.received_qty > 0 || row.wasted_qty > 0)
    .sort((a, b) => b.received_value - a.received_value)
  }, [activeIngredients, purchaseOrders, wasteEntries, dateStart])

  // Category summary
  const categorySummary = useMemo(() => {
    const categories: Record<string, {
      category: string
      item_count: number
      total_stock_value: number
      total_waste_value: number
      below_par_count: number
      below_reorder_count: number
    }> = {}

    for (const ing of activeIngredients) {
      if (!categories[ing.category]) {
        categories[ing.category] = {
          category: ing.category,
          item_count: 0,
          total_stock_value: 0,
          total_waste_value: 0,
          below_par_count: 0,
          below_reorder_count: 0,
        }
      }
      const cat = categories[ing.category]
      cat.item_count++
      cat.total_stock_value += ing.current_stock * ing.cost_per_unit

      if (ing.current_stock < ing.par_level) cat.below_par_count++
      if (ing.current_stock < (ing.reorder_point || ing.par_level * 0.5)) cat.below_reorder_count++
    }

    // Add waste totals
    for (const w of wasteEntries) {
      if (!isAfter(new Date(w.waste_date), dateStart)) continue
      const ing = ingredients.find((i) => i.id === w.ingredient_id)
      if (!ing || !categories[ing.category]) continue
      categories[ing.category].total_waste_value += w.value
    }

    return Object.values(categories).sort((a, b) => b.total_stock_value - a.total_stock_value)
  }, [activeIngredients, wasteEntries, dateStart, ingredients])

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalStockValue = activeIngredients.reduce(
      (sum, ing) => sum + ing.current_stock * ing.cost_per_unit, 0
    )
    const belowPar = activeIngredients.filter(
      (ing) => ing.current_stock < ing.par_level
    ).length
    const belowReorder = activeIngredients.filter(
      (ing) => ing.current_stock < (ing.reorder_point || ing.par_level * 0.5)
    ).length
    const totalWasteValue = wasteEntries
      .filter((w) => isAfter(new Date(w.waste_date), dateStart))
      .reduce((sum, w) => sum + w.value, 0)

    return { totalStockValue, belowPar, belowReorder, totalWasteValue }
  }, [activeIngredients, wasteEntries, dateStart])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer hover:text-foreground select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <ArrowUpDown className="h-3 w-3" />
        )}
      </div>
    </TableHead>
  )

  const exportCSV = () => {
    let csvContent = ''
    let filename = ''

    if (reportView === 'stock-on-hand') {
      filename = `stock-on-hand-${format(new Date(), 'yyyy-MM-dd')}.csv`
      csvContent = 'Name,Category,Unit,Current Stock,Par Level,Stock %,Unit Cost,Stock Value\n'
      for (const row of stockOnHand) {
        csvContent += `"${row.name}","${CATEGORY_LABELS[row.category] || row.category}","${row.unit}",${row.current_stock},${row.par_level},${row.stock_pct.toFixed(0)}%,$${(row.cost_per_unit / 100).toFixed(2)},$${(row.stock_value / 100).toFixed(2)}\n`
      }
    } else if (reportView === 'stock-movement') {
      filename = `stock-movement-${format(new Date(), 'yyyy-MM-dd')}.csv`
      csvContent = 'Name,Category,Unit,Received Qty,Received Value,Wasted Qty,Wasted Value,Net Movement,Current Stock\n'
      for (const row of stockMovement) {
        csvContent += `"${row.name}","${CATEGORY_LABELS[row.category] || row.category}","${row.unit}",${row.received_qty},$${(row.received_value / 100).toFixed(2)},${row.wasted_qty},$${(row.wasted_value / 100).toFixed(2)},${row.net_movement},${row.current_stock}\n`
      }
    } else {
      filename = `category-summary-${format(new Date(), 'yyyy-MM-dd')}.csv`
      csvContent = 'Category,Items,Stock Value,Waste Value,Below Par,Below Reorder\n'
      for (const row of categorySummary) {
        csvContent += `"${CATEGORY_LABELS[row.category] || row.category}",${row.item_count},$${(row.total_stock_value / 100).toFixed(2)},$${(row.total_waste_value / 100).toFixed(2)},${row.below_par_count},${row.below_reorder_count}\n`
      }
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filename}`)
  }

  const categories = useMemo(() => {
    const cats = new Set(ingredients.filter((i) => i.active).map((i) => i.category))
    return Array.from(cats).sort()
  }, [ingredients])

  const toolbar = (
    <PageToolbar
      title="Inventory Reports"
      filters={
        <div className="flex items-center gap-2">
          <Select value={reportView} onValueChange={(v) => setReportView(v as ReportView)}>
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stock-on-hand">Stock on Hand</SelectItem>
              <SelectItem value="stock-movement">Stock Movement</SelectItem>
              <SelectItem value="category-summary">Category Summary</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] || cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {reportView !== 'stock-on-hand' && (
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="h-8 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="3months">Last 3 Months</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" className="h-8" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5 mr-1" />
            Export CSV
          </Button>
        </div>
      }
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-4 pt-4 space-y-3">
        <StatCards stats={[
          { label: 'Items', value: activeIngredients.length },
          { label: 'Below Par', value: summaryStats.belowPar },
          { label: 'Critical', value: summaryStats.belowReorder },
        ]} columns={3} />
        <SecondaryStats stats={[
          { label: 'Stock Value', value: `$${(summaryStats.totalStockValue / 100).toFixed(0)}` },
          { label: 'Waste (period)', value: `$${(summaryStats.totalWasteValue / 100).toFixed(0)}` },
        ]} />
      </div>
      <div className="p-4 md:p-6 space-y-6">
        {/* Stock on Hand */}
        {reportView === 'stock-on-hand' && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader field="name">Product</SortHeader>
                  <SortHeader field="category">Category</SortHeader>
                  <TableHead>Unit</TableHead>
                  <SortHeader field="stock">Current Stock</SortHeader>
                  <TableHead>Par Level</TableHead>
                  <TableHead>Stock %</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <SortHeader field="value">Stock Value</SortHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockOnHand.map((row) => (
                  <TableRow key={row.id} className={row.current_stock < row.reorder_point ? 'bg-red-50/50 dark:bg-red-950/20' : ''}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{CATEGORY_LABELS[row.category] || row.category}</Badge>
                    </TableCell>
                    <TableCell>{row.unit}</TableCell>
                    <TableCell>
                      <span className={row.current_stock < row.reorder_point ? 'text-red-600 font-semibold' : row.current_stock < row.par_level ? 'text-amber-600 font-semibold' : ''}>
                        {row.current_stock}
                      </span>
                    </TableCell>
                    <TableCell>{row.par_level}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              row.stock_pct >= 100 ? 'bg-green-500' :
                              row.stock_pct >= 50 ? 'bg-amber-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(row.stock_pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{row.stock_pct.toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">${(row.cost_per_unit / 100).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">${(row.stock_value / 100).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {stockOnHand.length > 0 && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={7} className="text-right">Total Stock Value:</TableCell>
                    <TableCell className="text-right">
                      ${(stockOnHand.reduce((s, r) => s + r.stock_value, 0) / 100).toFixed(2)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Stock Movement */}
        {reportView === 'stock-movement' && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Received Qty</TableHead>
                  <TableHead className="text-right">Received Value</TableHead>
                  <TableHead className="text-right">Wasted Qty</TableHead>
                  <TableHead className="text-right">Wasted Value</TableHead>
                  <TableHead className="text-right">Net Movement</TableHead>
                  <TableHead className="text-right">Current Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockMovement.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No stock movement for the selected period
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {stockMovement.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{CATEGORY_LABELS[row.category] || row.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {row.received_qty > 0 ? `+${row.received_qty}` : '—'}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {row.received_value > 0 ? `$${(row.received_value / 100).toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {row.wasted_qty > 0 ? `-${row.wasted_qty}` : '—'}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {row.wasted_value > 0 ? `$${(row.wasted_value / 100).toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={row.net_movement >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {row.net_movement >= 0 ? '+' : ''}{row.net_movement} {row.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{row.current_stock}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={3} className="text-right">Totals:</TableCell>
                      <TableCell className="text-right text-green-600">
                        ${(stockMovement.reduce((s, r) => s + r.received_value, 0) / 100).toFixed(2)}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right text-red-600">
                        ${(stockMovement.reduce((s, r) => s + r.wasted_value, 0) / 100).toFixed(2)}
                      </TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Category Summary */}
        {reportView === 'category-summary' && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Stock Value</TableHead>
                  <TableHead className="text-right">Waste Value</TableHead>
                  <TableHead className="text-right">Waste %</TableHead>
                  <TableHead className="text-right">Below Par</TableHead>
                  <TableHead className="text-right">Below Reorder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categorySummary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No inventory data available
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {categorySummary.map((row) => {
                      const wastePct = row.total_stock_value > 0
                        ? (row.total_waste_value / row.total_stock_value) * 100
                        : 0

                      return (
                        <TableRow key={row.category}>
                          <TableCell className="font-medium">
                            {CATEGORY_LABELS[row.category] || row.category}
                          </TableCell>
                          <TableCell className="text-right">{row.item_count}</TableCell>
                          <TableCell className="text-right font-semibold">
                            ${(row.total_stock_value / 100).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            ${(row.total_waste_value / 100).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={wastePct > 5 ? 'text-red-600 font-semibold' : wastePct > 2 ? 'text-amber-600' : ''}>
                              {wastePct.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {row.below_par_count > 0 ? (
                              <Badge className="bg-amber-500">{row.below_par_count}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.below_reorder_count > 0 ? (
                              <Badge variant="destructive">{row.below_reorder_count}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">
                        {categorySummary.reduce((s, r) => s + r.item_count, 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${(categorySummary.reduce((s, r) => s + r.total_stock_value, 0) / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        ${(categorySummary.reduce((s, r) => s + r.total_waste_value, 0) / 100).toFixed(2)}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right">
                        {categorySummary.reduce((s, r) => s + r.below_par_count, 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {categorySummary.reduce((s, r) => s + r.below_reorder_count, 0)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Empty state */}
        {activeIngredients.length === 0 && (
          <Card className="p-12 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Inventory Data</h3>
            <p className="text-sm text-muted-foreground">
              Add ingredients to see inventory reports
            </p>
          </Card>
        )}
      </div>
    </PageShell>
  )
}
