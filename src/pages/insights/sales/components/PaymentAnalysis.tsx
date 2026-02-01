import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { PaymentMix } from '../types/sales.types'
import { formatCurrency, formatNumber } from '../utils/formatters'

interface PaymentAnalysisProps {
  paymentMix: PaymentMix[]
}

export function PaymentAnalysis({ paymentMix }: PaymentAnalysisProps) {
  const chartData = paymentMix.map(p => ({
    method: p.payment_method.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    amount: p.amount / 100,
    share: p.share_pct
  }))
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Methods</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="method" 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip 
              formatter={(value: number) => formatCurrency(value * 100)}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
            />
            <Bar 
              dataKey="amount" 
              fill="hsl(var(--primary))" 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
        
        <div className="mt-6 space-y-3">
          {paymentMix.map(payment => (
            <div key={payment.payment_method} className="flex items-center justify-between border-b pb-2 last:border-b-0">
              <div>
                <p className="font-medium capitalize">
                  {payment.payment_method.split('_').join(' ')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(payment.transaction_count)} transactions
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatCurrency(payment.amount)}</p>
                <p className="text-sm text-muted-foreground">
                  {payment.share_pct.toFixed(1)}% • Avg: {formatCurrency(payment.avg_transaction)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
