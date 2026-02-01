import { useMemo } from 'react'
import { useDataStore } from '@/lib/store/dataStore'
import * as calc from '@/lib/utils/cogsCalculations'
import type { COGSMetrics } from '@/types/cogs.types'

interface COGSFilters {
  dateRange?: {
    startDate: Date
    endDate: Date
  }
}

export function useCOGSMetrics(filters?: COGSFilters): COGSMetrics | null {
  const {
    orders,
    orderItems,
    recipes,
    recipeIngredients,
    ingredients,
    purchaseOrders,
    wasteLogs,
    stockCounts,
    isLoading
  } = useDataStore()
  
  return useMemo(() => {
    if (isLoading || orders.length === 0) return null
    
    // Apply filters
    let filteredOrders = orders
    let filteredPOs = purchaseOrders
    let filteredWaste = wasteLogs
    
    if (filters?.dateRange) {
      filteredOrders = filteredOrders.filter(o => {
        const orderDate = new Date(o.order_datetime)
        return orderDate >= filters.dateRange!.startDate && 
               orderDate <= filters.dateRange!.endDate
      })
      
      filteredPOs = filteredPOs.filter(po => {
        if (po.status !== 'delivered') return false
        const orderDate = new Date(po.order_date)
        return orderDate >= filters.dateRange!.startDate && 
               orderDate <= filters.dateRange!.endDate
      })
      
      filteredWaste = filteredWaste.filter(w => {
        const wasteDate = new Date(w.waste_date)
        return wasteDate >= filters.dateRange!.startDate && 
               wasteDate <= filters.dateRange!.endDate
      })
    }
    
    // Calculate components
    const theoreticalCOGS = calc.calculateTheoreticalCOGS(
      filteredOrders,
      orderItems,
      recipes,
      recipeIngredients
    )
    
    const openingStock = calc.calculateOpeningStockValue(ingredients)
    const purchases = calc.calculatePurchasesValue(filteredPOs)
    const closingStock = calc.calculateClosingStockValue(stockCounts[0], ingredients)
    const waste = calc.calculateWasteValue(filteredWaste)
    
    const actualCOGS = calc.calculateActualCOGS(
      openingStock,
      purchases,
      closingStock,
      waste
    )
    
    const variance = calc.calculateCOGSVariance(actualCOGS, theoreticalCOGS)
    
    const totalSales = filteredOrders
      .filter(o => !o.is_void)
      .reduce((sum, o) => sum + (o.is_refund ? 0 : o.net_amount), 0)
    
    const theoreticalPercent = calc.calculateCOGSPercent(theoreticalCOGS, totalSales)
    const actualPercent = calc.calculateCOGSPercent(actualCOGS, totalSales)
    
    return {
      theoretical_cogs: theoreticalCOGS,
      actual_cogs: actualCOGS,
      variance: variance.variance_value,
      variance_percent: variance.variance_percent || 0,
      theoretical_cogs_percent: theoreticalPercent || 0,
      actual_cogs_percent: actualPercent || 0,
      target_cogs_percent: 28,
      total_waste_value: waste,
      waste_percent_of_cogs: actualCOGS !== 0 ? (waste / actualCOGS) * 100 : 0,
      vs_previous_period: {
        cogs_change: 0,
        cogs_percent_change: 0
      },
      vs_target: {
        variance: (actualPercent || 0) - 28,
        on_track: (actualPercent || 0) <= 30
      }
    }
  }, [
    orders,
    orderItems,
    recipes,
    recipeIngredients,
    ingredients,
    purchaseOrders,
    wasteLogs,
    stockCounts,
    isLoading,
    filters
  ])
}
