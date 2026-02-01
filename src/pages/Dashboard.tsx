import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { formatCurrency } from "@/lib/utils/formatters"
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay, addDays, differenceInDays } from "date-fns"
import { ArrowUp, ArrowDown, Bot, TrendingUp, AlertTriangle, Upload, Shield } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { toast } from "@/hooks/use-toast"
import { DateRangeSelector } from "@/components/DateRangeSelector"
import { useDataStore } from "@/lib/store/dataStore"
import { useSalesMetrics } from "@/lib/hooks/useSalesMetrics"
import { useLabourMetrics } from "@/lib/hooks/useLabourMetrics"
import { useState, useMemo } from "react"

interface KpiCardProps {
  title: string
  current: string
  target: string
  status: 'positive' | 'neutral' | 'warning'
  statusText: string
  icon: React.ReactNode
}

function KpiCard({ title, current, target, status, statusText, icon }: KpiCardProps) {
  const statusColors = {
    positive: 'text-green-600 bg-green-50',
    neutral: 'text-blue-600 bg-blue-50',
    warning: 'text-amber-600 bg-amber-50',
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{current}</div>
        <div className="text-xs text-muted-foreground mt-1">Target: {target}</div>
        <div className={`inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-md text-xs font-medium ${statusColors[status]}`}>
          {status === 'positive' && <ArrowUp className="h-3 w-3" />}
          {status === 'warning' && <AlertTriangle className="h-3 w-3" />}
          {statusText}
        </div>
      </CardContent>
    </Card>
  )
}

interface SuggestionCardProps {
  title: string
  description: string
  primaryAction: string
  onApprove: () => void
}

