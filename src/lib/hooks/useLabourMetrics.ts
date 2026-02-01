import { useMemo } from 'react'
import { useDataStore } from '@/lib/store/dataStore'
import * as calc from '@/lib/utils/calculations'
import type { LabourMetrics, GeneralFilters } from '@/types'

export function useLabourMetrics(filters?: GeneralFilters): LabourMetrics | null {
  const { timesheets, staff, orders, isLoading } = useDataStore()
  
  return useMemo(() => {
    if (isLoading || timesheets.length === 0) return null
    
    let filteredTimesheets = timesheets.filter(t => t.status === 'approved')
    
    if (filters?.dateRange) {
      filteredTimesheets = filteredTimesheets.filter(t => {
        const shiftDate = new Date(t.date)
        return shiftDate >= filters.dateRange!.startDate && 
               shiftDate <= filters.dateRange!.endDate
      })
    }
    
    if (filters?.venues && filters.venues.length > 0) {
      filteredTimesheets = filteredTimesheets.filter(t => 
        filters.venues!.includes(t.venue_id)
      )
    }
    
    const totalHours = calc.calculateTotalLabourHours(filteredTimesheets)
    const totalCost = calc.calculateTotalLabourCost(filteredTimesheets)
    const avgHourlyRate = totalHours > 0 ? totalCost / totalHours / 100 : 0
    const staffCount = new Set(filteredTimesheets.map(t => t.staff_id)).size
    
    // Calculate labour % against sales if available
    let labourPercent = 0
    let costVsSales = 0
    
    if (orders.length > 0 && filters?.dateRange) {
      const filteredOrders = orders.filter(o => {
        const orderDate = new Date(o.order_datetime)
        return !o.is_void && 
               orderDate >= filters.dateRange!.startDate && 
               orderDate <= filters.dateRange!.endDate
      })
      
      const sales = calc.calculateNetSales(filteredOrders)
      if (sales > 0) {
        labourPercent = (totalCost / sales) * 100
        costVsSales = totalCost / sales
      }
    }
    
    return {
      total_hours: totalHours,
      total_cost: totalCost,
      labour_percent: labourPercent,
      avg_hourly_rate: avgHourlyRate,
      staff_count: staffCount,
      cost_vs_sales: costVsSales
    }
  }, [timesheets, staff, orders, isLoading, filters])
}
