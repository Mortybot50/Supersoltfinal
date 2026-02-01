import { Order, OrderItem, MetricWithVariance, PacingMetrics, ChannelMetrics, DaypartCell, ItemPerformance, RefundMetrics, PaymentMix, BasketMetrics, Anomaly, Tender, MenuItem } from '../types/sales.types'
import { format, getHours } from 'date-fns'

/**
 * Calculate net sales from an order
 */
export function calculateNetSales(order: Order): number {
  if (order.is_void) return 0
  const net = order.gross_inc_tax - order.tax_amount - order.service_charge - order.discounts
  return order.is_refund ? -net : net
}

/**
 * Calculate total net sales from orders
 */
export function calculateTotalNetSales(orders: Order[]): number {
  return orders.reduce((sum, o) => sum + calculateNetSales(o), 0)
}

/**
 * Calculate average check
 */
export function calculateAverageCheck(orders: Order[]): number {
  const validOrders = orders.filter(o => !o.is_void)
  const totalSales = validOrders.reduce((sum, o) => sum + calculateNetSales(o), 0)
  return validOrders.length > 0 ? totalSales / validOrders.length : 0
}

/**
 * Calculate variance (absolute and percentage)
 */
export function calculateVariance(actual: number, comparison: number): {
  absolute: number
  percentage: number | null
} {
  return {
    absolute: actual - comparison,
    percentage: comparison !== 0 ? ((actual - comparison) / comparison) * 100 : null
  }
}

/**
 * Calculate pacing vs target
 */
export function calculatePacing(
  actualToDate: number,
  targetToDate: number,
  daysElapsed: number,
  totalDays: number,
  targetTotal: number
): PacingMetrics {
  const runRate = daysElapsed > 0 ? actualToDate / daysElapsed : 0
  const projected = runRate * totalDays
  const pacing = targetToDate !== 0 ? actualToDate / targetToDate : 0
  
  return {
    actual_to_date: actualToDate,
    target_to_date: targetToDate,
    pacing_pct: pacing,
    projected_finish: projected,
    target_total: targetTotal,
    on_track: pacing >= 0.95
  }
}

/**
 * Calculate refund and void metrics
 */
export function calculateRefundMetrics(orders: Order[]): RefundMetrics {
  const totalOrders = orders.length
  const refunds = orders.filter(o => o.is_refund)
  const voids = orders.filter(o => o.is_void)
  const actualOrders = orders.filter(o => !o.is_void && !o.is_refund)
  
  const totalSales = actualOrders.reduce((sum, o) => sum + calculateNetSales(o), 0)
  const totalRefundValue = Math.abs(refunds.reduce((sum, o) => sum + calculateNetSales(o), 0))
  
  return {
    refund_rate_pct: totalOrders > 0 ? (refunds.length / totalOrders) * 100 : 0,
    refund_value_pct: totalSales > 0 ? (totalRefundValue / totalSales) * 100 : 0,
    void_rate_pct: totalOrders > 0 ? (voids.length / totalOrders) * 100 : 0,
    total_refund_value: totalRefundValue,
    total_void_count: voids.length
  }
}

/**
 * Calculate channel mix
 */
export function calculateChannelMix(orders: Order[]): ChannelMetrics[] {
  const validOrders = orders.filter(o => !o.is_void)
  const totalSales = validOrders.reduce((sum, o) => sum + calculateNetSales(o), 0)
  
  const byChannel = validOrders.reduce((acc, order) => {
    if (!acc[order.channel]) {
      acc[order.channel] = []
    }
    acc[order.channel].push(order)
    return acc
  }, {} as Record<string, Order[]>)
  
  return Object.entries(byChannel).map(([channel, channelOrders]) => {
    const channelSales = channelOrders.reduce((sum, o) => sum + calculateNetSales(o), 0)
    return {
      channel,
      sales: channelSales,
      orders: channelOrders.length,
      avg_check: channelOrders.length > 0 ? channelSales / channelOrders.length : 0,
      share_pct: totalSales > 0 ? (channelSales / totalSales) * 100 : 0
    }
  }).sort((a, b) => b.sales - a.sales)
}

/**
 * Generate daypart heatmap data
 */
export function generateDaypartHeatmap(orders: Order[]): DaypartCell[] {
  const validOrders = orders.filter(o => !o.is_void)
  
  const grouped = validOrders.reduce((acc, order) => {
    const day = format(order.order_datetime, 'EEE')
    const hour = getHours(order.order_datetime)
    const key = `${day}-${hour}`
    
    if (!acc[key]) {
      acc[key] = { day, hour, orders: [] }
    }
    acc[key].orders.push(order)
    return acc
  }, {} as Record<string, { day: string, hour: number, orders: Order[] }>)
  
  return Object.values(grouped).map(({ day, hour, orders: dayHourOrders }) => {
    const sales = dayHourOrders.reduce((sum, o) => sum + calculateNetSales(o), 0)
    return {
      day,
      hour,
      sales,
      orders: dayHourOrders.length,
      avg_check: dayHourOrders.length > 0 ? sales / dayHourOrders.length : 0
    }
  })
}

/**
 * Calculate item performance
 */
