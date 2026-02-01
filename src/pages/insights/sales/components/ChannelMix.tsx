import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/formatters'
import { Order } from '@/types'

interface ChannelMixProps {
  orders: Order[]
  dateRange: { startDate: Date; endDate: Date }
}

export function ChannelMix({ orders, dateRange }: ChannelMixProps) {
  const channelData = useMemo(() => {
    console.log('🔍 ChannelMix - Processing:', {
      totalOrders: orders.length,
      dateRange: {
        start: dateRange.startDate.toISOString(),
        end: dateRange.endDate.toISOString()
      }
    })
    
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
      
      return !order.is_void && !order.is_refund &&
             orderDate >= dateRange.startDate && 
             orderDate <= dateRange.endDate
    })
    
    console.log('✅ ChannelMix - Filtered orders:', filteredOrders.length)
    
    // Group by channel
    const channels = ['dine-in', 'takeaway', 'delivery', 'online']
    const totalSales = filteredOrders.reduce((sum, o) => sum + o.net_amount, 0)
    
    return channels.map(channel => {
      const channelOrders = filteredOrders.filter(o => o.channel === channel)
      const revenue = channelOrders.reduce((sum, o) => sum + o.net_amount, 0)
      const orderCount = channelOrders.length
      const avgCheck = orderCount > 0 ? revenue / orderCount : 0
      const share = totalSales > 0 ? (revenue / totalSales) * 100 : 0
      
      return {
        channel,
        revenue,
        orderCount,
        avgCheck,
        share
      }
    }).filter(c => c.orderCount > 0) // Only show channels with data
  }, [orders, dateRange])
  
  const hasData = channelData.length > 0
  
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Left: Channel Mix Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Channel Mix</CardTitle>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <div className="space-y-4">
              {channelData.map((channel) => (
                <div key={channel.channel}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize font-medium">{channel.channel}</span>
                    <span className="text-muted-foreground">{channel.share.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${channel.share}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No channel data available for this period</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Right: Channel Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Channel Details</CardTitle>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Channel</th>
                    <th className="text-right py-2 font-medium">Revenue</th>
                    <th className="text-right py-2 font-medium">Orders</th>
                    <th className="text-right py-2 font-medium">Avg Check</th>
                    <th className="text-right py-2 font-medium">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {channelData.map((channel) => (
                    <tr key={channel.channel} className="border-b">
                      <td className="py-3 capitalize font-medium">{channel.channel}</td>
                      <td className="py-3 text-right">{formatCurrency(channel.revenue)}</td>
                      <td className="py-3 text-right">{channel.orderCount}</td>
                      <td className="py-3 text-right">{formatCurrency(channel.avgCheck)}</td>
                      <td className="py-3 text-right">{channel.share.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No channel data available for this period</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
