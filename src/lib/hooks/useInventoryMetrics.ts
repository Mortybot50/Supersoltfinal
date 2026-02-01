import { useMemo } from 'react'
import { useDataStore } from '@/lib/store/dataStore'
import * as calc from '@/lib/utils/calculations'
import type { InventoryMetrics, DateRangeFilter } from '@/types'

export function useInventoryMetrics(dateRange?: DateRangeFilter): InventoryMetrics | null {
  const { ingredients, wasteLogs, isLoading } = useDataStore()
  
  return useMemo(() => {
    if (isLoading || ingredients.length === 0) return null
    
    const totalStockValue = calc.calculateTotalStockValue(ingredients)
    const itemsBelowPar = calc.calculateItemsBelowPar(ingredients)
    const itemsToOrder = calc.calculateItemsToOrder(ingredients)
    
    // Filter waste logs by date range if provided
    let filteredWasteLogs = wasteLogs
    if (dateRange) {
      filteredWasteLogs = wasteLogs.filter(log => {
        const wasteDate = new Date(log.waste_date)
        return wasteDate >= dateRange.startDate && wasteDate <= dateRange.endDate
      })
    }
    
    const totalWasteValue = calc.calculateTotalWasteValue(filteredWasteLogs)
    
    return {
      total_stock_value: totalStockValue,
      items_below_par: itemsBelowPar,
      items_to_order: itemsToOrder,
      total_waste_value: totalWasteValue,
      stock_turnover_days: 0 // Calculate when we have historical data
    }
  }, [ingredients, wasteLogs, isLoading, dateRange])
}
