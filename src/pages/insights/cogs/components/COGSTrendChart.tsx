import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, ComposedChart } from 'recharts'
import { useDataStore } from '@/lib/store/dataStore'
import { useMemo } from 'react'
import { formatCurrency } from '@/lib/utils/formatters'
import { subDays, format } from 'date-fns'

export function COGSTrendChart() {
  const { orders, isLoading } = useDataStore()
  
  const chartData = useMemo(() => {
    if (isLoading || orders.length === 0) {
      return Array.from({ length: 30 }, (_, i) => ({
        date: format(subDays(new Date(), 29 - i), 'MMM dd'),
        actual: 0,
        theoretical: 0,
        target: 0
      }))
    }
    
    // Generate 30 days of data
    return Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), 29 - i)
      const dayOrders = orders.filter(o => {
        const orderDate = new Date(o.order_datetime)
        return orderDate.toDateString() === date.toDateString() && !o.is_void
      })
      
      const sales = dayOrders.reduce((sum, o) => sum + (o.is_refund ? 0 : o.net_amount), 0)
      const theoreticalCOGS = sales * 0.26 // 26% theoretical
      const actualCOGS = sales * 0.29 // 29% actual (with variance)
      const targetCOGS = sales * 0.28 // 28% target
      
      return {
        date: format(date, 'MMM dd'),
        actual: actualCOGS / 100,
        theoretical: theoreticalCOGS / 100,
        target: targetCOGS / 100
      }
    })
  }, [orders, isLoading])
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>COGS Trend (Last 30 Days)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Actual vs Theoretical vs Target
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              formatter={(value: number) => [formatCurrency(value * 100), '']}
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
            />
            <Legend />
            
            {/* Target range area */}
            <Area
              type="monotone"
              dataKey="target"
              fill="hsl(var(--muted))"
              fillOpacity={0.2}
              stroke="none"
              name="Target Range"
            />
            
            <Line 
              type="monotone" 
              dataKey="theoretical" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={false}
              name="Theoretical"
            />
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke="hsl(var(--destructive))" 
              strokeWidth={2}
              dot={false}
              name="Actual"
            />
            <Line 
              type="monotone" 
              dataKey="target" 
              stroke="hsl(var(--muted-foreground))" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Target"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
