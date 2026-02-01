import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/formatters'
import { Order, Tender } from '@/types'

interface PaymentMethodsProps {
  orders: Order[]
  tenders: Tender[]
  dateRange: { startDate: Date; endDate: Date }
}

export function PaymentMethods({ orders, tenders, dateRange }: PaymentMethodsProps) {
  const paymentData = useMemo(() => {
    // Filter orders by date range
    const filteredOrders = orders.filter(order => {
      const orderDate = typeof order.order_datetime === 'string' 
        ? new Date(order.order_datetime)
        : order.order_datetime instanceof Date 
        ? order.order_datetime 
        : null
      
      if (!orderDate || isNaN(orderDate.getTime())) {
        return false
      }
      
      return !order.is_void && !order.is_refund &&
             orderDate >= dateRange.startDate && 
             orderDate <= dateRange.endDate
    })
    
    // Get order IDs
    const orderIds = new Set(filteredOrders.map(o => o.id))
    
    // Filter tenders for these orders
    const filteredTenders = tenders.filter(t => orderIds.has(t.order_id))
    
    // Group by payment method
    const paymentMethods = ['cash', 'card', 'online']
    const totalAmount = filteredTenders.reduce((sum, t) => sum + t.amount, 0)
    
    return paymentMethods.map(method => {
      const methodTenders = filteredTenders.filter(t => t.payment_method === method)
      const amount = methodTenders.reduce((sum, t) => sum + t.amount, 0)
      const transactionCount = methodTenders.length
      const avgTransaction = transactionCount > 0 ? amount / transactionCount : 0
      const share = totalAmount > 0 ? (amount / totalAmount) * 100 : 0
      
      return {
        method,
        amount,
        transactionCount,
        avgTransaction,
        share
      }
    }).filter(p => p.transactionCount > 0) // Only show methods with data
  }, [orders, tenders, dateRange])
  
  const hasData = paymentData.length > 0
  
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Left: Payment Methods Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <div className="space-y-4">
              {paymentData.map((payment) => (
                <div key={payment.method}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize font-medium">{payment.method}</span>
                    <span className="text-muted-foreground">{payment.share.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${payment.share}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No payment data available for this period</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Right: Payment Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Method</th>
                    <th className="text-right py-2 font-medium">Amount</th>
                    <th className="text-right py-2 font-medium">Transactions</th>
                    <th className="text-right py-2 font-medium">Avg</th>
                    <th className="text-right py-2 font-medium">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentData.map((payment) => (
                    <tr key={payment.method} className="border-b">
                      <td className="py-3 capitalize font-medium">{payment.method}</td>
                      <td className="py-3 text-right">{formatCurrency(payment.amount)}</td>
                      <td className="py-3 text-right">{payment.transactionCount}</td>
                      <td className="py-3 text-right">{formatCurrency(payment.avgTransaction)}</td>
                      <td className="py-3 text-right">{payment.share.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No payment data available for this period</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
