import { useMemo } from 'react'
import { useDataStore } from '@/lib/store/dataStore'
import { 
  calculateNetSales, 
  calculateAverageCheck, 
  calculateVariance,
  calculateRefundMetrics,
  calculateChannelMix,
  calculatePaymentMix
} from '@/lib/utils/calculations'
import type { SalesMetrics, RefundMetrics, ChannelMetrics, PaymentMix } from '@/types'

interface SalesFilters {
  startDate?: Date
  endDate?: Date
  venueIds?: string[]
  channels?: string[]
}

interface SalesMetricsResult {
  metrics: SalesMetrics | null
  refunds: RefundMetrics | null
  channelMix: ChannelMetrics[]
  paymentMix: PaymentMix[]
  hasData: boolean
}

export function useSalesMetrics(filters?: SalesFilters): SalesMetricsResult {
  const { orders, orderItems, tenders, isLoading } = useDataStore()
  
  return useMemo(() => {
    console.log('🔍 useSalesMetrics - Store data:', { 
      ordersCount: orders.length, 
      orderItemsCount: orderItems.length,
      tendersCount: tenders.length,
      isLoading 
    })
    
    if (isLoading) {
      return {
        metrics: null,
        refunds: null,
        channelMix: [],
        paymentMix: [],
        hasData: false
      }
    }

    if (orders.length === 0) {
      return {
        metrics: null,
        refunds: null,
        channelMix: [],
        paymentMix: [],
        hasData: false
      }
    }
    
    // Apply filters
    let filteredOrders = orders
    
    if (filters?.startDate && filters?.endDate) {
      filteredOrders = filteredOrders.filter(o => {
        const orderDate = new Date(o.order_datetime)
        return orderDate >= filters.startDate! && orderDate <= filters.endDate!
      })
    }
    
    if (filters?.venueIds && filters.venueIds.length > 0) {
      filteredOrders = filteredOrders.filter(o => filters.venueIds!.includes(o.venue_id))
    }
    
    if (filters?.channels && filters.channels.length > 0) {
      filteredOrders = filteredOrders.filter(o => filters.channels!.includes(o.channel))
    }

    if (filteredOrders.length === 0) {
      return {
        metrics: null,
        refunds: null,
        channelMix: [],
        paymentMix: [],
        hasData: false
      }
    }
    
    // Calculate metrics
    const netSales = calculateNetSales(filteredOrders)
    const avgCheck = calculateAverageCheck(filteredOrders)
    const totalOrders = filteredOrders.filter(o => !o.is_void).length
    
    const filteredOrderIds = new Set(filteredOrders.map(o => o.id))
    const filteredItems = orderItems.filter(item => filteredOrderIds.has(item.order_id))
    const totalItems = filteredItems.reduce((sum, item) => sum + item.quantity, 0)
    
    const filteredTenders = tenders.filter(t => filteredOrderIds.has(t.order_id))
    
    const metrics: SalesMetrics = {
      net_sales: netSales,
      avg_check: avgCheck,
      total_orders: totalOrders,
      total_items: totalItems,
      items_per_order: totalOrders > 0 ? totalItems / totalOrders : 0,
      variance_vs_previous: { absolute: 0, percentage: null },
      variance_vs_forecast: { absolute: 0, percentage: null }
    }
    
    return {
      metrics,
      refunds: calculateRefundMetrics(filteredOrders),
      channelMix: calculateChannelMix(filteredOrders),
      paymentMix: calculatePaymentMix(filteredTenders),
      hasData: true
    }
  }, [orders, orderItems, tenders, isLoading, filters])
}