function SuggestionCard({ title, description, primaryAction, onApprove }: SuggestionCardProps) {
  const handleApprove = () => {
    onApprove()
    toast({
      title: "Action approved",
      description: title,
    })
  }

  const handleIgnore = () => {
    toast({
      title: "Suggestion ignored",
      description: "You can review this again later",
    })
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm">{title}</h4>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
              {primaryAction}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleIgnore}>
              Ignore
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const { orders, forecasts } = useDataStore()
  
  // Smart default: If we have orders, default to the date range that includes them
  const getInitialDateRange = () => {
    if (orders && orders.length > 0) {
      // Find min and max dates from orders
      const dates = orders.map(o => new Date(o.order_datetime))
      const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
      
      // Default to the month containing the most recent data
      return {
        from: startOfMonth(maxDate),
        to: endOfMonth(maxDate)
      }
    }
    
    // No data: default to current week
    return {
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 })
    }
  }
  
  const [dateRange, setDateRange] = useState(getInitialDateRange())
  const [activePeriod, setActivePeriod] = useState<'day' | 'week' | 'month'>('month')

  const labourMetrics = useLabourMetrics()

  // Filter orders by date range (exclude voids and refunds)
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Parse ISO string to Date - handle both string and Date object (legacy data)
      const orderDate = typeof order.order_datetime === 'string' 
        ? new Date(order.order_datetime)
        : order.order_datetime instanceof Date 
        ? order.order_datetime 
        : null
      
      if (!orderDate || isNaN(orderDate.getTime())) {
        return false
      }
      
      return orderDate >= dateRange.from && 
             orderDate <= dateRange.to &&
             !order.is_void && 
             !order.is_refund
    })
  }, [orders, dateRange])

  // Calculate actual sales
  const actualSales = useMemo(() => {
    return filteredOrders.reduce((sum, order) => sum + order.net_amount, 0) / 100
  }, [filteredOrders])

  // Calculate forecast (95% of actual as target)
  const forecastTarget = useMemo(() => {
    return actualSales * 0.95
  }, [actualSales])

  // Calculate percentage vs forecast
  const vsForecasts = useMemo(() => {
    if (forecastTarget === 0) return '+0.0%'
    const percentage = ((actualSales - forecastTarget) / forecastTarget * 100)
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%`
  }, [actualSales, forecastTarget])

  const hasData = filteredOrders.length > 0

  // Generate chart data from actual orders
  const chartData = useMemo(() => {
    const days = differenceInDays(dateRange.to, dateRange.from) + 1
    const dailyData = []
    let currentDate = new Date(dateRange.from)
    
    while (currentDate <= dateRange.to) {
      const dateKey = format(currentDate, 'EEE')
      const dayStart = startOfDay(currentDate)
      const dayEnd = endOfDay(currentDate)
      
      // Sum sales for this day
      const daySales = filteredOrders
        .filter(order => {
          const orderDate = typeof order.order_datetime === 'string' 
            ? new Date(order.order_datetime)
            : order.order_datetime instanceof Date 
            ? order.order_datetime 
            : null
          
          if (!orderDate || isNaN(orderDate.getTime())) {
            return false
          }
          
          return orderDate >= dayStart && orderDate <= dayEnd
        })
        .reduce((sum, order) => sum + order.net_amount / 100, 0)
      
      // Forecast is 95% of actual (or average if actual is 0)
      const avgDailySales = actualSales / days
      
      dailyData.push({
        day: dateKey,
        actual: Math.round(daySales * 100) / 100,
        forecast: daySales > 0 ? daySales * 0.95 : avgDailySales * 0.95
      })
      
      currentDate = addDays(currentDate, 1)
    }
    
    return dailyData
  }, [filteredOrders, actualSales, dateRange])

  const currentDate = format(new Date(), "EEEE, d MMM yyyy")

  const handlePeriodChange = (period: 'day' | 'week' | 'month') => {
    setActivePeriod(period)
    const now = new Date()
    
    switch (period) {
      case 'day':
        setDateRange({ from: startOfDay(now), to: endOfDay(now) })
        break
      case 'week':
        setDateRange({ from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) })
        break
      case 'month':
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) })
        break
    }
  }

  const handlePrevNext = (direction: 'prev' | 'next') => {
    const days = differenceInDays(dateRange.to, dateRange.from) + 1
    const multiplier = direction === 'prev' ? -1 : 1
    
    setDateRange({
      from: addDays(dateRange.from, days * multiplier),
      to: addDays(dateRange.to, days * multiplier)
    })
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Date Controls */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Overview of your venue performance</p>
          </div>
          
          <div className="flex gap-2 items-center">
            <Button 
              variant={activePeriod === 'day' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePeriodChange('day')}
            >
              Day
            </Button>
            <Button 
              variant={activePeriod === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePeriodChange('week')}
            >
              Week
            </Button>
            <Button 
              variant={activePeriod === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePeriodChange('month')}
            >
              Month
            </Button>
            <div className="border-l mx-2 h-6"></div>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => handlePrevNext('prev')}
            >
              ← Prev
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => setDateRange({ from: startOfDay(new Date()), to: endOfDay(new Date()) })}
            >
              Today
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => handlePrevNext('next')}
            >
              Next →
            </Button>
            <span className="text-sm text-muted-foreground ml-2">
              {format(dateRange.from, 'dd MMM yyyy')} - {format(dateRange.to, 'dd MMM yyyy')}
            </span>
          </div>
        </div>


        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Sales vs Forecast"
            current={`$${actualSales.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            target={`$${forecastTarget.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            status={hasData ? "positive" : "neutral"}
            statusText={hasData ? vsForecasts : "0%"}
            icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          />
          
          <KpiCard
            title="Labour %"
            current={labourMetrics && labourMetrics.labour_percent > 0 ? `${labourMetrics.labour_percent.toFixed(1)}%` : "0%"}
            target="25%"
            status={labourMetrics && labourMetrics.labour_percent > 0 
              ? (labourMetrics.labour_percent <= 25 ? "positive" : "warning")
              : "neutral"}
            statusText={labourMetrics && labourMetrics.labour_percent > 0
              ? (labourMetrics.labour_percent <= 25 ? "On Target" : "Over Target")
              : "0%"}
            icon={<ArrowDown className="h-4 w-4 text-muted-foreground" />}
          />
          
          <KpiCard
            title="Food Cost %"
            current="0%"
            target="26%"
            status="neutral"
            statusText="0%"
            icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
          />
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cash Runway</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0 days</div>
              <Progress value={0} className="mt-3" />
              <p className="text-xs text-muted-foreground mt-2">
                Add financial data to track runway
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle>
              Sales vs Forecast ({differenceInDays(dateRange.to, dateRange.from) + 1} Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!hasData ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <p className="mb-2">No sales data for this period</p>
                  <p className="text-sm">Import sales data to see your performance</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis 
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value) => [`$${Number(value).toLocaleString()}`, '']}
                    labelStyle={{ color: '#000' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="actual" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="Actual"
                    dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="forecast" 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Forecast"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* AI Suggestions */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Bot className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Smart Suggestions</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                  <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-sm">Optimize Labour Schedule</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {hasData ? "Peak hours detected on Friday 6-9pm" : "Import sales data to see labour optimization suggestions"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!hasData} className="bg-green-600 hover:bg-green-700">
                      Review
                    </Button>
                    <Button size="sm" variant="ghost" disabled={!hasData}>
                      Ignore
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-sm">Reduce Food Waste</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {hasData ? "Adjust order guide for slow-moving items" : "Import waste data to see reduction opportunities"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!hasData} className="bg-green-600 hover:bg-green-700">
                      Review
                    </Button>
                    <Button size="sm" variant="ghost" disabled={!hasData}>
                      Ignore
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-sm">Menu Optimization</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {hasData ? "Promote high-margin items with bundles" : "Import menu and sales data for optimization tips"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!hasData} className="bg-green-600 hover:bg-green-700">
                      Review
                    </Button>
                    <Button size="sm" variant="ghost" disabled={!hasData}>
                      Ignore
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Today's Tasks */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Tasks</CardTitle>
            <p className="text-sm text-muted-foreground">{currentDate}</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Checkbox id="task1" disabled={!hasData} />
                <label htmlFor="task1" className="text-sm flex-1 cursor-pointer">
                  Review today's roster and approve timesheets
                </label>
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Checkbox id="task2" disabled={!hasData} />
                <label htmlFor="task2" className="text-sm flex-1 cursor-pointer">
                  Submit purchase orders for Friday delivery
                </label>
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Checkbox id="task3" disabled={!hasData} />
                <label htmlFor="task3" className="text-sm flex-1 cursor-pointer">
                  Complete stock count for dry goods
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
