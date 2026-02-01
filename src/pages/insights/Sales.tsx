import { useState, useMemo, useEffect } from 'react'
import { subDays, startOfMonth, endOfMonth } from 'date-fns'
import { DateRangeSelector } from '@/components/DateRangeSelector'
import { Button } from '@/components/ui/button'
import { Download, RefreshCw } from 'lucide-react'
import { SalesKPICards } from './sales/components/SalesKPICards'
import { SalesTrendChart } from './sales/components/SalesTrendChart'
import { ChannelMix } from './sales/components/ChannelMix'
import { PaymentMethods } from './sales/components/PaymentMethods'
import { RefundsVoids } from './sales/components/RefundsVoids'
import { EmptyState } from './sales/components/EmptyState'
import { useDataStore } from '@/lib/store/dataStore'
import { useToast } from '@/hooks/use-toast'

export default function Sales() {
  const { orders, orderItems, tenders } = useDataStore()
  const { toast } = useToast()
  
  // Smart default: Use the date range that includes imported data
  const getInitialDateRange = () => {
    if (orders && orders.length > 0) {
      // Parse dates safely - handle both string and Date
      const dates = orders.map(o => {
        const date = typeof o.order_datetime === 'string' 
          ? new Date(o.order_datetime)
          : o.order_datetime instanceof Date 
          ? o.order_datetime 
          : null
        return date && !isNaN(date.getTime()) ? date : null
      }).filter((d): d is Date => d !== null)
      
      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
        
        return {
          startDate: startOfMonth(minDate),
          endDate: endOfMonth(maxDate)
        }
      }
    }
    
    // No data: default to current month
    return {
      startDate: startOfMonth(new Date()),
      endDate: endOfMonth(new Date())
    }
  }
  
  const [dateRange, setDateRange] = useState(getInitialDateRange())
  
  // Log data on mount and when it changes
  useEffect(() => {
    console.log('📊 Sales Insights - Data Update:', {
      totalOrders: orders.length,
      orderItems: orderItems.length,
      tenders: tenders.length,
      dateRange: {
        from: dateRange.startDate.toISOString().split('T')[0],
        to: dateRange.endDate.toISOString().split('T')[0]
      },
      firstOrder: orders[0] ? {
        order_number: orders[0].order_number,
        date: typeof orders[0].order_datetime === 'string' 
          ? orders[0].order_datetime 
          : 'Invalid date format',
        channel: orders[0].channel,
        net_amount: orders[0].net_amount
      } : 'No orders'
    })
  }, [orders.length, orderItems.length, tenders.length, dateRange])
  
  // Check if we have any orders at all
  const hasOrders = orders.length > 0
  
  // Filter orders by date range to check if we have data for this period
  const filteredOrders = useMemo(() => {
    const filtered = orders.filter(order => {
      // Parse ISO string to Date - handle both string and Date object (legacy data)
      const orderDate = typeof order.order_datetime === 'string' 
        ? new Date(order.order_datetime)
        : order.order_datetime instanceof Date 
        ? order.order_datetime 
        : null
      
      if (!orderDate || isNaN(orderDate.getTime())) {
        console.warn('⚠️ Invalid order date:', order.order_datetime)
        return false
      }
      
      return orderDate >= dateRange.startDate && orderDate <= dateRange.endDate
    })
    
    console.log(`📅 Date filter: ${filtered.length} orders in range out of ${orders.length} total`)
    return filtered
  }, [orders, dateRange])
  
  const handleRefresh = () => {
    const count = orders.length
    toast({
      title: 'Data refreshed',
      description: `Currently displaying ${count} orders`
    })
  }
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Sales Insights</h1>
          <p className="text-muted-foreground">
            Comprehensive sales analytics and performance tracking
            {hasOrders && ` • ${orders.length} orders loaded`}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" disabled={!hasOrders}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>
      
      {/* Date Range Selector */}
      <DateRangeSelector
        onDateRangeChange={(start, end) => {
          setDateRange({ startDate: start, endDate: end })
        }}
      />
      
      {!hasOrders ? (
        <EmptyState />
      ) : filteredOrders.length === 0 ? (
        <EmptyState 
          title="No Data for Selected Period"
          description="There are no orders in the selected date range. Try adjusting your filters."
          showImportButton={false}
        />
      ) : (
        <>
          {/* KPI Cards */}
          <SalesKPICards 
            orders={orders}
            dateRange={dateRange}
          />
          
          {/* Sales Trend Chart */}
          <SalesTrendChart 
            orders={orders}
            dateRange={dateRange}
          />
          
          {/* Channel Mix */}
          <ChannelMix 
            orders={orders}
            dateRange={dateRange}
          />
          
          {/* Payment Methods */}
          <PaymentMethods 
            orders={orders}
            tenders={tenders}
            dateRange={dateRange}
          />
          
          {/* Refunds & Voids */}
          <RefundsVoids 
            orders={orders}
            dateRange={dateRange}
          />
        </>
      )}
    </div>
  )
}
