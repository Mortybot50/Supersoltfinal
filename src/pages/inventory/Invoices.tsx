import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText,
  Search,
  Upload,
  Eye,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  Mail,
  Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDataStore } from '@/lib/store/dataStore'
import { useAuth } from '@/contexts/AuthContext'
import { Invoice } from '@/types'
import { format, isValid } from 'date-fns'
import { PageShell, PageToolbar } from '@/components/shared'
import { StatCards } from '@/components/ui/StatCards'
import { SecondaryStats } from '@/components/ui/SecondaryStats'
import { formatCurrency } from '@/lib/utils/formatters'

function safeFormat(date: unknown, fmt: string, fallback = '—'): string {
  try {
    const d = date instanceof Date ? date : new Date(date as string)
    return isValid(d) ? format(d, fmt) : fallback
  } catch {
    return fallback
  }
}

const STATUS_CONFIG: Record<Invoice['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType; color: string }> = {
  pending_review: { label: 'Pending Review', variant: 'secondary', icon: Clock, color: 'text-amber-600' },
  confirmed: { label: 'Confirmed', variant: 'default', icon: CheckCircle, color: 'text-green-600' },
  disputed: { label: 'Disputed', variant: 'destructive', icon: AlertCircle, color: 'text-destructive' },
  duplicate: { label: 'Duplicate', variant: 'outline', icon: Copy, color: 'text-muted-foreground' },
}

export default function Invoices() {
  const navigate = useNavigate()
  const { currentVenue } = useAuth()
  const { invoices, suppliers, loadInvoicesFromDB } = useDataStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Invoice['status']>('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'upload' | 'email'>('all')
  const [dateFilter, setDateFilter] = useState('all')

  useEffect(() => {
    if (currentVenue?.id && currentVenue.id !== 'all') {
      loadInvoicesFromDB(currentVenue.id)
    }
  }, [currentVenue?.id, loadInvoicesFromDB])

  const venueInvoices = useMemo(() => {
    if (!currentVenue?.id || currentVenue.id === 'all') return invoices
    return invoices.filter(inv => inv.venue_id === currentVenue.id)
  }, [invoices, currentVenue?.id])

  const filtered = useMemo(() => {
    let items = venueInvoices

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(inv =>
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.supplier_name?.toLowerCase().includes(q) ||
        inv.original_filename?.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'all') {
      items = items.filter(inv => inv.status === statusFilter)
    }

    if (supplierFilter !== 'all') {
      items = items.filter(inv => inv.supplier_id === supplierFilter)
    }

    if (sourceFilter !== 'all') {
      items = items.filter(inv => inv.source === sourceFilter)
    }

    if (dateFilter !== 'all') {
      const now = new Date()
      const cutoff = dateFilter === '7d'
        ? new Date(now.getTime() - 7 * 86400000)
        : dateFilter === '30d'
        ? new Date(now.getTime() - 30 * 86400000)
        : new Date(now.getTime() - 90 * 86400000)
      items = items.filter(inv => inv.invoice_date && new Date(inv.invoice_date) >= cutoff)
    }

    return items.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }, [venueInvoices, searchQuery, statusFilter, supplierFilter, sourceFilter, dateFilter])

  const stats = useMemo(() => {
    const total = venueInvoices.length
    const pending = venueInvoices.filter(i => i.status === 'pending_review').length
    const confirmed = venueInvoices.filter(i => i.status === 'confirmed').length
    const disputed = venueInvoices.filter(i => i.status === 'disputed').length
    const totalValue = venueInvoices.reduce((s, i) => s + (i.total_amount ?? 0), 0)
    const pendingValue = venueInvoices
      .filter(i => i.status === 'pending_review')
      .reduce((s, i) => s + (i.total_amount ?? 0), 0)
    return { total, pending, confirmed, disputed, totalValue, pendingValue }
  }, [venueInvoices])

  const venueSuppliers = useMemo(() => {
    const ids = new Set(venueInvoices.map(i => i.supplier_id).filter(Boolean))
    return suppliers.filter(s => ids.has(s.id))
  }, [venueInvoices, suppliers])

  const toolbar = (
    <PageToolbar
      title="Invoices"
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 w-56"
            />
          </div>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="disputed">Disputed</SelectItem>
              <SelectItem value="duplicate">Duplicate</SelectItem>
            </SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {venueSuppliers.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={v => setSourceFilter(v as typeof sourceFilter)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="upload">Upload</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
      primaryAction={{
        label: 'Upload Invoice',
        icon: Upload,
        onClick: () => navigate('/inventory/invoices/upload'),
        variant: 'default',
      }}
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-4 pt-4 space-y-3">
        <StatCards
          stats={[
            { label: 'Total Invoices', value: stats.total },
            { label: 'Pending Review', value: stats.pending },
            { label: 'Confirmed', value: stats.confirmed },
            { label: 'Disputed', value: stats.disputed },
          ]}
          columns={4}
        />
        <SecondaryStats
          stats={[
            { label: 'Total Value', value: formatCurrency(stats.totalValue * 100) },
            { label: 'Pending Value', value: formatCurrency(stats.pendingValue * 100) },
          ]}
        />
      </div>

      <div className="p-4 md:p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FileText className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No invoices found</p>
            <p className="text-xs mt-1">Upload a supplier invoice to get started</p>
            <Button
              className="mt-4"
              onClick={() => navigate('/inventory/invoices/upload')}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Invoice
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(inv => {
                  const statusCfg = STATUS_CONFIG[inv.status]
                  const StatusIcon = statusCfg.icon
                  return (
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/inventory/invoices/${inv.id}`)}
                    >
                      <TableCell className="text-sm">
                        {safeFormat(inv.invoice_date, 'd MMM yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">
                        {inv.supplier_name ?? '—'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {inv.invoice_number ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {inv.document_type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {inv.total_amount != null
                          ? formatCurrency(inv.total_amount * 100)
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusCfg.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {inv.source === 'email' ? (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Mail className="h-3 w-3" />
                            Email
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Upload className="h-3 w-3" />
                            Upload
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={e => { e.stopPropagation(); navigate(`/inventory/invoices/${inv.id}`) }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </PageShell>
  )
}
