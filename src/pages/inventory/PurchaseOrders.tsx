import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText,
  Search,
  Plus,
  Eye,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDataStore } from '@/lib/store/dataStore'
import { PurchaseOrder } from '@/types'
import { format, differenceInDays, subDays, startOfMonth, isAfter, isBefore, isValid } from 'date-fns'
import { PageShell, PageToolbar } from '@/components/shared'
import { StatCards } from '@/components/ui/StatCards'
import { SecondaryStats } from '@/components/ui/SecondaryStats'
import { formatCurrency } from '@/lib/utils/formatters'

/** Safe date formatter — returns fallback instead of throwing on invalid dates */
function safeFormat(date: unknown, fmt: string, fallback = '—'): string {
  try {
    const d = date instanceof Date ? date : new Date(date as string | number)
    return isValid(d) ? format(d, fmt) : fallback
  } catch {
    return fallback
  }
}

const STATUS_CONFIG = {
  draft: {
    label: 'Draft',
    variant: 'secondary' as const,
    icon: Clock,
    color: 'text-muted-foreground',
  },
  submitted: {
    label: 'Submitted',
    variant: 'default' as const,
    icon: Send,
    color: 'text-blue-600',
  },
  confirmed: {
    label: 'Confirmed',
    variant: 'default' as const,
    icon: CheckCircle,
    color: 'text-purple-600',
  },
  delivered: {
    label: 'Delivered',
    variant: 'default' as const,
    icon: Package,
    color: 'text-green-600',
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'destructive' as const,
    icon: XCircle,
    color: 'text-destructive',
  },
}

function isOverdue(po: PurchaseOrder): boolean {
  if (po.status === 'delivered' || po.status === 'cancelled' || po.status === 'draft') return false
  try {
    const d = new Date(po.expected_delivery_date)
    return isValid(d) && isBefore(d, new Date())
  } catch {
    return false
  }
}

export default function PurchaseOrders() {
  const navigate = useNavigate()
  const { purchaseOrders, suppliers, isLoading, loadPurchaseOrdersFromDB, loadSuppliersFromDB } = useDataStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')

  useEffect(() => {
    loadPurchaseOrdersFromDB()
    loadSuppliersFromDB()
  }, [])

  const filteredPOs = useMemo(() => {
    let filtered = purchaseOrders

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (po) =>
          (po.po_number ?? '').toLowerCase().includes(query) ||
          (po.supplier_name ?? '').toLowerCase().includes(query) ||
          po.notes?.toLowerCase().includes(query)
      )
    }

    if (statusFilter === 'overdue') {
      filtered = filtered.filter((po) => isOverdue(po))
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter((po) => po.status === statusFilter)
    }

    if (supplierFilter !== 'all') {
      filtered = filtered.filter((po) => po.supplier_id === supplierFilter)
    }

    if (dateFilter !== 'all') {
      const now = new Date()
      let startDate: Date
      switch (dateFilter) {
        case 'week':
          startDate = subDays(now, 7)
          break
        case 'month':
          startDate = startOfMonth(now)
          break
        case '3months':
          startDate = subDays(now, 90)
          break
        default:
          startDate = new Date(0)
      }
      filtered = filtered.filter((po) => {
        try {
          const d = new Date(po.order_date)
          return isValid(d) && isAfter(d, startDate)
        } catch { return true }
      })
    }

    return filtered.sort(
      (a, b) => (new Date(b.order_date).getTime() || 0) - (new Date(a.order_date).getTime() || 0)
    )
  }, [purchaseOrders, searchQuery, statusFilter, supplierFilter, dateFilter])

  const stats = useMemo(() => {
    const total = purchaseOrders.length
    const draft = purchaseOrders.filter((po) => po.status === 'draft').length
    const pending = purchaseOrders.filter((po) =>
      po.status === 'submitted' || po.status === 'confirmed'
    ).length
    const overdue = purchaseOrders.filter((po) => isOverdue(po)).length
    const delivered = purchaseOrders.filter((po) => po.status === 'delivered').length
    const totalValue = purchaseOrders
      .filter((po) => po.status !== 'cancelled')
      .reduce((sum, po) => sum + po.total, 0)
    const pendingValue = purchaseOrders
      .filter((po) => po.status === 'submitted' || po.status === 'confirmed')
      .reduce((sum, po) => sum + po.total, 0)

    return { total, draft, pending, overdue, delivered, totalValue, pendingValue }
  }, [purchaseOrders])

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft
  }

  const toolbar = (
    <PageToolbar
      title="Purchase Orders"
      filters={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search PO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-[180px] pl-8 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="overdue">
                Overdue {stats.overdue > 0 && `(${stats.overdue})`}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue placeholder="All Suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
      primaryAction={{ label: "Create Order", icon: Plus, onClick: () => navigate('/inventory/order-guide'), variant: "primary" }}
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-4 pt-4 space-y-3">
        <StatCards stats={[
          { label: "Total", value: stats.total },
          { label: "Draft", value: stats.draft },
          { label: "Pending", value: stats.pending },
          { label: "Delivered", value: stats.delivered },
        ]} columns={4} />
        <SecondaryStats stats={[
          ...(stats.overdue > 0 ? [{ label: "Overdue", value: stats.overdue }] : []),
          { label: "Pending Value", value: formatCurrency(stats.pendingValue) },
          { label: "Total Value", value: formatCurrency(stats.totalValue) },
        ]} />
      </div>
      <div className="p-4">
      {/* Overdue alert banner */}
      {stats.overdue > 0 && statusFilter !== 'overdue' && (
        <div className="mb-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-800 dark:text-red-200">
              {stats.overdue} purchase order{stats.overdue !== 1 ? 's' : ''} overdue
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={() => setStatusFilter('overdue')}
          >
            View Overdue
          </Button>
        </div>
      )}

      {isLoading && purchaseOrders.length === 0 ? (
        <Card className="p-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
          <p className="text-muted-foreground">Loading purchase orders...</p>
        </Card>
      ) : filteredPOs.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {purchaseOrders.length === 0 ? 'No Purchase Orders Yet' : 'No Orders Found'}
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            {purchaseOrders.length === 0
              ? 'Create your first order from the Order Guide'
              : 'Try adjusting your filters'}
          </p>
          {purchaseOrders.length === 0 && (
            <Button onClick={() => navigate('/inventory/order-guide')}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Order
            </Button>
          )}
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Expected Delivery</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPOs.map((po: PurchaseOrder) => {
                const statusConfig = getStatusConfig(po.status)
                const StatusIcon = statusConfig.icon
                const overdue = isOverdue(po)
                const daysOverdue = overdue
                  ? differenceInDays(new Date(), new Date(po.expected_delivery_date))
                  : 0

                return (
                  <TableRow
                    key={po.id}
                    className={`cursor-pointer hover:bg-muted/50 ${overdue ? 'bg-red-50/50 dark:bg-red-950/30' : ''}`}
                    onClick={() => navigate(`/inventory/purchase-orders/${po.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{po.po_number}</span>
                      </div>
                    </TableCell>
                    <TableCell>{po.supplier_name}</TableCell>
                    <TableCell>
                      {safeFormat(po.order_date, 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={overdue ? 'text-red-600 font-semibold' : ''}>
                          {safeFormat(po.expected_delivery_date, 'dd MMM yyyy')}
                        </span>
                        {overdue && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            {daysOverdue}d late
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{po.items?.length || 0} items</Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(po.total)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant={statusConfig.variant}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/inventory/purchase-orders/${po.id}`)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
      </div>
    </PageShell>
  )
}
