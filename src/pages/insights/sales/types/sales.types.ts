export interface Order {
  order_id: string
  order_datetime: Date
  location_id: string
  channel: 'dine-in' | 'takeaway' | 'delivery' | 'online'
  gross_inc_tax: number  // cents
  discounts: number      // cents
  tax_amount: number     // cents (GST)
  service_charge: number // cents
  tip_amount: number     // cents
  is_void: boolean
  is_refund: boolean
  refund_reason?: string
  customer_id?: string
  staff_id?: string
}

export interface OrderItem {
  order_id: string
  item_id: string
  item_name: string
  item_qty: number
  item_net: number       // cents (price × qty, ex tax)
  menu_group: string     // 'Food' | 'Beverages' | 'Other'
  menu_category: string  // 'Mains' | 'Sides' | 'Drinks' | 'Desserts'
  modifier_flag: boolean
}

export interface Forecast {
  date: string           // 'YYYY-MM-DD'
  location_id: string
  channel: string
  forecast_sales_ex_tax: number  // cents
  confidence_interval_lower: number
  confidence_interval_upper: number
}

export interface Target {
  date: string
  location_id: string
  channel: string
  target_sales_ex_tax: number    // cents
  target_type: 'budget' | 'goal' | 'stretch'
}

export interface Tender {
  order_id: string
  payment_method: 'card' | 'cash' | 'digital_wallet'
  payment_provider?: string  // 'visa' | 'mastercard' | 'amex' | 'apple_pay' | etc
  amount: number  // cents
}

export interface Location {
  location_id: string
  location_name: string
  location_type: 'cafe' | 'restaurant' | 'kiosk'
  timezone: string  // 'Australia/Melbourne'
  active: boolean
}

export interface MenuItem {
  item_id: string
  item_name: string
  menu_group: string
  menu_category: string
  current_price: number  // cents
  cost_price: number     // cents
  launch_date?: Date
}

export interface SalesFilters {
  dateRange: { start: Date, end: Date }
  period: 'day' | 'week' | 'month' | 'custom'
  locations: string[]  // empty = all
  channels: string[]   // empty = all
  compareTo: 'previous' | 'sply' | 'forecast' | 'target'
}

export interface MetricWithVariance {
  current: number
  comparison: number
  variance: {
    absolute: number
    percentage: number | null
  }
}

export interface PacingMetrics {
  actual_to_date: number
  target_to_date: number
  pacing_pct: number
  projected_finish: number
  target_total: number
  on_track: boolean
}

export interface ChannelMetrics {
  channel: string
  sales: number
  orders: number
  avg_check: number
  share_pct: number
}

export interface DaypartCell {
  day: string
  hour: number
  sales: number
  orders: number
  avg_check: number
}

export interface ItemPerformance {
  item_id: string
  item_name: string
  menu_group: string
  qty_sold: number
  revenue: number
  share_pct: number
  growth_pct: number | null
  margin_pct: number
  rank: number
}

export interface RefundMetrics {
  refund_rate_pct: number
  refund_value_pct: number
  void_rate_pct: number
  total_refund_value: number
  total_void_count: number
}

export interface PaymentMix {
  payment_method: string
  amount: number
  transaction_count: number
  share_pct: number
  avg_transaction: number
}

export interface BasketMetrics {
  avg_items_per_order: number
  single_item_orders_pct: number
  multi_item_orders_pct: number
  avg_basket_value: number
}

export interface Anomaly {
  date: string
  location_id: string
  metric: string
  actual: number
  expected: number
  variance_pct: number
  severity: 'high' | 'medium' | 'low'
  suspected_cause?: string
}
