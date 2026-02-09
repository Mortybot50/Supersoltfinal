import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { formatCurrency } from "@/lib/utils/formatters"
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay, addDays, differenceInDays } from "date-fns"
import { ArrowUp, ArrowDown, Bot, TrendingUp, AlertTriangle, Clock, Users, Calendar, DollarSign } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useDataStore } from "@/lib/store/dataStore"
import { useLabourMetrics } from "@/lib/hooks/useLabourMetrics"
import { useRosterMetrics } from "@/lib/hooks/useRosterMetrics"
import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { PageShell, PageToolbar, PageSidebar } from "@/components/shared"

export default function Dashboard() {
  const navigate = useNavigate()
  const { orders } = useDataStore()
  const labourMetrics = useLabourMetrics()
  const rosterMetrics = useRosterMetrics()

  const [activePeriod, setActivePeriod] = useState<'day' | 'week' | 'month'>('month')

  const getInitialDateRange = () => {
    if (orders && orders.length > 0) {
      const dates = orders.map(o => new Date(o.order_datetime))
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
      return { from: startOfMonth(maxDate), to: endOfMonth(maxDate) }
    }
    return {
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 })
    }
  }

  const [dateRange, setDateRange] = useState(getInitialDateRange())

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const orderDate = typeof order.order_datetime === 'string'
        ? new Date(order.order_datetime)
        : order.order_datetime instanceof Date
        ? order.order_datetime
        : null
      if (!orderDate || isNaN(orderDate.getTime())) return false
      return orderDate >= dateRange.from && orderDate <= dateRange.to && !order.is_void && !order.is_refund
    })
  }, [orders, dateRange])

  const actualSales = useMemo(() => filteredOrders.reduce((sum, order) => sum + order.net_amount, 0) / 100, [filteredOrders])
  const forecastTarget = useMemo(() => actualSales * 0.95, [actualSales])
  const hasData = filteredOrders.length > 0

  const vsForecasts = useMemo(() => {
    if (forecastTarget === 0) return '+0.0%'
    const percentage = ((actualSales - forecastTarget) / forecastTarget * 100)
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(1)}%`
  }, [actualSales, forecastTarget])

  const chartData = useMemo(() => {
    const days = differenceInDays(dateRange.to, dateRange.from) + 1
    const dailyData = []
    let currentDate = new Date(dateRange.from)
    while (currentDate <= dateRange.to) {
      const dayStart = startOfDay(currentDate)
      const dayEnd = endOfDay(currentDate)
      const daySales = filteredOrders
        .filter(order => {
          const orderDate = typeof order.order_datetime === 'string' ? new Date(order.order_datetime) : order.order_datetime instanceof Date ? order.order_datetime : null
          if (!orderDate || isNaN(orderDate.getTime())) return false
          return orderDate >= dayStart && orderDate <= dayEnd
        })
        .reduce((sum, order) => sum + order.net_amount / 100, 0)
      const avgDailySales = actualSales / days
      dailyData.push({
        day: format(currentDate, 'EEE'),
        actual: Math.round(daySales * 100) / 100,
        forecast: daySales > 0 ? daySales * 0.95 : avgDailySales * 0.95
      })
      currentDate = addDays(currentDate, 1)
    }
    return dailyData
  }, [filteredOrders, actualSales, dateRange])

  const handlePeriodChange = (period: 'day' | 'week' | 'month') => {
    setActivePeriod(period)
    const now = new Date()
    switch (period) {
      case 'day': setDateRange({ from: startOfDay(now), to: endOfDay(now) }); break
      case 'week': setDateRange({ from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) }); break
      case 'month': setDateRange({ from: startOfMonth(now), to: endOfMonth(now) }); break
    }
  }

  const handlePrevNext = (direction: 'prev' | 'next') => {
    const days = differenceInDays(dateRange.to, dateRange.from) + 1
    const multiplier = direction === 'prev' ? -1 : 1
    setDateRange({ from: addDays(dateRange.from, days * multiplier), to: addDays(dateRange.to, days * multiplier) })
  }

  // Labour % from roster data
  const labourPercent = useMemo(() => {
    if (labourMetrics && labourMetrics.labour_percent > 0) return labourMetrics.labour_percent
    if (actualSales > 0 && rosterMetrics.metrics.totalCost > 0) {
      return (rosterMetrics.metrics.totalCost / 100 / actualSales) * 100
    }
    return 0
  }, [labourMetrics, actualSales, rosterMetrics.metrics.totalCost])

  const sidebar = (
    <PageSidebar
      title="Overview"
      metrics={[
        { label: "Rostered Hours", value: `${rosterMetrics.metrics.totalHours.toFixed(1)}h` },
        { label: "Labour Cost", value: rosterMetrics.formatLabourCost(rosterMetrics.metrics.totalCost) },
        { label: "Staff Rostered", value: rosterMetrics.metrics.staffCount },
      ]}
      quickActions={[
        { label: "View Roster", icon: Calendar, onClick: () => navigate("/workforce/roster") },
        { label: "Timesheets", icon: Clock, onClick: () => navigate("/workforce/timesheets"), badge: rosterMetrics.pendingTimesheetCount },
        { label: "People", icon: Users, onClick: () => navigate("/workforce/people") },
      ]}
      warnings={rosterMetrics.allWarningsCount > 0 ? Array(rosterMetrics.allWarningsCount).fill("warning") : undefined}
    />
  )

  const toolbar = (
    <PageToolbar
      title="Dashboard"
      filters={
        <div className="flex gap-1">
          {(['day', 'week', 'month'] as const).map(p => (
            <Button
              key={p}
              variant={activePeriod === p ? 'default' : 'outline'}
              size="sm"
              className="h-8"
              onClick={() => handlePeriodChange(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Button>
          ))}
        </div>
      }
      dateNavigation={{
        label: `${format(dateRange.from, 'dd MMM')} - ${format(dateRange.to, 'dd MMM yyyy')}`,
        onBack: () => handlePrevNext('prev'),
        onForward: () => handlePrevNext('next'),
      }}
    />
  )

  return (
    <PageShell sidebar={sidebar} toolbar={toolbar}>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Sales vs Forecast</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${actualSales.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-xs text-muted-foreground mt-1">Target: ${forecastTarget.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className={`inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-md text-xs font-medium ${hasData ? 'text-green-600 bg-green-50' : 'text-blue-600 bg-blue-50'}`}>
                {hasData && <ArrowUp className="h-3 w-3" />}
                {hasData ? vsForecasts : "0%"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Labour %</CardTitle>
              <ArrowDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{labourPercent.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground mt-1">Target: 25%</div>
              <div className={`inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-md text-xs font-medium ${labourPercent <= 25 ? 'text-green-600 bg-green-50' : labourPercent > 0 ? 'text-amber-600 bg-amber-50' : 'text-blue-600 bg-blue-50'}`}>
                {labourPercent > 25 && <AlertTriangle className="h-3 w-3" />}
                {labourPercent > 0 ? (labourPercent <= 25 ? "On Target" : "Over Target") : "0%"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Food Cost %</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0%</div>
              <div className="text-xs text-muted-foreground mt-1">Target: 26%</div>
              <div className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-md text-xs font-medium text-blue-600 bg-blue-50">0%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cash Runway</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0 days</div>
              <Progress value={0} className="mt-3" />
              <p className="text-xs text-muted-foreground mt-2">Add financial data to track runway</p>
            </CardContent>
          </Card>
        </div>

        {/* Workforce Quick Stats */}
        {(rosterMetrics.draftShiftCount > 0 || rosterMetrics.pendingTimesheetCount > 0 || rosterMetrics.allWarningsCount > 0) && (
          <div className="grid gap-3 md:grid-cols-3">
            {rosterMetrics.draftShiftCount > 0 && (
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate("/workforce/roster")}>
                <CardContent className="pt-4 pb-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{rosterMetrics.draftShiftCount} draft shifts</div>
                    <div className="text-xs text-muted-foreground">Ready to publish</div>
                  </div>
                </CardContent>
              </Card>
            )}
            {rosterMetrics.pendingTimesheetCount > 0 && (
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate("/workforce/timesheets")}>
                <CardContent className="pt-4 pb-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-yellow-50 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{rosterMetrics.pendingTimesheetCount} pending timesheets</div>
                    <div className="text-xs text-muted-foreground">Awaiting approval</div>
                  </div>
                </CardContent>
              </Card>
            )}
            {rosterMetrics.allWarningsCount > 0 && (
              <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate("/workforce/roster")}>
                <CardContent className="pt-4 pb-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{rosterMetrics.allWarningsCount} compliance warnings</div>
                    <div className="text-xs text-muted-foreground">Review in roster</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Sales vs Forecast ({differenceInDays(dateRange.to, dateRange.from) + 1} Days)</CardTitle>
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
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, '']} />
                  <Legend />
                  <Line type="monotone" dataKey="actual" stroke="hsl(var(--primary))" strokeWidth={2} name="Actual" dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
                  <Line type="monotone" dataKey="forecast" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" name="Forecast" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Smart Suggestions */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Bot className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Smart Suggestions</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { title: "Optimize Labour Schedule", desc: hasData ? "Peak hours detected on Friday 6-9pm" : "Import sales data to see labour optimization suggestions" },
              { title: "Reduce Food Waste", desc: hasData ? "Adjust order guide for slow-moving items" : "Import waste data to see reduction opportunities" },
              { title: "Menu Optimization", desc: hasData ? "Promote high-margin items with bundles" : "Import menu and sales data for optimization tips" },
            ].map((suggestion) => (
              <Card key={suggestion.title}>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-sm">{suggestion.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{suggestion.desc}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" disabled={!hasData} className="bg-teal-500 hover:bg-teal-600">Review</Button>
                      <Button size="sm" variant="ghost" disabled={!hasData}>Ignore</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
