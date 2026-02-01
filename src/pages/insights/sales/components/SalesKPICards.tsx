import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils/formatters'
import type { Order } from '@/types'

interface SalesKPICardsProps {
  orders: Order[]
  dateRange: { startDate: Date; endDate: Date }
}

export function SalesKPICards({ orders, dateRange }: SalesKPICardsProps) {
  const metrics = useMemo(() => {
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
    
    // Calculate metrics
    const validOrders = filteredOrders.filter(o => !o.is_refund)
    const netSales = filteredOrders.reduce((sum, order) => {
      return sum + (order.is_refund ? -order.net_amount : order.net_amount)
    }, 0)
    
    const totalOrders = validOrders.length
    const avgCheck = totalOrders > 0 ? netSales / totalOrders : 0
    
    // Calculate items per order (mock for now - would need orderItems)
    const itemsPerOrder = 2.5 // Placeholder
    
    // Calculate vs previous period (simple comparison)
    const periodLength = Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24))
    const prevStartDate = new Date(dateRange.startDate.getTime() - periodLength * 24 * 60 * 60 * 1000)
    const prevOrders = orders.filter(order => {
      const orderDate = typeof order.order_datetime === 'string' 
        ? new Date(order.order_datetime)
        : order.order_datetime instanceof Date 
        ? order.order_datetime 
        : null
      
      if (!orderDate || isNaN(orderDate.getTime())) {
        return false
      }
      
      return !order.is_void && !order.is_refund &&
             orderDate >= prevStartDate && 
             orderDate < dateRange.startDate
    })
    
    const prevNetSales = prevOrders.reduce((sum, o) => sum + o.net_amount, 0)
    const salesChange = prevNetSales > 0 ? ((netSales - prevNetSales) / prevNetSales) * 100 : 0
    const ordersChange = prevOrders.length > 0 ? ((totalOrders - prevOrders.length) / prevOrders.length) * 100 : 0
    
    return {
      netSales,
      avgCheck,
      totalOrders,
      itemsPerOrder,
      salesChange,
      ordersChange
    }
  }, [orders, dateRange])
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Net Sales Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Net Sales</span>
          {metrics.salesChange >= 0 ? (
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <TrendingDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        
        <div className="text-3xl font-bold mb-1">
          {formatCurrency(metrics.netSales)}
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={metrics.salesChange >= 0 ? 'default' : 'destructive'}>
            {metrics.salesChange >= 0 ? 'On Target' : 'Below Target'}
          </Badge>
          <span className="text-muted-foreground">
            {metrics.totalOrders} orders
          </span>
        </div>
      </Card>
      
      {/* Avg Check Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Avg Check</span>
          <DollarSign className="w-5 h-5 text-muted-foreground" />
        </div>
        
        <div className="text-3xl font-bold mb-1">
          {formatCurrency(metrics.avgCheck)}
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary">
            Average
          </Badge>
          <span className="text-muted-foreground">
            per transaction
          </span>
        </div>
      </Card>
      
      {/* Total Orders Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Total Orders</span>
          <ShoppingCart className="w-5 h-5 text-muted-foreground" />
        </div>
        
        <div className="text-3xl font-bold mb-1">
          {formatNumber(metrics.totalOrders)}
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={metrics.ordersChange >= 0 ? 'default' : 'destructive'}>
            {metrics.ordersChange >= 0 ? '+' : ''}{metrics.ordersChange.toFixed(1)}%
          </Badge>
          <span className="text-muted-foreground">
            vs previous period
          </span>
        </div>
      </Card>
      
      {/* Items per Order Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Items per Order</span>
          <Package className="w-5 h-5 text-muted-foreground" />
        </div>
        
        <div className="text-3xl font-bold mb-1">
          {metrics.itemsPerOrder.toFixed(1)}
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary">
            Stable
          </Badge>
          <span className="text-muted-foreground">
            average basket size
          </span>
        </div>
      </Card>
    </div>
  )
}
