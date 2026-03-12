import { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Download,
  Info,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDataStore } from '@/lib/store/dataStore'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { format, subDays, startOfMonth, isAfter, isBefore, eachWeekOfInterval, eachMonthOfInterval, endOfMonth, endOfWeek } from 'date-fns'
import { toast } from 'sonner'
import { PageShell, PageToolbar } from '@/components/shared'
import { StatCards } from '@/components/ui/StatCards'

// ─── Types ───────────────────────────────────────────────────────────────────

type DateRangePreset = 'week' | 'month' | '3months' | 'custom'
type GroupBy = 'ingredient' | 'category'

const CATEGORY_LABELS: Record<string, string> = {
  produce: 'Produce',
  meat: 'Meat & Protein',
  seafood: 'Seafood',
  dairy: 'Dairy',
  'dry-goods': 'Dry Goods',
  beverages: 'Beverages',
  other: 'Other',
}

interface DepletionMovement {
  ingredient_id: string
  movement_type: 'sale_depletion' | 'refund_reversal'
  quantity: number
  unit_cost: number | null
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDateRange(preset: DateRangePreset, customFrom: string, customTo: string): { from: Date; to: Date } {
  const now = new Date()
  switch (preset) {
    case 'week':
      return { from: subDays(now, 7), to: now }
    case 'month':
      return { from: startOfMonth(now), to: now }
    case '3months':
      return { from: subDays(now, 90), to: now }
    case 'custom':
      return {
        from: customFrom ? new Date(customFrom) : subDays(now, 30),
        to: customTo ? new Date(customTo) : now,
      }
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FoodCostAnalysis() {
  const {
    ingredients,
    purchaseOrders,
    stockCounts,
    wasteLogs,
    recipes,
    recipeIngredients,
    orders,
    menuItems,
    loadIngredientsFromDB,
    loadPurchaseOrdersFromDB,
    loadStockCountsFromDB,
    loadWasteLogsFromDB,
  } = useDataStore()

  const { organization, currentVenueId } = useAuth()

  const [preset, setPreset] = useState<DateRangePreset>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [varianceThreshold, setVarianceThreshold] = useState(5)
  const [groupBy, setGroupBy] = useState<GroupBy>('category')
  const [depletionMovements, setDepletionMovements] = useState<DepletionMovement[]>([])
  const [depletionLoading, setDepletionLoading] = useState(false)

  useEffect(() => {
    loadIngredientsFromDB()
    loadPurchaseOrdersFromDB()
    loadStockCountsFromDB()
    loadWasteLogsFromDB()
  }, [loadIngredientsFromDB, loadPurchaseOrdersFromDB, loadStockCountsFromDB, loadWasteLogsFromDB])

  const { from, to } = useMemo(() => getDateRange(preset, customFrom, customTo), [preset, customFrom, customTo])

  // Load depletion movements from stock_movements for the selected period
  useEffect(() => {
    if (!organization?.id || !currentVenueId) return

    const fromIso = from.toISOString()
    const toIso = to.toISOString()

    setDepletionLoading(true)
    supabase
      .from('stock_movements' as 'pos_connections' & 'stock_movements')
      .select('ingredient_id, movement_type, quantity, unit_cost, created_at')
      .eq('org_id' as never, organization.id)
      .eq('venue_id' as never, currentVenueId)
      .in('movement_type' as never, ['sale_depletion', 'refund_reversal'])
      .gte('created_at' as never, fromIso)
      .lte('created_at' as never, toIso)
      .then(({ data, error }) => {
        if (!error && data) {
          setDepletionMovements(data as unknown as DepletionMovement[])
        }
        setDepletionLoading(false)
      })
  }, [organization?.id, currentVenueId, from, to])

  // ─── Depletion-based COGS (real data from stock_movements) ─────────────────
  // Actual COGS = Σ(abs(quantity) × unit_cost) for sale_depletion
  //             − Σ(quantity × unit_cost) for refund_reversal (stock returned)

  const depletionCOGS = useMemo(() => {
    if (depletionMovements.length === 0) return null

    let saleDepletion = 0
    let refundReversal = 0
    const byIngredient = new Map<string, number>()

    for (const m of depletionMovements) {
      const unitCost = m.unit_cost ?? 0
      const value = Math.abs(m.quantity) * unitCost

      if (m.movement_type === 'sale_depletion') {
        saleDepletion += value
        byIngredient.set(m.ingredient_id, (byIngredient.get(m.ingredient_id) ?? 0) + value)
      } else if (m.movement_type === 'refund_reversal') {
        refundReversal += value
        byIngredient.set(m.ingredient_id, (byIngredient.get(m.ingredient_id) ?? 0) - value)
      }
    }

    return {
      saleDepletion,
      refundReversal,
      net: Math.max(0, saleDepletion - refundReversal),
      byIngredient,
    }
  }, [depletionMovements])

  // ─── Actual food cost (COGS) — purchase-based formula ──────────────────────
  // Formula: Opening Stock + Purchases - Closing Stock - Waste

  const actualCOGS = useMemo(() => {
    // Purchases received in period
    const purchasesValue = purchaseOrders
      .filter(
        (po) =>
          po.status === 'delivered' &&
          po.delivered_at &&
          isAfter(new Date(po.delivered_at as unknown as string), from) &&
          isBefore(new Date(po.delivered_at as unknown as string), to)
      )
      .reduce((sum, po) => {
        return (
          sum +
          (po.items || []).reduce((s, item) => s + (item.quantity_received || 0) * item.unit_cost, 0)
        )
      }, 0)

    // Opening stock: latest stock count before 'from'
    const openingCount = stockCounts
      .filter(
        (sc) =>
          sc.status === 'reviewed' &&
          isBefore(new Date(sc.count_date as unknown as string), from)
      )
      .sort((a, b) => new Date(b.count_date as unknown as string).getTime() - new Date(a.count_date as unknown as string).getTime())[0]

    const openingValue = openingCount?.total_count_value ?? 0

    // Closing stock: latest stock count before 'to'
    const closingCount = stockCounts
      .filter(
        (sc) =>
          sc.status === 'reviewed' &&
          isBefore(new Date(sc.count_date as unknown as string), to)
      )
      .sort((a, b) => new Date(b.count_date as unknown as string).getTime() - new Date(a.count_date as unknown as string).getTime())[0]

    const closingValue = closingCount?.total_count_value ?? 0

    // Waste logged in period
    const wasteValue = wasteLogs
      .filter(
        (w) =>
          isAfter(new Date(w.waste_date as unknown as string), from) &&
          isBefore(new Date(w.waste_date as unknown as string), to)
      )
      .reduce((sum, w) => sum + w.value, 0)

    // Full COGS formula: Opening + Purchases − Closing − Waste
    const cogs = openingValue + purchasesValue - closingValue - wasteValue
    return {
      purchases: purchasesValue,
      openingStock: openingValue,
      closingStock: closingValue,
      waste: wasteValue,
      total: Math.max(0, cogs),
      hasStockCounts: Boolean(openingCount || closingCount),
    }
  }, [purchaseOrders, stockCounts, wasteLogs, from, to])

  // ─── Theoretical food cost ──────────────────────────────────────────────────

  const theoreticalCOGS = useMemo(() => {
    const periodOrders = orders.filter(
      (o) =>
        !o.is_void &&
        !o.is_refund &&
        isAfter(new Date(o.order_datetime), from) &&
        isBefore(new Date(o.order_datetime), to)
    )

    const theoreticalByMenuItem: Record<string, { qty: number; costPerSale: number; name: string }> = {}

    for (const order of periodOrders) {
      if (!order.order_items) continue
      for (const oi of order.order_items) {
        const menuItem = menuItems.find((m) => m.id === oi.menu_item_id)
        if (!menuItem) continue
        const existing = theoreticalByMenuItem[menuItem.id]
        if (existing) {
          existing.qty += oi.quantity
        } else {
          theoreticalByMenuItem[menuItem.id] = {
            qty: oi.quantity,
            costPerSale: menuItem.cost_price,
            name: menuItem.name,
          }
        }
      }
    }

    let totalTheoretical = 0
    const breakdown: Array<{ name: string; theoretical: number; qty: number }> = []

    if (Object.keys(theoreticalByMenuItem).length > 0) {
      for (const [id, data] of Object.entries(theoreticalByMenuItem)) {
        const recipe = recipes.find((r) => r.menu_item_id === id)
        let costPerSale = data.costPerSale

        if (recipe) {
          const rIngreds = recipeIngredients.filter((ri) => ri.recipe_id === recipe.id)
          costPerSale = rIngreds.reduce((sum, ri) => {
            const ing = ingredients.find((i) => i.id === ri.ingredient_id)
            return sum + (ing ? ri.quantity * ing.cost_per_unit : 0)
          }, 0)
        }

        const lineTotal = data.qty * costPerSale
        totalTheoretical += lineTotal
        breakdown.push({ name: data.name, theoretical: lineTotal, qty: data.qty })
      }
    } else {
      const totalRevenue = periodOrders.reduce((sum, o) => sum + o.gross_amount / 100, 0)
      totalTheoretical = totalRevenue * 0.28 * 100
    }

    return { total: totalTheoretical, breakdown, hasDetailedData: Object.keys(theoreticalByMenuItem).length > 0 }
  }, [orders, menuItems, recipes, recipeIngredients, ingredients, from, to])

  // ─── Ingredient-level variance ──────────────────────────────────────────────

  const ingredientVariance = useMemo(() => {
    const rows: Array<{
      id: string
      name: string
      category: string
      actualCost: number
      theoreticalCost: number
      depletionCost: number | null
      variance: number
      variancePct: number
    }> = []

    for (const ing of ingredients.filter((i) => i.active)) {
      const actualCost = purchaseOrders
        .filter(
          (po) =>
            po.status === 'delivered' &&
            po.delivered_at &&
            isAfter(new Date(po.delivered_at as unknown as string), from) &&
            isBefore(new Date(po.delivered_at as unknown as string), to)
        )
        .reduce((sum, po) => {
          const item = (po.items || []).find((i) => i.ingredient_id === ing.id)
          return sum + (item ? (item.quantity_received || 0) * item.unit_cost : 0)
        }, 0)

      const wasteValue = wasteLogs
        .filter(
          (w) =>
            w.ingredient_id === ing.id &&
            isAfter(new Date(w.waste_date as unknown as string), from) &&
            isBefore(new Date(w.waste_date as unknown as string), to)
        )
        .reduce((sum, w) => sum + w.value, 0)

      const theoreticalCost = wasteValue

      // Depletion-based cost for this ingredient (from stock_movements)
      const depletionCost = depletionCOGS
        ? (depletionCOGS.byIngredient.get(ing.id) ?? null)
        : null

      if (actualCost === 0 && theoreticalCost === 0 && (depletionCost === null || depletionCost === 0)) continue

      const variance = actualCost - theoreticalCost
      const variancePct = theoreticalCost > 0 ? (variance / theoreticalCost) * 100 : 0

      rows.push({ id: ing.id, name: ing.name, category: ing.category, actualCost, theoreticalCost, depletionCost, variance, variancePct })
    }

    return rows.sort((a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct))
  }, [ingredients, purchaseOrders, wasteLogs, depletionCOGS, from, to])

  // ─── Category variance ──────────────────────────────────────────────────────

  const categoryVariance = useMemo(() => {
    const cats: Record<string, { category: string; actual: number; theoretical: number }> = {}
    for (const row of ingredientVariance) {
      if (!cats[row.category]) {
        cats[row.category] = { category: row.category, actual: 0, theoretical: 0 }
      }
      cats[row.category].actual += row.actualCost
      cats[row.category].theoretical += row.theoreticalCost
    }
    return Object.values(cats)
      .map((c) => ({
        ...c,
        variance: c.actual - c.theoretical,
        variancePct: c.theoretical > 0 ? ((c.actual - c.theoretical) / c.theoretical) * 100 : 0,
        label: CATEGORY_LABELS[c.category] || c.category,
      }))
      .sort((a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct))
  }, [ingredientVariance])

  // ─── Trend data ─────────────────────────────────────────────────────────────

  const trendData = useMemo(() => {
    const daysDiff = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDiff <= 31) {
      const weeks = eachWeekOfInterval({ start: from, end: to })
      return weeks.map((weekStart) => {
        const weekEnd = endOfWeek(weekStart)
        const purchases = purchaseOrders
          .filter(
            (po) =>
              po.status === 'delivered' &&
              po.delivered_at &&
              isAfter(new Date(po.delivered_at as unknown as string), weekStart) &&
              isBefore(new Date(po.delivered_at as unknown as string), weekEnd)
          )
          .reduce((s, po) =>
            s + (po.items || []).reduce((ss, item) => ss + (item.quantity_received || 0) * item.unit_cost, 0), 0
          )
        const waste = wasteLogs
          .filter(
            (w) =>
              isAfter(new Date(w.waste_date as unknown as string), weekStart) &&
              isBefore(new Date(w.waste_date as unknown as string), weekEnd)
          )
          .reduce((s, w) => s + w.value, 0)
        return {
          label: format(weekStart, 'dd MMM'),
          actual: Math.round(purchases / 100),
          waste: Math.round(waste / 100),
        }
      })
    } else {
      const months = eachMonthOfInterval({ start: from, end: to })
      return months.map((monthStart) => {
        const monthEnd = endOfMonth(monthStart)
        const purchases = purchaseOrders
          .filter(
            (po) =>
              po.status === 'delivered' &&
              po.delivered_at &&
              isAfter(new Date(po.delivered_at as unknown as string), monthStart) &&
              isBefore(new Date(po.delivered_at as unknown as string), monthEnd)
          )
          .reduce((s, po) =>
            s + (po.items || []).reduce((ss, item) => ss + (item.quantity_received || 0) * item.unit_cost, 0), 0
          )
        const waste = wasteLogs
          .filter(
            (w) =>
              isAfter(new Date(w.waste_date as unknown as string), monthStart) &&
              isBefore(new Date(w.waste_date as unknown as string), monthEnd)
          )
          .reduce((s, w) => s + w.value, 0)
        return {
          label: format(monthStart, 'MMM yy'),
          actual: Math.round(purchases / 100),
          waste: Math.round(waste / 100),
        }
      })
    }
  }, [purchaseOrders, wasteLogs, from, to])

  // ─── Export ─────────────────────────────────────────────────────────────────

  const exportCSV = () => {
    let csv = 'Ingredient,Category,Actual Cost ($),Theoretical Cost ($),Depletion COGS ($),Variance ($),Variance (%)\n'
    for (const row of ingredientVariance) {
      const depletion = row.depletionCost !== null ? (row.depletionCost / 100).toFixed(2) : ''
      csv += `"${row.name}","${CATEGORY_LABELS[row.category] || row.category}",${(row.actualCost / 100).toFixed(2)},${(row.theoreticalCost / 100).toFixed(2)},${depletion},${(row.variance / 100).toFixed(2)},${row.variancePct.toFixed(1)}%\n`
    }
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `food-cost-avt-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported food cost variance CSV')
  }

  // ─── Summary stats ───────────────────────────────────────────────────────────

  // Primary COGS: depletion-based if available, otherwise purchase-based
  const primaryCOGS = depletionCOGS ? depletionCOGS.net : actualCOGS.total
  const cogsIsDepletion = Boolean(depletionCOGS && depletionCOGS.saleDepletion > 0)

  const overallVariancePct =
    theoreticalCOGS.total > 0
      ? ((primaryCOGS - theoreticalCOGS.total) / theoreticalCOGS.total) * 100
      : 0

  const highVarianceCount = ingredientVariance.filter(
    (r) => Math.abs(r.variancePct) > varianceThreshold
  ).length

  // ─── Toolbar ─────────────────────────────────────────────────────────────────

  const toolbar = (
    <PageToolbar
      title="Actual vs Theoretical Food Cost"
      filters={
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={preset} onValueChange={(v) => setPreset(v as DateRangePreset)}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {preset === 'custom' && (
            <>
              <Input
                type="date"
                className="h-8 w-36"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input
                type="date"
                className="h-8 w-36"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </>
          )}
          <div className="flex items-center gap-1 border rounded h-8 px-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Threshold:</Label>
            <Input
              type="number"
              min="1"
              max="50"
              value={varianceThreshold}
              onChange={(e) => setVarianceThreshold(parseInt(e.target.value) || 5)}
              className="h-6 w-14 border-0 p-0 text-xs"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="category">By Category</SelectItem>
              <SelectItem value="ingredient">By Ingredient</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5 mr-1" />
            Export
          </Button>
        </div>
      }
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-6 pt-6 pb-2 space-y-3">
        <StatCards
          stats={[
            {
              label: cogsIsDepletion ? 'Actual COGS (Depletion)' : 'Actual COGS',
              value: `$${(primaryCOGS / 100).toFixed(0)}`,
            },
            {
              label: 'Theoretical',
              value: `$${(theoreticalCOGS.total / 100).toFixed(0)}`,
            },
            {
              label: 'Variance',
              value: `${overallVariancePct > 0 ? '+' : ''}${overallVariancePct.toFixed(1)}%`,
            },
            {
              label: 'High Variance Items',
              value: highVarianceCount,
            },
          ]}
          columns={4}
        />
      </div>
      <div className="px-6 pb-6 space-y-6">

        {/* COGS breakdown info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Depletion-based COGS card (shown when real depletion data exists) */}
          {depletionCOGS && depletionCOGS.saleDepletion > 0 ? (
            <Card className="p-4 space-y-3 border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">Actual COGS</h3>
                <Badge className="text-xs bg-emerald-100 text-emerald-800 border-emerald-200 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Depletion-Based
                </Badge>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sale Depletions</span>
                  <span className="font-medium text-red-600">
                    ${(depletionCOGS.saleDepletion / 100).toFixed(2)}
                  </span>
                </div>
                {depletionCOGS.refundReversal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">− Refund Reversals</span>
                    <span className="font-medium text-green-600">
                      −${(depletionCOGS.refundReversal / 100).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-1.5">
                  <span>Net COGS</span>
                  <span>${(depletionCOGS.net / 100).toFixed(2)}</span>
                </div>
              </div>
              {depletionLoading && (
                <p className="text-xs text-muted-foreground italic">Updating…</p>
              )}
              <div className="flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 rounded p-2">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Computed from real ingredient depletions (Square POS → stock movements). Most accurate method.
              </div>
            </Card>
          ) : (
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">Actual COGS</h3>
                <Badge variant="outline" className="text-xs">Opening + Purchases − Closing − Waste</Badge>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Opening Stock</span>
                  <span className="font-medium">
                    {actualCOGS.hasStockCounts
                      ? `$${(actualCOGS.openingStock / 100).toFixed(2)}`
                      : <span className="text-muted-foreground italic">no stock count</span>}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">+ Purchases Received</span>
                  <span className="font-medium text-green-600">
                    +${(actualCOGS.purchases / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">− Closing Stock</span>
                  <span className="font-medium text-red-600">
                    {actualCOGS.hasStockCounts
                      ? `−$${(actualCOGS.closingStock / 100).toFixed(2)}`
                      : <span className="text-muted-foreground italic">no stock count</span>}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">− Waste Logged</span>
                  <span className="font-medium text-red-600">
                    {actualCOGS.waste > 0
                      ? `−$${(actualCOGS.waste / 100).toFixed(2)}`
                      : <span className="text-muted-foreground">$0.00</span>}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-1.5">
                  <span>Actual COGS</span>
                  <span>${(actualCOGS.total / 100).toFixed(2)}</span>
                </div>
              </div>
              {!actualCOGS.hasStockCounts && (
                <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 rounded p-2">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  No stock counts for this period. COGS = Purchases − Waste only.
                </div>
              )}
              {!depletionCOGS && (
                <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 rounded p-2">
                  <Zap className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Connect Square POS and process the depletion queue for more accurate ingredient-level COGS.
                </div>
              )}
            </Card>
          )}

          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Theoretical COGS</h3>
              <Badge variant="outline" className="text-xs">
                {theoreticalCOGS.hasDetailedData ? 'Recipes × Sales' : 'Revenue × 28%'}
              </Badge>
            </div>
            {!theoreticalCOGS.hasDetailedData && (
              <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 rounded p-2">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                No POS order line items found. Using revenue × 28% industry estimate. Connect Square POS
                for recipe-level costing.
              </div>
            )}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between font-bold text-base">
                <span>Theoretical COGS</span>
                <span>${(theoreticalCOGS.total / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">vs {cogsIsDepletion ? 'Depletion-Based' : 'Actual'}</span>
                <span
                  className={`font-semibold ${
                    overallVariancePct > varianceThreshold
                      ? 'text-red-600'
                      : overallVariancePct < -varianceThreshold
                      ? 'text-green-600'
                      : 'text-muted-foreground'
                  }`}
                >
                  {overallVariancePct > 0 ? '+' : ''}
                  {overallVariancePct.toFixed(1)}% variance
                  {Math.abs(overallVariancePct) > varianceThreshold && (
                    <AlertTriangle className="h-3.5 w-3.5 inline ml-1" />
                  )}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Charts */}
        {trendData.length > 1 && (
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-4">Cost Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: number) => [`$${v}`, '']} />
                <Legend />
                <Line type="monotone" dataKey="actual" name="Actual Purchases ($)" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="waste" name="Waste ($)" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Category breakdown chart */}
        {categoryVariance.length > 0 && (
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-4">Actual Cost by Category</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryVariance} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} />
                <Tooltip formatter={(v: number) => [`$${(v / 100).toFixed(2)}`, '']} />
                <Legend />
                <Bar dataKey="actual" name="Actual ($)" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="theoretical" name="Theoretical ($)" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Variance table */}
        <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
          <TabsList>
            <TabsTrigger value="category">By Category</TabsTrigger>
            <TabsTrigger value="ingredient">By Ingredient</TabsTrigger>
          </TabsList>

          <TabsContent value="category">
            <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 dark:bg-slate-800/80">
                    <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Category</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider font-medium text-muted-foreground">Actual Cost</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider font-medium text-muted-foreground">Theoretical</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider font-medium text-muted-foreground">Variance $</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider font-medium text-muted-foreground">Variance %</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryVariance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No data for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    categoryVariance.map((row) => (
                      <TableRow key={row.category}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell className="text-right">${(row.actual / 100).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          ${(row.theoretical / 100).toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold ${
                            row.variance > 0 ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {row.variance > 0 ? '+' : ''}${(row.variance / 100).toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold ${
                            Math.abs(row.variancePct) > varianceThreshold
                              ? row.variance > 0 ? 'text-red-600' : 'text-green-600'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {row.variancePct > 0 ? '+' : ''}{row.variancePct.toFixed(1)}%
                        </TableCell>
                        <TableCell>
                          {Math.abs(row.variancePct) > varianceThreshold ? (
                            <Badge variant={row.variance > 0 ? 'destructive' : 'default'}>
                              {row.variance > 0 ? (
                                <><TrendingUp className="h-3 w-3 mr-1" />Over</>
                              ) : (
                                <><TrendingDown className="h-3 w-3 mr-1" />Under</>
                              )}
                            </Badge>
                          ) : (
                            <Badge variant="outline">On Track</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="ingredient">
            <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 dark:bg-slate-800/80">
                    <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Ingredient</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Category</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider font-medium text-muted-foreground">Actual Cost</TableHead>
                    {cogsIsDepletion && <TableHead className="text-right text-xs uppercase tracking-wider font-medium text-muted-foreground">Depletion COGS</TableHead>}
                    <TableHead className="text-right text-xs uppercase tracking-wider font-medium text-muted-foreground">Theoretical</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider font-medium text-muted-foreground">Variance $</TableHead>
                    <TableHead className="text-right text-xs uppercase tracking-wider font-medium text-muted-foreground">Variance %</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Flag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredientVariance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={cogsIsDepletion ? 8 : 7} className="text-center py-8 text-muted-foreground">
                        No data for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    ingredientVariance.map((row) => {
                      const flagged = Math.abs(row.variancePct) > varianceThreshold
                      return (
                        <TableRow
                          key={row.id}
                          className={flagged ? 'bg-red-50/30 dark:bg-red-950/20' : ''}
                        >
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {CATEGORY_LABELS[row.category] || row.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">${(row.actualCost / 100).toFixed(2)}</TableCell>
                          {cogsIsDepletion && (
                            <TableCell className="text-right text-emerald-700 dark:text-emerald-400 font-medium">
                              {row.depletionCost !== null && row.depletionCost > 0
                                ? `$${(row.depletionCost / 100).toFixed(2)}`
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                          )}
                          <TableCell className="text-right text-muted-foreground">
                            ${(row.theoreticalCost / 100).toFixed(2)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold ${
                              row.variance > 0 ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {row.variance > 0 ? '+' : ''}${(row.variance / 100).toFixed(2)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold ${
                              flagged
                                ? row.variance > 0 ? 'text-red-600' : 'text-green-600'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {row.variancePct > 0 ? '+' : ''}{row.variancePct.toFixed(1)}%
                          </TableCell>
                          <TableCell>
                            {flagged && (
                              <AlertTriangle
                                className={`h-4 w-4 ${row.variance > 0 ? 'text-red-500' : 'text-green-500'}`}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  )
}
