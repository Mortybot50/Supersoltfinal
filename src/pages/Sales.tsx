import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/AuthContext"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  subWeeks,
  parseISO,
} from "date-fns"
import {
  Download,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShoppingCart,
  DollarSign,
  Receipt,
  FileSpreadsheet,
  RefreshCw,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { PageShell, PageToolbar, StatusBadge, EmptyState } from "@/components/shared"
import { StatCards } from "@/components/ui/StatCards"
import { SecondaryStats } from "@/components/ui/SecondaryStats"

// ─── Types ──────────────────────────────────────────
type DatePreset = "today" | "yesterday" | "this-week" | "last-week" | "this-month" | "last-30"
type SortField = "order_datetime" | "order_number" | "channel" | "gross_amount" | "tax_amount" | "net_amount" | "payment_method"
type SortDir = "asc" | "desc"

interface OrderRow {
  id: string
  order_number: string | null
  order_datetime: string
  channel: string
  gross_amount: number
  tax_amount: number
  net_amount: number
  is_void: boolean
  is_refund: boolean
  refund_reason: string | null
  payment_method: string | null
  discount_amount: number
}

// ─── Helpers ────────────────────────────────────────
function getDateRange(preset: DatePreset) {
  const now = new Date()
  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) }
    case "yesterday": {
      const y = subDays(now, 1)
      return { start: startOfDay(y), end: endOfDay(y) }
    }
    case "this-week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
    case "last-week": {
      const lw = subWeeks(now, 1)
      return { start: startOfWeek(lw, { weekStartsOn: 1 }), end: endOfWeek(lw, { weekStartsOn: 1 }) }
    }
    case "this-month":
      return { start: startOfMonth(now), end: endOfMonth(now) }
    case "last-30":
      return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) }
  }
}

