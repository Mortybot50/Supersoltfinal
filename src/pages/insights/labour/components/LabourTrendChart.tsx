import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { format, subDays } from 'date-fns'
import { useDataStore } from '@/lib/store/dataStore'
import { useMemo } from 'react'
import { formatNumber } from '@/lib/utils/formatters'

export function LabourTrendChart() {
  const { timesheets, orders } = useDataStore()
  
  const chartData = useMemo(() => {
    const data = []
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i)
      const dateStr = format(date, 'yyyy-MM-dd')
      
      const dayTimesheets = timesheets.filter(t => 
        format(new Date(t.date), 'yyyy-MM-dd') === dateStr && 
        t.status === 'approved'
      )
      
      const dayOrders = orders.filter(o => 
        format(new Date(o.order_datetime), 'yyyy-MM-dd') === dateStr &&
        !o.is_void
      )
      
      const labourCost = dayTimesheets.reduce((sum, t) => sum + t.gross_pay, 0)
      const sales = dayOrders.reduce((sum, o) => sum + o.net_amount, 0)
      const labourPercent = sales > 0 ? (labourCost / sales) * 100 : 0
      
      data.push({
        date: format(date, 'MMM dd'),
        labour_percent: labourPercent,
        target: 25,
        budget: 28
      })
    }
    return data
  }, [timesheets, orders])
  
  const avgLabourPercent = chartData.length > 0
    ? chartData.reduce((sum, d) => sum + d.labour_percent, 0) / chartData.length
    : 0
  
  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold">Labour Cost Trend</h3>
          <p className="text-sm text-muted-foreground">Last 30 days</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">
            Avg: {avgLabourPercent.toFixed(1)}%
          </Badge>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip 
            formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px'
            }}
          />
          <Legend />
          <ReferenceLine 
            y={25} 
            stroke="hsl(var(--muted-foreground))" 
            strokeDasharray="3 3" 
            label="Target (25%)" 
          />
          <Line 
            type="monotone" 
            dataKey="labour_percent" 
            stroke="hsl(var(--destructive))" 
            strokeWidth={2}
            dot={false}
            name="Actual Labour %"
          />
          <Line 
            type="monotone" 
            dataKey="budget" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="Budget"
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}
