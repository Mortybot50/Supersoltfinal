import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useCOGSMetrics } from '@/lib/hooks/useCOGSMetrics'
import { formatCurrency } from '@/lib/utils/formatters'

export function TheoreticalVsActual() {
  const metrics = useCOGSMetrics()
  
  if (!metrics) return null
  
  const data = [
    {
      name: 'Opening Stock',
      value: 30000 / 100,
      color: 'hsl(var(--chart-1))'
    },
    {
      name: 'Purchases',
      value: 45000 / 100,
      color: 'hsl(var(--chart-2))'
    },
    {
      name: 'Closing Stock',
      value: -28000 / 100,
      color: 'hsl(var(--chart-3))'
    },
    {
      name: 'Waste',
      value: -2000 / 100,
      color: 'hsl(var(--destructive))'
    },
    {
      name: 'Actual COGS',
      value: metrics.actual_cogs / 100,
      color: 'hsl(var(--primary))'
    }
  ]
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>COGS Breakdown (Waterfall)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Opening Stock + Purchases - Closing - Waste = Actual COGS
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="name" 
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
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
