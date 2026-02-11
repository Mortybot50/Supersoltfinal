import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Upload, Mail, MoreVertical, Search, Filter, Copy, Check, DollarSign, TrendingUp, FileText, ShoppingCart } from 'lucide-react'
import { useInvoiceIntakeStore } from '@/stores/useInvoiceIntakeStore'
import { InvoiceUploadDrawer } from './InvoiceUploadDrawer'
import { InvoiceReviewModal } from './InvoiceReviewModal'
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns'
import { formatCurrency } from '@/lib/currency'

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-gray-100 text-gray-700',
  parsing: 'bg-blue-100 text-blue-700',
  needs_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  parsing: 'Parsing',
  needs_review: 'Needs Review',
  approved: 'Approved',
  rejected: 'Rejected',
  failed: 'Failed',
}

export function InvoicesTab() {
  const { jobs, openReviewModal } = useInvoiceIntakeStore()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [emailCopied, setEmailCopied] = useState(false)

  // Filter jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesStatus = statusFilter === 'all' || job.status === statusFilter
      const matchesSearch =
        !searchQuery ||
        job.header_json.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.header_json.supplier_name.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [jobs, statusFilter, searchQuery])

  // Spend tracking
  const spendMetrics = useMemo(() => {
    const now = new Date()
    const thisMonthStart = startOfMonth(now)
    const thisMonthEnd = endOfMonth(now)
    const lastMonthStart = startOfMonth(subMonths(now, 1))
    const lastMonthEnd = endOfMonth(subMonths(now, 1))

    let thisMonth = 0
    let lastMonth = 0
    let totalApproved = 0
    const bySupplier: Record<string, number> = {}

    const approvedJobs = jobs.filter((j) => j.status === 'approved')
    approvedJobs.forEach((job) => {
      const total = job.header_json.total * 100 // convert to cents
      totalApproved += total

      const d = new Date(job.header_json.invoice_date)
      if (isWithinInterval(d, { start: thisMonthStart, end: thisMonthEnd })) thisMonth += total
      if (isWithinInterval(d, { start: lastMonthStart, end: lastMonthEnd })) lastMonth += total

      const supplierName = job.header_json.supplier_name
      bySupplier[supplierName] = (bySupplier[supplierName] || 0) + total
    })

    // Top suppliers by spend
    const topSuppliers = Object.entries(bySupplier)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)

    const monthChange = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0

    return {
      thisMonth,
      lastMonth,
      totalApproved,
      topSuppliers,
      monthChange,
      pendingCount: jobs.filter((j) => j.status === 'needs_review').length,
      approvedCount: approvedJobs.length,
    }
  }, [jobs])

  // Copy email address
  const copyEmail = () => {
    navigator.clipboard.writeText('invoices+demo@supersolt.com')
    setEmailCopied(true)
    setTimeout(() => setEmailCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Invoices</h2>
          <p className="text-sm text-muted-foreground">
            Upload, enter, and manage supplier invoices
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Card className="p-3 flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Email invoices to:</p>
              <p className="text-sm font-mono">invoices+demo@supersolt.com</p>
            </div>
            <Button variant="ghost" size="sm" onClick={copyEmail}>
              {emailCopied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </Card>

          <Button onClick={() => useInvoiceIntakeStore.setState({ uploadDrawerOpen: true })}>
            <Upload className="h-4 w-4 mr-2" />
            Add Invoice
          </Button>
        </div>
      </div>

      {/* Spend Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">This Month</p>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(spendMetrics.thisMonth)}</p>
          {spendMetrics.monthChange !== 0 && (
            <p className={`text-xs ${spendMetrics.monthChange > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {spendMetrics.monthChange > 0 ? '+' : ''}{spendMetrics.monthChange.toFixed(1)}% vs last month
            </p>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Last Month</p>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(spendMetrics.lastMonth)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Pending Review</p>
          </div>
          <p className="text-2xl font-bold">{spendMetrics.pendingCount}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Total Approved</p>
          </div>
          <p className="text-2xl font-bold">{spendMetrics.approvedCount}</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(spendMetrics.totalApproved)} all-time</p>
        </Card>
      </div>

      {/* Top Suppliers */}
      {spendMetrics.topSuppliers.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Top Suppliers by Spend</h3>
          <div className="space-y-2">
            {spendMetrics.topSuppliers.map(([name, spend]) => {
              const pct = spendMetrics.totalApproved > 0 ? (spend / spendMetrics.totalApproved) * 100 : 0
              return (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-sm w-40 truncate">{name}</span>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div
                      className="bg-teal-500 h-2 rounded-full"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-24 text-right">{formatCurrency(spend)}</span>
                  <span className="text-xs text-muted-foreground w-12 text-right">{pct.toFixed(0)}%</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice # or supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="parsing">Parsing</SelectItem>
            <SelectItem value="needs_review">Needs Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Jobs Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Lines</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Confidence</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="h-12 w-12 text-muted-foreground opacity-50" />
                    <div>
                      <p className="font-medium">No invoices yet</p>
                      <p className="text-sm text-muted-foreground">
                        Upload or manually enter your first invoice
                      </p>
                    </div>
                    <Button onClick={() => useInvoiceIntakeStore.setState({ uploadDrawerOpen: true })}>
                      <Upload className="h-4 w-4 mr-2" />
                      Add Invoice
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredJobs.map((job) => (
                <TableRow key={job.id} className="cursor-pointer" onClick={() => openReviewModal(job)}>
                  <TableCell>
                    {format(new Date(job.header_json.invoice_date || job.created_at), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{job.header_json.supplier_name}</p>
                      {job.header_json.abn && (
                        <p className="text-xs text-muted-foreground">ABN: {job.header_json.abn}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{job.header_json.invoice_number || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {job.source === 'MANUAL' ? 'Manual' : job.source === 'UPLOAD' ? 'Upload' : job.source}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[job.status] || ''}>
                      {STATUS_LABELS[job.status] || job.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{job.lines_json.length}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(job.header_json.total * 100)}
                    <Badge variant="outline" className="ml-2 text-[10px]">{job.header_json.gst_mode}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {job.source === 'MANUAL' ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <Badge variant={job.supplier_confidence > 0.8 ? 'default' : 'secondary'}>
                        {Math.round(job.supplier_confidence * 100)}%
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Modals */}
      <InvoiceUploadDrawer />
      <InvoiceReviewModal />
    </div>
  )
}