const fmtDollars = (cents: number) => {
  const abs = Math.abs(cents / 100)
  const sign = cents < 0 ? "-" : ""
  return `${sign}$${abs.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const channelLabel = (ch: string) => {
  const map: Record<string, string> = {
    "dine-in": "Dine-in",
    takeaway: "Takeaway",
    delivery: "Delivery",
    online: "Online",
  }
  return map[ch] || ch.charAt(0).toUpperCase() + ch.slice(1)
}

const paymentLabel = (pm: string | null) => {
  if (!pm) return "Unknown"
  const map: Record<string, string> = {
    card: "Card",
    cash: "Cash",
    digital_wallet: "Digital Wallet",
    eftpos: "EFTPOS",
  }
  return map[pm] || pm.charAt(0).toUpperCase() + pm.slice(1).replace(/_/g, " ")
}

// ─── Component ──────────────────────────────────────
export default function Sales() {
  const { currentVenue } = useAuth()
  const venueId = currentVenue?.id

  const [datePreset, setDatePreset] = useState<DatePreset>("today")
  const [channelFilter, setChannelFilter] = useState<string>("all")
  const [paymentFilter, setPaymentFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("order_datetime")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset])

  // ─── Query ──────────────────────────────────────
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["salesOrders", venueId, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, order_datetime, channel, gross_amount, tax_amount, net_amount, discount_amount, is_void, is_refund, refund_reason, payment_method")
        .eq("venue_id", venueId!)
        .gte("order_datetime", dateRange.start.toISOString())
        .lte("order_datetime", dateRange.end.toISOString())
        .order("order_datetime", { ascending: false })
      if (error) throw error
      return (data || []) as OrderRow[]
    },
    enabled: !!venueId,
  })

  // ─── Unique filter options ──────────────────────
  const channels = useMemo(() => [...new Set(orders.map((o) => o.channel))].sort(), [orders])
  const paymentMethods = useMemo(() => [...new Set(orders.map((o) => o.payment_method || "unknown"))].sort(), [orders])

  // ─── Filter + search + sort ─────────────────────
  const filteredOrders = useMemo(() => {
    let result = orders

    if (channelFilter !== "all") {
      result = result.filter((o) => o.channel === channelFilter)
    }
    if (paymentFilter !== "all") {
      result = result.filter((o) => (o.payment_method || "unknown") === paymentFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (o) =>
          (o.order_number || "").toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q)
      )
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "order_datetime":
          cmp = new Date(a.order_datetime).getTime() - new Date(b.order_datetime).getTime()
          break
        case "order_number":
          cmp = (a.order_number || "").localeCompare(b.order_number || "")
          break
        case "channel":
          cmp = a.channel.localeCompare(b.channel)
          break
        case "gross_amount":
          cmp = a.gross_amount - b.gross_amount
          break
        case "tax_amount":
          cmp = a.tax_amount - b.tax_amount
          break
        case "net_amount":
          cmp = a.net_amount - b.net_amount
          break
        case "payment_method":
          cmp = (a.payment_method || "").localeCompare(b.payment_method || "")
          break
      }
      return sortDir === "asc" ? cmp : -cmp
    })

    return result
  }, [orders, channelFilter, paymentFilter, searchQuery, sortField, sortDir])

  // ─── Summary stats ──────────────────────────────
  const stats = useMemo(() => {
    const valid = filteredOrders.filter((o) => !o.is_void)
    const sales = valid.filter((o) => !o.is_refund)
    const refunds = valid.filter((o) => o.is_refund)
    const totalRevenue = sales.reduce((s, o) => s + o.net_amount, 0)
    const totalRefunds = refunds.reduce((s, o) => s + o.net_amount, 0)
    const totalTax = sales.reduce((s, o) => s + o.tax_amount, 0)
    const avgCheck = sales.length > 0 ? totalRevenue / sales.length : 0

    return {
      totalOrders: sales.length,
      totalRevenue,
      totalRefunds,
      totalTax,
      avgCheck,
      refundCount: refunds.length,
      voidCount: filteredOrders.filter((o) => o.is_void).length,
    }
  }, [filteredOrders])

  // ─── Sort handler ───────────────────────────────
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir(field === "order_datetime" ? "desc" : "asc")
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />
  }

  // ─── CSV Export ─────────────────────────────────
  const handleExport = () => {
    if (filteredOrders.length === 0) {
      toast.error("No transactions to export")
      return
    }
    const header = "Date/Time,Order #,Channel,Gross,Tax,Discount,Net,Payment,Source,Status"
    const rows = filteredOrders.map((o) => {
      const status = o.is_void ? "Void" : o.is_refund ? "Refund" : "Sale"
      return [
        format(parseISO(o.order_datetime), "yyyy-MM-dd HH:mm"),
        `"${o.order_number || o.id.slice(0, 8)}"`,
        channelLabel(o.channel),
        (o.gross_amount / 100).toFixed(2),
        (o.tax_amount / 100).toFixed(2),
        (o.discount_amount / 100).toFixed(2),
        (o.net_amount / 100).toFixed(2),
        paymentLabel(o.payment_method),
        "manual",
        status,
      ].join(",")
    })
    const csv = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `sales-${format(dateRange.start, "yyyy-MM-dd")}-to-${format(dateRange.end, "yyyy-MM-dd")}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filteredOrders.length} transactions`)
  }

  // ─── Clear filters ──────────────────────────────
  const hasActiveFilters = channelFilter !== "all" || paymentFilter !== "all" || searchQuery.trim() !== ""
  const clearFilters = () => {
    setChannelFilter("all")
    setPaymentFilter("all")
    setSearchQuery("")
  }

  // ─── Toolbar ────────────────────────────────────
  const toolbar = (
    <PageToolbar
      title="Sales"
      filters={
        <div className="flex items-center gap-2">
          <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="last-week">Last Week</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-30">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {format(dateRange.start, "d MMM")} – {format(dateRange.end, "d MMM yyyy")}
          </span>
        </div>
      }
      primaryAction={{
        label: "Export CSV",
        icon: Download,
        onClick: handleExport,
        variant: "export",
      }}
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      {/* Stat cards */}
      <div className="px-4 pt-4 space-y-3">
        <StatCards stats={[
          { label: "Orders", value: stats.totalOrders },
          { label: "Revenue", value: fmtDollars(stats.totalRevenue) },
          { label: "Avg Check", value: fmtDollars(stats.avgCheck) },
        ]} columns={3} />
        <SecondaryStats stats={[
          { label: "Tax Collected", value: fmtDollars(stats.totalTax) },
          { label: "Refunds", value: `${stats.refundCount} (${fmtDollars(stats.totalRefunds)})` },
          { label: "Voids", value: stats.voidCount },
        ]} />
      </div>

      {/* Filter bar */}
      <div className="border-b bg-white dark:bg-gray-800 px-4 py-2 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search order #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-[180px] pl-8 text-sm"
          />
        </div>

        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="h-8 w-[120px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            {channels.map((ch) => (
              <SelectItem key={ch} value={ch}>{channelLabel(ch)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="h-8 w-[130px]">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            {paymentMethods.map((pm) => (
              <SelectItem key={pm} value={pm}>{paymentLabel(pm)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={clearFilters}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}

        <div className="flex-1" />

        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => refetch()}>
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>

        <span className="text-xs text-muted-foreground">
          {filteredOrders.length} of {orders.length} transactions
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading transactions...
          </div>
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="No transactions found"
            description={orders.length === 0 ? "No sales data for this period" : "Try adjusting your filters"}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button className="flex items-center text-xs font-medium" onClick={() => handleSort("order_datetime")}>
                    Date/Time <SortIcon field="order_datetime" />
                  </button>
                </TableHead>
                <TableHead>
                  <button className="flex items-center text-xs font-medium" onClick={() => handleSort("order_number")}>
                    Order # <SortIcon field="order_number" />
                  </button>
                </TableHead>
                <TableHead>
                  <button className="flex items-center text-xs font-medium" onClick={() => handleSort("channel")}>
                    Channel <SortIcon field="channel" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="flex items-center justify-end text-xs font-medium ml-auto" onClick={() => handleSort("gross_amount")}>
                    Gross <SortIcon field="gross_amount" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="flex items-center justify-end text-xs font-medium ml-auto" onClick={() => handleSort("tax_amount")}>
                    Tax <SortIcon field="tax_amount" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button className="flex items-center justify-end text-xs font-medium ml-auto" onClick={() => handleSort("net_amount")}>
                    Net <SortIcon field="net_amount" />
                  </button>
                </TableHead>
                <TableHead>
                  <button className="flex items-center text-xs font-medium" onClick={() => handleSort("payment_method")}>
                    Payment <SortIcon field="payment_method" />
                  </button>
                </TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((o) => {
                const isRefund = o.is_refund
                const isVoid = o.is_void
                return (
                  <TableRow
                    key={o.id}
                    className={isVoid ? "opacity-50 line-through" : isRefund ? "bg-red-50/50 dark:bg-red-950/20" : ""}
                  >
                    <TableCell className="text-sm tabular-nums">
                      {format(parseISO(o.order_datetime), "d MMM HH:mm")}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {o.order_number || o.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={o.channel as "dine-in" | "takeaway" | "delivery" | "online"} size="sm" />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {fmtDollars(o.gross_amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                      {fmtDollars(o.tax_amount)}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums text-sm font-medium ${isRefund ? "text-red-600" : ""}`}>
                      {isRefund ? "-" : ""}{fmtDollars(o.net_amount)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {paymentLabel(o.payment_method)}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">Manual</span>
                    </TableCell>
                    <TableCell>
                      {isVoid ? (
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">Void</span>
                      ) : isRefund ? (
                        <span className="text-xs font-medium text-red-600 bg-red-50 dark:bg-red-950 px-1.5 py-0.5 rounded">Refund</span>
                      ) : (
                        <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-950 px-1.5 py-0.5 rounded">Sale</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </PageShell>
  )
}
