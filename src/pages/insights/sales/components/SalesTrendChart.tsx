import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, ComposedChart } from 'recharts'
import { format, eachDayOfInterval } from 'date-fns'
import { formatCurrency } from '@/lib/utils/formatters'
import { Order } from '@/types'

interface SalesTrendChartProps {
  orders: Order[]
  dateRange: { startDate: Date; endDate: Date }
  title?: string
}

export function SalesTrendChart({ orders, dateRange, title = "Sales Trend (Last 30 Days)" }: SalesTrendChartProps) {
  const chartData = useMemo(() => {
    // Filter orders by date range and exclude voids
    const filteredOrders = orders.filter(order => {
      const orderDate = typeof order.order_datetime === 'string' 
        ? new Date(order.order_datetime)
        : order.order_datetime instanceof Date 
        ? order.order_datetime 
        : null
      
      if (!orderDate || isNaN(orderDate.getTime())) {
        return false
      }
      
      return !order.is_void && 
             orderDate >= dateRange.startDate && 
             orderDate <= dateRange.endDate
    })
    
    // Get all days in range
    const days = eachDayOfInterval({ 
      start: dateRange.startDate, 
      end: dateRange.endDate 
    })
    
    // Group by date
    const byDate = filteredOrders.reduce((acc, order) => {
      const orderDate = typeof order.order_datetime === 'string' 
        ? order.order_datetime 
        : order.order_datetime instanceof Date 
        ? order.order_datetime.toISOString() 
        : null
      
      if (!orderDate) return acc
      
      const date = format(orderDate, 'yyyy-MM-dd')
      if (!acc[date]) {
        acc[date] = { sales: 0, orders: 0 }
      }
      acc[date].sales += order.is_refund ? -order.net_amount : order.net_amount
      if (!order.is_refund) acc[date].orders += 1
      return acc
    }, {} as Record<string, { sales: number, orders: number }>)
    
    // Calculate average for forecast and target
    const totalSales = Object.values(byDate).reduce((sum, d) => sum + d.sales, 0)
    const avgDailySales = days.length > 0 ? totalSales / days.length : 0
    const targetDailySales = avgDailySales * 1.1 // 10% above average as target
    
    return days.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd')
      const dayData = byDate[dateKey] || { sales: 0, orders: 0 }
      
      return {
        date: format(day, 'dd MMM'),
        actual: dayData.sales / 100, // Convert to dollars
        forecast: avgDailySales / 100,
        target: targetDailySales / 100,
        targetLow: (targetDailySales * 0.95) / 100,
        targetHigh: (targetDailySales * 1.05) / 100
      }
    })
  }, [orders, dateRange])
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">Actual vs Forecast vs Target</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
            />
            <Tooltip 
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  actual: 'Actual',
                  forecast: 'Forecast',
                  target: 'Target'
                }
                return [formatCurrency(value * 100), labels[name] || name]
              }}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
            />
            <Legend />
            
            {/* Target Range Area */}
            <Area
              type="monotone"
              dataKey="targetHigh"
              stroke="none"
              fill="hsl(var(--muted))"
              fillOpacity={0.3}
              name="Target Range"
            />
            <Area
              type="monotone"
              dataKey="targetLow"
              stroke="none"
              fill="hsl(var(--background))"
              fillOpacity={1}
            />
            
            {/* Lines */}
            <Line 
              type="monotone" 
              dataKey="forecast" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              name="Forecast"
              dot={false}
              strokeDasharray="5 5"
            />
            <Line 
              type="monotone" 
              dataKey="target" 
              stroke="hsl(var(--muted-foreground))" 
              strokeWidth={1}
              name="Target"
              dot={false}
              strokeDasharray="3 3"
            />
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke="hsl(var(--destructive))" 
              strokeWidth={2}
              name="Actual"
              dot={{ fill: 'hsl(var(--destructive))' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
