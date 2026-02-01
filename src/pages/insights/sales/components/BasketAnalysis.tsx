import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BasketMetrics } from '../types/sales.types'
import { formatCurrency } from '../utils/formatters'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts'

interface BasketAnalysisProps {
  basketMetrics: BasketMetrics
}

export function BasketAnalysis({ basketMetrics }: BasketAnalysisProps) {
  const orderCompositionData = [
    { name: 'Single Item', value: basketMetrics.single_item_orders_pct, count: 'single' },
    { name: 'Multi Item', value: basketMetrics.multi_item_orders_pct, count: 'multi' }
  ]
  
  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))']
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Basket Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-4">Order Composition</h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={orderCompositionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ value }) => `${value.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {orderCompositionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Avg Items per Order</p>
              <p className="text-3xl font-bold mt-1">
                {basketMetrics.avg_items_per_order.toFixed(1)}
              </p>
            </div>
            
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Avg Basket Value</p>
              <p className="text-3xl font-bold mt-1">
                {formatCurrency(basketMetrics.avg_basket_value)}
              </p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium mb-2">Insights</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {basketMetrics.single_item_orders_pct.toFixed(0)}% of orders are single-item purchases</li>
                <li>• Consider upselling strategies to increase basket size</li>
                {basketMetrics.avg_items_per_order < 2 && (
                  <li className="text-amber-600">• ⚠ Low items per order - review menu bundling</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
