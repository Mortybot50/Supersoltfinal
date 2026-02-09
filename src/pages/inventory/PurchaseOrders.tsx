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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDataStore } from '@/lib/store/dataStore'
import { PurchaseOrder } from '@/types'
import { format } from 'date-fns'
import { PageShell, PageToolbar, PageSidebar, StatusBadge } from '@/components/shared'

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

export default function PurchaseOrders() {
  const navigate = useNavigate()
  const { purchaseOrders, suppliers, loadPurchaseOrdersFromDB, loadSuppliersFromDB } = useDataStore()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  
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
          po.po_number.toLowerCase().includes(query) ||
          po.supplier_name.toLowerCase().includes(query) ||
          po.notes?.toLowerCase().includes(query)
      )
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter((po) => po.status === statusFilter)
    }
    
    if (supplierFilter !== 'all') {
      filtered = filtered.filter((po) => po.supplier_id === supplierFilter)
    }
    
    return filtered.sort(
      (a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
    )
  }, [purchaseOrders, searchQuery, statusFilter, supplierFilter])
  
  const stats = useMemo(() => {
    return {
      total: purchaseOrders.length,
      draft: purchaseOrders.filter((po) => po.status === 'draft').length,
      submitted: purchaseOrders.filter((po) => po.status === 'submitted').length,
      pending: purchaseOrders.filter((po) => 
        po.status === 'submitted' || po.status === 'confirmed'
      ).length,
    }
  }, [purchaseOrders])
  
  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft
  }
  
  const sidebar = (
    <PageSidebar
      title="Orders"
      metrics={[
        { label: "Total", value: stats.total },
        { label: "Draft", value: stats.draft },
        { label: "Submitted", value: stats.submitted },
        { label: "Pending", value: stats.pending },
      ]}
    />
  )

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
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
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
        </div>
      }
      primaryAction={{ label: "Create Order", icon: Plus, onClick: () => navigate('/inventory/order-guide'), variant: "teal" }}
    />
  )

  return (
    <PageShell sidebar={sidebar} toolbar={toolbar}>
      <div className="p-4">
      {filteredPOs.length === 0 ? (
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
                
                return (
                  <TableRow
                    key={po.id}
                    className="cursor-pointer hover:bg-muted/50"
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
                      {format(new Date(po.order_date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      {format(new Date(po.expected_delivery_date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{po.items?.length || 0} items</Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${((po.total) / 100).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig.variant}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
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
