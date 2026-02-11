import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDataStore } from '@/lib/store/dataStore'
import { StockCount, StockCountItem, Ingredient } from '@/types'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'
import { PageShell, PageToolbar } from '@/components/shared'

const CATEGORY_ORDER = ['produce', 'meat', 'seafood', 'dairy', 'dry-goods', 'beverages', 'other']
const CATEGORY_LABELS: Record<string, string> = {
  produce: 'Produce (Cool Room)',
  meat: 'Protein (Cool Room)',
  seafood: 'Seafood (Cool Room)',
  dairy: 'Dairy (Cool Room)',
  'dry-goods': 'Dry Goods (Dry Store)',
  beverages: 'Beverages (Bar/Storage)',
  other: 'Other',
}

export default function NewStockCount() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { suppliers, ingredients, stockCounts, wasteLogs, purchaseOrders, addStockCount, completeStockCount, loadIngredientsFromDB } = useDataStore()

  const [countType, setCountType] = useState<'full' | 'cycle'>('full')
  const [supplierId, setSupplierId] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [notes, setNotes] = useState('')
  const [countedQuantities, setCountedQuantities] = useState<Record<string, number>>({})
  const [varianceNotes, setVarianceNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    loadIngredientsFromDB()
  }, [])

  // Get ingredients to count based on filters
  const ingredientsToCount = useMemo(() => {
    let items = ingredients.filter((i) => i.active)
    if (supplierId !== 'all') {
      items = items.filter((i) => i.supplier_id === supplierId)
    }
    if (categoryFilter !== 'all') {
      items = items.filter((i) => i.category === categoryFilter)
    }
    return items
  }, [ingredients, supplierId, categoryFilter])

  // Group by category for display
  const groupedIngredients = useMemo(() => {
    const groups: Record<string, Ingredient[]> = {}
    ingredientsToCount.forEach((ing) => {
      const cat = ing.category || 'other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(ing)
    })
    // Sort by category order
    const sorted: [string, Ingredient[]][] = CATEGORY_ORDER
      .filter((cat) => groups[cat]?.length > 0)
      .map((cat) => [cat, groups[cat].sort((a, b) => a.name.localeCompare(b.name))])
    return sorted
  }, [ingredientsToCount])

  // Initialize counted quantities with current stock
  useMemo(() => {
    const initial: Record<string, number> = {}
    ingredientsToCount.forEach((ingredient) => {
      if (!(ingredient.id in countedQuantities)) {
        initial[ingredient.id] = ingredient.current_stock
      }
    })
    if (Object.keys(initial).length > 0) {
      setCountedQuantities(prev => ({ ...prev, ...initial }))
    }
  }, [ingredientsToCount])

  const handleQuantityChange = (ingredientId: string, value: number) => {
    setCountedQuantities({
      ...countedQuantities,
      [ingredientId]: value,
    })
  }

  // Calculate variance percentage for highlighting
  const getVariancePercent = (expected: number, actual: number) => {
    if (expected === 0) return actual > 0 ? 100 : 0
    return ((actual - expected) / expected) * 100
  }

  // Compute running totals
  const totals = useMemo(() => {
    let totalValue = 0
    let totalVariance = 0
    let largeVarianceCount = 0
    ingredientsToCount.forEach((ing) => {
      const counted = countedQuantities[ing.id] || 0
      const value = counted * ing.cost_per_unit
      totalValue += value
      const variance = (counted - ing.current_stock) * ing.cost_per_unit
      totalVariance += variance
      const varPct = Math.abs(getVariancePercent(ing.current_stock, counted))
      if (varPct > 10 && ing.current_stock > 0) largeVarianceCount++
    })
    return { totalValue, totalVariance, largeVarianceCount }
  }, [ingredientsToCount, countedQuantities])

  const handleSave = async (status: 'in-progress' | 'completed') => {
    if (ingredientsToCount.length === 0) {
      toast.error('No ingredients to count')
      return
    }

    // Check for large variances needing notes
    if (status === 'completed') {
      const missingNotes: string[] = []
      ingredientsToCount.forEach((ing) => {
        const counted = countedQuantities[ing.id] || 0
        const varPct = Math.abs(getVariancePercent(ing.current_stock, counted))
        if (varPct > 10 && ing.current_stock > 0 && !varianceNotes[ing.id]) {
          missingNotes.push(ing.name)
        }
      })
      if (missingNotes.length > 0 && missingNotes.length <= 3) {
        toast.error(`Add variance notes for: ${missingNotes.join(', ')}`)
        return
      }
      if (missingNotes.length > 3) {
        toast.error(`${missingNotes.length} items with large variances need notes`)
        return
      }
    }

    const today = format(new Date(), 'yyyyMMdd')
    const todayCounts = stockCounts.filter((sc) => sc.count_number.includes(today))
    const sequence = todayCounts.length + 1
    const countNumber = `SC-${today}-${sequence.toString().padStart(3, '0')}`

    const userName = profile?.first_name
      ? `${profile.first_name} ${profile.last_name || ''}`.trim()
      : 'Manager'

    const items: StockCountItem[] = ingredientsToCount.map((ingredient) => {
      const countedQty = countedQuantities[ingredient.id] || 0
      const expectedQty = ingredient.current_stock
      const variance = countedQty - expectedQty
      const varianceValue = variance * ingredient.cost_per_unit

      return {
        id: crypto.randomUUID(),
        stock_count_id: '',
        ingredient_id: ingredient.id,
        ingredient_name: ingredient.name,
        expected_quantity: expectedQty,
        actual_quantity: countedQty,
        variance,
        variance_value: varianceValue,
      }
    })

    const totalVarianceValue = items.reduce((sum, item) => sum + item.variance_value, 0)
    const totalCountValue = items.reduce((sum, item) => {
      const ing = ingredients.find(i => i.id === item.ingredient_id)
      return sum + (item.actual_quantity * (ing?.cost_per_unit || 0))
    }, 0)

    const stockCount: StockCount = {
      id: crypto.randomUUID(),
      venue_id: 'VENUE-001',
      count_number: countNumber,
      count_date: new Date(),
      count_type: countType,
      status,
      counted_by_user_id: 'current-user',
      counted_by_name: userName,
      items,
      total_variance_value: totalVarianceValue,
      total_count_value: totalCountValue,
      notes: notes || undefined,
    }

    items.forEach(item => item.stock_count_id = stockCount.id)

    try {
      await addStockCount(stockCount)

      if (status === 'completed') {
        await completeStockCount(stockCount.id)
        toast.success('Stock count completed and inventory updated')
      } else {
        toast.success('Stock count saved as draft')
      }

      navigate('/inventory/stock-counts')
    } catch (error) {
      toast.error('Failed to save stock count')
      console.error(error)
    }
  }

  const toolbar = (
    <PageToolbar
      title="New Stock Count"
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => navigate('/inventory/stock-counts')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Value: </span>
              <span className="font-bold">${(totals.totalValue / 100).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Variance: </span>
              <span className={`font-bold ${totals.totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totals.totalVariance >= 0 ? '+' : ''}${(Math.abs(totals.totalVariance) / 100).toFixed(2)}
              </span>
            </div>
            {totals.largeVarianceCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {totals.largeVarianceCount} large
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => handleSave('in-progress')}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
        </>
      }
      primaryAction={{
        label: 'Complete Count',
        onClick: () => handleSave('completed'),
        variant: 'primary',
      }}
    />
  )

  return (
    <PageShell toolbar={toolbar}>

      {/* Settings bar */}
      <div className="bg-white dark:bg-gray-800 border-b px-6 py-2 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Type:</Label>
          <Select value={countType} onValueChange={(v: 'full' | 'cycle') => setCountType(v)}>
            <SelectTrigger className="h-7 w-[100px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full Count</SelectItem>
              <SelectItem value="cycle">Cycle Count</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Supplier:</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger className="h-7 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Category:</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-7 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORY_ORDER.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] || cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Label className="text-xs">Items:</Label>
          <span className="text-sm font-bold">{ingredientsToCount.length}</span>
        </div>
      </div>

      {/* Count Table */}
      <div className="flex-1 overflow-auto p-4">
        {ingredientsToCount.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">
              No ingredients available. Select a different supplier or category, or add ingredients first.
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {groupedIngredients.map(([category, items]) => (
              <Card key={category} className="overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 border-b">
                  <h3 className="font-semibold text-sm">
                    {CATEGORY_LABELS[category] || category}
                    <Badge variant="outline" className="ml-2 text-xs">{items.length}</Badge>
                  </h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">Ingredient</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>System Qty</TableHead>
                      <TableHead>Counted Qty</TableHead>
                      <TableHead>Variance</TableHead>
                      <TableHead>Var %</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((ingredient) => {
                      const countedQty = countedQuantities[ingredient.id] || 0
                      const expectedQty = ingredient.current_stock
                      const variance = countedQty - expectedQty
                      const varianceValue = variance * ingredient.cost_per_unit
                      const varPct = getVariancePercent(expectedQty, countedQty)
                      const isLargeVariance = Math.abs(varPct) > 10 && expectedQty > 0

                      return (
                        <TableRow
                          key={ingredient.id}
                          className={isLargeVariance ? 'bg-red-50/50 dark:bg-red-950/20' : ''}
                        >
                          <TableCell className="font-medium">{ingredient.name}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {ingredient.product_code || '—'}
                          </TableCell>
                          <TableCell>{ingredient.unit}</TableCell>
                          <TableCell className="text-muted-foreground">{expectedQty}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              value={countedQty}
                              onChange={(e) =>
                                handleQuantityChange(ingredient.id, parseFloat(e.target.value) || 0)
                              }
                              className={`w-24 ${isLargeVariance ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                            />
                          </TableCell>
                          <TableCell>
                            <span
                              className={`font-semibold ${
                                variance > 0 ? 'text-green-600' : variance < 0 ? 'text-red-600' : ''
                              }`}
                            >
                              {variance > 0 ? '+' : ''}{variance.toFixed(1)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-xs font-semibold ${
                                isLargeVariance ? 'text-red-600' : ''
                              }`}
                            >
                              {varPct > 0 ? '+' : ''}{varPct.toFixed(0)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-xs font-semibold ${
                                varianceValue > 0 ? 'text-green-600' : varianceValue < 0 ? 'text-red-600' : ''
                              }`}
                            >
                              {varianceValue > 0 ? '+' : ''}${(Math.abs(varianceValue) / 100).toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {isLargeVariance && (
                              <Input
                                placeholder="Explain..."
                                value={varianceNotes[ingredient.id] || ''}
                                onChange={(e) =>
                                  setVarianceNotes({ ...varianceNotes, [ingredient.id]: e.target.value })
                                }
                                className="w-32 h-7 text-xs border-red-300"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Card>
            ))}

            {/* Notes */}
            <Card className="p-4">
              <Label htmlFor="notes">Count Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes about this count..."
                rows={2}
                className="mt-2"
              />
            </Card>
          </div>
        )}
      </div>
    </PageShell>
  )
}
