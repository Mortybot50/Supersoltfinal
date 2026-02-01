import { useMemo } from 'react'
import { SalesFilters, Order, OrderItem, Forecast, Target, Tender, MenuItem } from '../types/sales.types'
import { isWithinInterval, subDays, subWeeks, subMonths, subYears, differenceInDays } from 'date-fns'
import {
  calculateTotalNetSales,
  calculateAverageCheck,
  calculateVariance,
  calculatePacing,
  calculateRefundMetrics,
  calculateChannelMix,
  generateDaypartHeatmap,
  calculateItemPerformance,
  calculatePaymentMix,
  calculateBasketMetrics,
  detectAnomalies
} from '../utils/calculations'

/**
 * Filter orders by date range and optional location/channel filters
 */
function filterOrders(orders: Order[], filters: SalesFilters): Order[] {
  return orders.filter(order => {
    const dateMatch = isWithinInterval(order.order_datetime, {
      start: filters.dateRange.start,
      end: filters.dateRange.end
    })
    
    const locationMatch = filters.locations.length === 0 || 
      filters.locations.includes(order.location_id)
    
    const channelMatch = filters.channels.length === 0 || 
      filters.channels.includes(order.channel)
    
    return dateMatch && locationMatch && channelMatch
  })
}

/**
 * Get previous period orders based on comparison type
 */
function getPreviousPeriodOrders(orders: Order[], filters: SalesFilters): Order[] {
  const daysDiff = differenceInDays(filters.dateRange.end, filters.dateRange.start) + 1
  
  let previousStart: Date
  let previousEnd: Date
  
  switch (filters.compareTo) {
    case 'previous':
      previousEnd = subDays(filters.dateRange.start, 1)
      previousStart = subDays(previousEnd, daysDiff - 1)
      break
      
    case 'sply': // Same period last year
      previousStart = subYears(filters.dateRange.start, 1)
      previousEnd = subYears(filters.dateRange.end, 1)
      break
      
    default:
      previousEnd = subDays(filters.dateRange.start, 1)
      previousStart = subDays(previousEnd, daysDiff - 1)
  }
  
  return filterOrders(orders, {
    ...filters,
    dateRange: { start: previousStart, end: previousEnd }
  })
}

/**
 * Hook to calculate all sales metrics based on filters
 */
export function useSalesMetrics(
  orders: Order[],
  orderItems: OrderItem[],
  forecasts: Forecast[],
  targets: Target[],
  tenders: Tender[],
  menuItems: MenuItem[],
  filters: SalesFilters
) {
  return useMemo(() => {
    const currentOrders = filterOrders(orders, filters)
    const previousOrders = getPreviousPeriodOrders(orders, filters)
    
    // Filter order items to match current orders
    const currentOrderIds = new Set(currentOrders.map(o => o.order_id))
    const currentItems = orderItems.filter(item => currentOrderIds.has(item.order_id))
    
    const previousOrderIds = new Set(previousOrders.map(o => o.order_id))
    const previousItems = orderItems.filter(item => previousOrderIds.has(item.order_id))
    
    // Filter tenders to match current orders
    const currentTenders = tenders.filter(t => currentOrderIds.has(t.order_id))
    
    // Calculate core metrics
    const currentSales = calculateTotalNetSales(currentOrders)
    const previousSales = calculateTotalNetSales(previousOrders)
    const salesVariance = calculateVariance(currentSales, previousSales)
    
    const currentAvgCheck = calculateAverageCheck(currentOrders)
    const previousAvgCheck = calculateAverageCheck(previousOrders)
    const avgCheckVariance = calculateVariance(currentAvgCheck, previousAvgCheck)
    
    const validCurrentOrders = currentOrders.filter(o => !o.is_void)
    const validPreviousOrders = previousOrders.filter(o => !o.is_void)
    const ordersVariance = calculateVariance(validCurrentOrders.length, validPreviousOrders.length)
    
    // Basket size
    const currentBasketMetrics = calculateBasketMetrics(currentOrders, currentItems)
    const previousBasketMetrics = calculateBasketMetrics(previousOrders, previousItems)
    const basketSizeVariance = calculateVariance(
      currentBasketMetrics.avg_items_per_order,
      previousBasketMetrics.avg_items_per_order
    )
    
    // Pacing (if comparing to target)
    const daysDiff = differenceInDays(filters.dateRange.end, filters.dateRange.start) + 1
    const totalDaysInPeriod = daysDiff // For now, assume full period
    
    // Calculate target totals (simplified - sum all targets in period)
    const targetTotal = targets
      .filter(t => {
        const targetDate = new Date(t.date)
        return isWithinInterval(targetDate, {
          start: filters.dateRange.start,
          end: filters.dateRange.end
        })
      })
      .reduce((sum, t) => sum + t.target_sales_ex_tax, 0)
    
    const pacing = calculatePacing(
      currentSales,
      targetTotal,
      daysDiff,
      totalDaysInPeriod,
      targetTotal
    )
    
    // Other metrics
    const refundMetrics = calculateRefundMetrics(currentOrders)
    const channelMix = calculateChannelMix(currentOrders)
    const daypartData = generateDaypartHeatmap(currentOrders)
    const itemPerformance = calculateItemPerformance(currentItems, previousItems, menuItems)
    const paymentMix = calculatePaymentMix(currentTenders)
    const anomalies = detectAnomalies(currentOrders)
    
    return {
      netSales: {
        current: currentSales,
        comparison: previousSales,
        variance: salesVariance
      },
      avgCheck: {
        current: currentAvgCheck,
        comparison: previousAvgCheck,
        variance: avgCheckVariance
      },
      orders: {
        current: validCurrentOrders.length,
        comparison: validPreviousOrders.length,
        variance: ordersVariance
      },
      basketSize: {
        current: currentBasketMetrics.avg_items_per_order,
        comparison: previousBasketMetrics.avg_items_per_order,
        variance: basketSizeVariance
      },
      pacing,
      refundMetrics,
      channelMix,
      daypartData,
      itemPerformance,
      paymentMix,
      basketMetrics: currentBasketMetrics,
      anomalies
    }
  }, [orders, orderItems, forecasts, targets, tenders, menuItems, filters])
}
