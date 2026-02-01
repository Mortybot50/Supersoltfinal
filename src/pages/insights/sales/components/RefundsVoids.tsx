import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/formatters'
import { Order } from '@/types'

interface RefundsVoidsProps {
  orders: Order[]
  dateRange: { startDate: Date; endDate: Date }
}

export function RefundsVoids({ orders, dateRange }: RefundsVoidsProps) {
  const metrics = useMemo(() => {
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
      
      return orderDate >= dateRange.startDate && orderDate <= dateRange.endDate
    })
    
    const totalOrders = filteredOrders.filter(o => !o.is_void && !o.is_refund).length
    const refundOrders = filteredOrders.filter(o => o.is_refund)
    const voidOrders = filteredOrders.filter(o => o.is_void)
    
    const refundValue = refundOrders.reduce((sum, o) => sum + o.net_amount, 0)
    const refundRate = totalOrders > 0 ? (refundOrders.length / totalOrders) * 100 : 0
    const voidRate = totalOrders > 0 ? (voidOrders.length / totalOrders) * 100 : 0
    
    return {
      refundRate,
      refundValue,
      refundCount: refundOrders.length,
      voidRate,
      voidCount: voidOrders.length
    }
  }, [orders, dateRange])
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Refunds & Voids</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Refund Rate</p>
            <p className="text-2xl font-bold">{metrics.refundRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.refundCount} refunds
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Refund Value</p>
            <p className="text-2xl font-bold">{formatCurrency(metrics.refundValue)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              total refunded
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Void Rate</p>
            <p className="text-2xl font-bold">{metrics.voidRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.voidCount} voids
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