export function calculateItemPerformance(
  currentItems: OrderItem[],
  previousItems: OrderItem[],
  menuItems: MenuItem[]
): ItemPerformance[] {
  const currentByItem = currentItems.reduce((acc, item) => {
    if (!acc[item.item_id]) {
      acc[item.item_id] = { qty: 0, revenue: 0, name: item.item_name, group: item.menu_group }
    }
    acc[item.item_id].qty += item.item_qty
    acc[item.item_id].revenue += item.item_net
    return acc
  }, {} as Record<string, { qty: number, revenue: number, name: string, group: string }>)
  
  const previousByItem = previousItems.reduce((acc, item) => {
    if (!acc[item.item_id]) {
      acc[item.item_id] = { qty: 0, revenue: 0 }
    }
    acc[item.item_id].qty += item.item_qty
    acc[item.item_id].revenue += item.item_net
    return acc
  }, {} as Record<string, { qty: number, revenue: number }>)
  
  const totalRevenue = Object.values(currentByItem).reduce((sum, item) => sum + item.revenue, 0)
  
  const performance = Object.entries(currentByItem).map(([itemId, current]) => {
    const previous = previousByItem[itemId]
    const menuItem = menuItems.find(m => m.item_id === itemId)
    
    const growthPct = previous && previous.revenue > 0
      ? ((current.revenue - previous.revenue) / previous.revenue) * 100
      : null
    
    const marginPct = menuItem && menuItem.current_price > 0
      ? ((menuItem.current_price - menuItem.cost_price) / menuItem.current_price) * 100
      : 0
    
    return {
      item_id: itemId,
      item_name: current.name,
      menu_group: current.group,
      qty_sold: current.qty,
      revenue: current.revenue,
      share_pct: totalRevenue > 0 ? (current.revenue / totalRevenue) * 100 : 0,
      growth_pct: growthPct,
      margin_pct: marginPct,
      rank: 0
    }
  })
  
  // Sort by revenue and assign ranks
  return performance
    .sort((a, b) => b.revenue - a.revenue)
    .map((item, index) => ({ ...item, rank: index + 1 }))
}

/**
 * Calculate payment mix
 */
export function calculatePaymentMix(tenders: Tender[]): PaymentMix[] {
  const totalAmount = tenders.reduce((sum, t) => sum + t.amount, 0)
  
  const byMethod = tenders.reduce((acc, tender) => {
    if (!acc[tender.payment_method]) {
      acc[tender.payment_method] = { amount: 0, count: 0 }
    }
    acc[tender.payment_method].amount += tender.amount
    acc[tender.payment_method].count += 1
    return acc
  }, {} as Record<string, { amount: number, count: number }>)
  
  return Object.entries(byMethod).map(([method, data]) => ({
    payment_method: method,
    amount: data.amount,
    transaction_count: data.count,
    share_pct: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
    avg_transaction: data.count > 0 ? data.amount / data.count : 0
  })).sort((a, b) => b.amount - a.amount)
}

/**
 * Calculate basket metrics
 */
export function calculateBasketMetrics(orders: Order[], orderItems: OrderItem[]): BasketMetrics {
  const validOrders = orders.filter(o => !o.is_void)
  
  const itemsByOrder = orderItems.reduce((acc, item) => {
    if (!acc[item.order_id]) {
      acc[item.order_id] = 0
    }
    acc[item.order_id] += item.item_qty
    return acc
  }, {} as Record<string, number>)
  
  const totalItems = Object.values(itemsByOrder).reduce((sum, qty) => sum + qty, 0)
  const singleItemOrders = Object.values(itemsByOrder).filter(qty => qty === 1).length
  const totalSales = validOrders.reduce((sum, o) => sum + calculateNetSales(o), 0)
  
  return {
    avg_items_per_order: validOrders.length > 0 ? totalItems / validOrders.length : 0,
    single_item_orders_pct: validOrders.length > 0 ? (singleItemOrders / validOrders.length) * 100 : 0,
    multi_item_orders_pct: validOrders.length > 0 ? ((validOrders.length - singleItemOrders) / validOrders.length) * 100 : 0,
    avg_basket_value: validOrders.length > 0 ? totalSales / validOrders.length : 0
  }
}

/**
 * Detect anomalies using simple z-score
 */
export function detectAnomalies(
  orders: Order[],
  threshold: number = 2.5
): Anomaly[] {
  const validOrders = orders.filter(o => !o.is_void)
  
  // Group by date and location
  const dailySales = validOrders.reduce((acc, order) => {
    const date = format(order.order_datetime, 'yyyy-MM-dd')
    const key = `${date}-${order.location_id}`
    
    if (!acc[key]) {
      acc[key] = { date, location_id: order.location_id, sales: 0 }
    }
    acc[key].sales += calculateNetSales(order)
    return acc
  }, {} as Record<string, { date: string, location_id: string, sales: number }>)
  
  const salesValues = Object.values(dailySales).map(d => d.sales)
  
  if (salesValues.length < 7) return [] // Need at least 7 days for meaningful detection
  
  const mean = salesValues.reduce((sum, val) => sum + val, 0) / salesValues.length
  const variance = salesValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / salesValues.length
  const stdDev = Math.sqrt(variance)
  
  const anomalies: Anomaly[] = []
  
  Object.values(dailySales).forEach(({ date, location_id, sales }) => {
    const zScore = stdDev > 0 ? (sales - mean) / stdDev : 0
    
    if (Math.abs(zScore) > threshold) {
      const variancePct = mean > 0 ? ((sales - mean) / mean) * 100 : 0
      const severity = Math.abs(zScore) > 3 ? 'high' : Math.abs(zScore) > 2.5 ? 'medium' : 'low'
      
      anomalies.push({
        date,
        location_id,
        metric: 'sales',
        actual: sales,
        expected: mean,
        variance_pct: variancePct,
        severity,
        suspected_cause: variancePct < -25 ? 'Potential system outage or reduced hours' : 'Unusual spike in sales'
      })
    }
  })
  
  return anomalies.sort((a, b) => Math.abs(b.variance_pct) - Math.abs(a.variance_pct))
}
