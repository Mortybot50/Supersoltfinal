import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDataStore } from '@/lib/store/dataStore'
import { StockCount, StockCountItem } from '@/types'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function NewStockCount() {
  const navigate = useNavigate()
  const { suppliers, ingredients, stockCounts, addStockCount, completeStockCount, loadIngredientsFromDB } = useDataStore()
  
  const [supplierId, setSupplierId] = useState<string>('all')
  const [notes, setNotes] = useState('')
  const [countedQuantities, setCountedQuantities] = useState<Record<string, number>>({})
  
  // Load ingredients on mount
  useEffect(() => {
    loadIngredientsFromDB()
  }, [])
  // Get ingredients to count
  const ingredientsToCount = useMemo(() => {
    if (supplierId === 'all') {
      return ingredients.filter((i) => i.active)
    }
    return ingredients.filter((i) => i.supplier_id === supplierId && i.active)
  }, [ingredients, supplierId])
  
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
  
  const handleSave = async (status: 'in-progress' | 'completed') => {
    if (ingredientsToCount.length === 0) {
      toast.error('No ingredients to count')
      return
    }
    
    // Generate count number
    const today = format(new Date(), 'yyyyMMdd')
    const todayCounts = stockCounts.filter((sc) => sc.count_number.includes(today))
    const sequence = todayCounts.length + 1
    const countNumber = `SC-${today}-${sequence.toString().padStart(3, '0')}`
    
    // Build count items
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

    const stockCount: StockCount = {
      id: crypto.randomUUID(),
      venue_id: 'VENUE-001',
      count_number: countNumber,
      count_date: new Date(),
      status,
      counted_by_user_id: 'current-user',
      counted_by_name: 'J Smith',
      items,
      total_variance_value: totalVarianceValue,
      notes: notes || undefined,
    }
    
    // Set stock_count_id on items
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
  
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/inventory/stock-counts')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">New Stock Count</h1>
            <p className="text-sm text-muted-foreground">
              Count physical inventory and update stock levels
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave('in-progress')}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button onClick={() => handleSave('completed')}>
            Complete Count
          </Button>
        </div>
      </div>
      
      {/* Settings */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="supplier">Supplier (Optional)</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger id="supplier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ingredients</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Ingredients to Count</Label>
            <div className="h-10 flex items-center">
              <span className="text-2xl font-bold">{ingredientsToCount.length}</span>
            </div>
          </div>
        </div>
        
        <div className="mt-4">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about this count..."
            rows={2}
          />
        </div>
      </Card>
      
      {/* Count Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Count Items</h3>
        
        {ingredientsToCount.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No ingredients available. Please select a supplier or add ingredients first.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Expected Qty</TableHead>
                  <TableHead>Counted Qty</TableHead>
                  <TableHead>Variance</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredientsToCount.map((ingredient) => {
                  const countedQty = countedQuantities[ingredient.id] || 0
                  const expectedQty = ingredient.current_stock
                  const variance = countedQty - expectedQty
                  const varianceValue = variance * ingredient.cost_per_unit
                  
                  return (
                    <TableRow key={ingredient.id}>
                      <TableCell className="font-medium">{ingredient.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {ingredient.product_code || '—'}
                      </TableCell>
                      <TableCell>{ingredient.unit}</TableCell>
                      <TableCell>{expectedQty}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={countedQty}
                          onChange={(e) =>
                            handleQuantityChange(ingredient.id, parseFloat(e.target.value) || 0)
                          }
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-semibold ${
                            variance > 0
                              ? 'text-green-600'
                              : variance < 0
                              ? 'text-red-600'
                              : ''
                          }`}
                        >
                          {variance > 0 ? '+' : ''}
                          {variance.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-semibold ${
                            varianceValue > 0
                              ? 'text-green-600'
                              : varianceValue < 0
                              ? 'text-red-600'
                              : ''
                          }`}
                        >
                          {varianceValue > 0 ? '+' : ''}$
                          {(Math.abs(varianceValue) / 100).toFixed(2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}
