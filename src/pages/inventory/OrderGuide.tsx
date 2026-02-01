import { useState, useMemo, useEffect } from 'react'
import { ShoppingCart, AlertTriangle, Calendar, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { useDataStore } from '@/lib/store/dataStore'
import {
  calculateUsagePerThousandSales,
  calculateEstimatedUsage,
  getNextDeliveryDate,
  calculateRecommendedQuantity,
  determineUrgency,
  generatePONumber,
  calculateGST,
} from '@/lib/utils/orderCalculations'
import { format, differenceInDays, subDays } from 'date-fns'
import { toast } from 'sonner'
import type { OrderRecommendation } from '@/types'

export default function OrderGuide() {
  const { suppliers, ingredients, purchaseOrders, orders, loadSuppliersFromDB, loadIngredientsFromDB, loadPurchaseOrdersFromDB } = useDataStore()
  
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({})
  
  // Load data from Supabase on mount
  useEffect(() => {
    loadSuppliersFromDB()
    loadIngredientsFromDB()
    loadPurchaseOrdersFromDB()
  }, [])
  
  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId)
  
  // Calculate sales forecast for next 7 days
  const salesForecast = useMemo(() => {
    // Use last 30 days of sales
    const thirtyDaysAgo = subDays(new Date(), 30)
    const recentSales = orders
      .filter((o) => new Date(o.order_datetime) >= thirtyDaysAgo && !o.is_void && !o.is_refund)
      .reduce((sum, o) => sum + o.gross_amount / 100, 0)
    
    // Daily average
    const dailyAverage = recentSales / 30
    
    // Forecast next 7 days
    return dailyAverage * 7
  }, [orders])
  
  // Get supplier products and calculate recommendations
  const orderRecommendations = useMemo(() => {
    if (!selectedSupplier) return []
    
    const supplierProducts = ingredients.filter(
      (p) => p.supplier_id === selectedSupplierId && p.active
    )
    
    const nextDelivery = getNextDeliveryDate(selectedSupplier)
    const daysUntilDelivery = differenceInDays(nextDelivery, new Date())
    
    return supplierProducts.map((product): OrderRecommendation => {
      // Mock historical usage (in real app, would calculate from inventory transactions)
      const productUsage = 5
      
      // Calculate usage per $1000 sales
      const thirtyDaysAgo = subDays(new Date(), 30)
      const thirtyDaySales = orders
        .filter((o) => new Date(o.order_datetime) >= thirtyDaysAgo && !o.is_void && !o.is_refund)
        .reduce((sum, o) => sum + o.gross_amount / 100, 0)
      
      const usagePerThousand = calculateUsagePerThousandSales(
        productUsage,
        thirtyDaySales
      )
      
      // Estimate usage for forecast period
      const estimatedUsage = calculateEstimatedUsage(
        salesForecast,
        usagePerThousand
      )
      
      // Calculate recommended quantity
      const recommended = calculateRecommendedQuantity(
        product.current_stock,
        product.par_level,
        estimatedUsage,
        daysUntilDelivery
      )
      
      // Determine urgency
      const urgency = determineUrgency(
        product.current_stock,
        product.par_level,
        product.reorder_point || product.par_level * 0.5,
        estimatedUsage,
        daysUntilDelivery
      )
      
      return {
        product,
        current_stock: product.current_stock,
        par_level: product.par_level,
        usage_per_thousand_sales: usagePerThousand,
        forecasted_sales: salesForecast,
        estimated_usage: estimatedUsage,
        days_until_delivery: daysUntilDelivery,
        recommended_quantity: recommended,
        estimated_cost: recommended * product.cost_per_unit,
        urgency,
      }
    })
    .sort((a, b) => {
      // Sort by urgency first
      const urgencyOrder = { critical: 0, low: 1, adequate: 2, overstocked: 3 }
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    })
  }, [selectedSupplier, ingredients, orders, salesForecast])
  
  const handleToggleProduct = (productId: string) => {
    setSelectedProducts((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) {
        newSet.delete(productId)
      } else {
        newSet.add(productId)
      }
      return newSet
    })
  }
  
  const handleQuantityChange = (productId: string, quantity: number) => {
    setCustomQuantities((prev) => ({
      ...prev,
      [productId]: quantity,
    }))
  }
  
  const getOrderQuantity = (recommendation: OrderRecommendation) => {
    return customQuantities[recommendation.product.id] ?? recommendation.recommended_quantity
  }
  
  const handleCreateOrder = async () => {
    if (!selectedSupplier) return
    
    if (selectedProducts.size === 0) {
      toast.error('Select at least one product')
      return
    }
    
    const items: any[] = []
    
    selectedProducts.forEach((productId) => {
      const recommendation = orderRecommendations.find(
        (r) => r.product.id === productId
      )
      if (!recommendation) return
      
      const quantity = getOrderQuantity(recommendation)
      if (quantity <= 0) return
      
      items.push({
        id: crypto.randomUUID(),
        purchase_order_id: '',
        ingredient_id: recommendation.product.id,
        ingredient_name: recommendation.product.name,
        product_code: recommendation.product.product_code,
        quantity_ordered: quantity,
        quantity_received: 0,
        unit: recommendation.product.unit,
        unit_cost: recommendation.product.cost_per_unit,
        line_total: quantity * recommendation.product.cost_per_unit,
      })
    })
    
    if (items.length === 0) {
      toast.error('No items to order')
      return
    }
    
    const subtotal = items.reduce((sum, item) => sum + item.line_total, 0)
    const taxAmount = items.reduce(
      (sum, item) => sum + calculateGST(item.line_total, true),
      0
    )
    const total = subtotal + taxAmount
    
    const poId = crypto.randomUUID()
    const po: any = {
      id: poId,
      po_number: generatePONumber(purchaseOrders),
      venue_id: 'main-venue',
      supplier_id: selectedSupplierId,
      supplier_name: selectedSupplier.name,
      order_date: new Date(),
      expected_delivery_date: getNextDeliveryDate(selectedSupplier),
      status: 'draft',
      subtotal,
      tax_amount: taxAmount,
      total,
      notes: '',
      created_by: 'current-user',
      created_by_name: 'Manager',
      created_at: new Date(),
      updated_at: new Date(),
    }
    
    // Update items with PO ID
    items.forEach(item => {
      item.purchase_order_id = poId
    })
    
    try {
      const { addPurchaseOrder } = useDataStore.getState()
      await addPurchaseOrder(po, items)
      toast.success(`Purchase order ${po.po_number} created`)
      
      // Reset selections
      setSelectedProducts(new Set())
      setCustomQuantities({})
    } catch (error) {
      toast.error('Failed to create purchase order')
      console.error(error)
    }
  }
  
  const totalOrderValue = useMemo(() => {
    let sum = 0
    selectedProducts.forEach((productId) => {
      const recommendation = orderRecommendations.find(
        (r) => r.product.id === productId
      )
      if (!recommendation) return
      
      const quantity = getOrderQuantity(recommendation)
      sum += quantity * recommendation.product.cost_per_unit
    })
    return sum
  }, [selectedProducts, orderRecommendations, customQuantities])
  
  const urgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>
      case 'low':
        return <Badge className="bg-yellow-500">Low Stock</Badge>
      case 'adequate':
        return <Badge variant="default">Adequate</Badge>
      case 'overstocked':
        return <Badge variant="secondary">Overstocked</Badge>
    }
  }
  
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Order Guide</h1>
          <p className="text-muted-foreground">
            Intelligent ordering based on sales forecasts and usage patterns
          </p>
        </div>
      </div>
      
      {/* Supplier Selection */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">
              Select Supplier
            </label>
            <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a supplier..." />
              </SelectTrigger>
              <SelectContent>
                {suppliers
                  .filter((s) => s.active)
                  .map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedSupplier && (
            <Card className="p-4 bg-blue-50 dark:bg-blue-950">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4" />
                <p className="text-sm font-medium">Next Delivery</p>
              </div>
              <p className="text-2xl font-bold">
                {format(getNextDeliveryDate(selectedSupplier), 'EEE, dd MMM')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {differenceInDays(getNextDeliveryDate(selectedSupplier), new Date())}{' '}
                days away
              </p>
            </Card>
          )}
          
          {selectedSupplier && salesForecast > 0 && (
            <Card className="p-4 bg-green-50 dark:bg-green-950">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4" />
                <p className="text-sm font-medium">Sales Forecast</p>
              </div>
              <p className="text-2xl font-bold">
                ${salesForecast.toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Next 7 days
              </p>
            </Card>
          )}
        </div>
      </Card>
      
      {/* Products Table */}
      {selectedSupplier && orderRecommendations.length > 0 && (
        <>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Products</h2>
              <div className="flex gap-2">
                <Badge variant="outline">
                  {selectedProducts.size} selected
                </Badge>
                {totalOrderValue > 0 && (
                  <Badge>
                    Total: ${(totalOrderValue / 100).toFixed(2)}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Par Level</TableHead>
                    <TableHead>Usage/week</TableHead>
                    <TableHead>Recommended</TableHead>
                    <TableHead>Order Qty</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderRecommendations.map((rec) => {
                    const orderQty = getOrderQuantity(rec)
                    const isSelected = selectedProducts.has(rec.product.id)
                    
                    return (
                      <TableRow
                        key={rec.product.id}
                        className={isSelected ? 'bg-blue-50 dark:bg-blue-950' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleProduct(rec.product.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{rec.product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {rec.product.unit} | $
                              {(rec.product.cost_per_unit / 100).toFixed(2)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              rec.current_stock < (rec.product.reorder_point || rec.product.par_level * 0.5)
                                ? 'text-red-600 font-semibold'
                                : ''
                            }
                          >
                            {rec.current_stock} {rec.product.unit}
                          </span>
                        </TableCell>
                        <TableCell>
                          {rec.par_level} {rec.product.unit}
                        </TableCell>
                        <TableCell>
                          {rec.estimated_usage.toFixed(1)} {rec.product.unit}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-blue-600">
                            {rec.recommended_quantity} {rec.product.unit}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={orderQty}
                            onChange={(e) =>
                              handleQuantityChange(
                                rec.product.id,
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          ${((orderQty * rec.product.cost_per_unit) / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>{urgencyBadge(rec.urgency)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
          
          {selectedProducts.size > 0 && (
            <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Order Summary</h3>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Items:</span>{' '}
                      <span className="font-semibold">{selectedProducts.size}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Subtotal:</span>{' '}
                      <span className="font-semibold">
                        ${(totalOrderValue / 100).toFixed(2)}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">GST (10%):</span>{' '}
                      <span className="font-semibold">
                        ${(calculateGST(totalOrderValue, true) / 100).toFixed(2)}
                      </span>
                    </p>
                    <p className="text-lg">
                      <span className="text-muted-foreground">Total:</span>{' '}
                      <span className="font-bold">
                        ${((totalOrderValue + calculateGST(totalOrderValue, true)) / 100).toFixed(2)}
                      </span>
                    </p>
                  </div>
                </div>
                <Button size="lg" onClick={handleCreateOrder}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Create Purchase Order
                </Button>
              </div>
            </Card>
          )}
        </>
      )}
      
      {selectedSupplier && orderRecommendations.length === 0 && (
        <Card className="p-12 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Products Found</h3>
          <p className="text-sm text-muted-foreground">
            This supplier has no active products. Add products to this supplier in the Ingredients page.
          </p>
        </Card>
      )}
      
      {!selectedSupplier && (
        <Card className="p-12 text-center">
          <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Select a Supplier</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Choose a supplier above to see their products and ordering recommendations
          </p>
          {suppliers.length === 0 && (
            <Button onClick={() => (window.location.href = '/suppliers')}>
              Add Suppliers
            </Button>
          )}
        </Card>
      )}
    </div>
  )
}
