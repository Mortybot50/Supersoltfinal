import { useState } from 'react'
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
import { Upload, Mail, MoreVertical, Search, Filter, Copy, Check } from 'lucide-react'
import { useInvoiceIntakeStore } from '@/stores/useInvoiceIntakeStore'
import { InvoiceUploadDrawer } from './InvoiceUploadDrawer'
import { InvoiceReviewModal } from './InvoiceReviewModal'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/currency'

export function InvoicesTab() {
  const { jobs, uploadDrawerOpen, openReviewModal } = useInvoiceIntakeStore()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [emailCopied, setEmailCopied] = useState(false)
  
  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    const matchesSearch =
      job.header_json.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.header_json.supplier_name.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesStatus && matchesSearch
  })
  
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
          <h2 className="text-2xl font-bold">Invoice OCR</h2>
          <p className="text-sm text-muted-foreground">
            Upload supplier invoices to auto-update ingredient costs
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Email Ingestion Address */}
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
            Upload Invoice
          </Button>
        </div>
      </div>
      
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
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="h-12 w-12 text-muted-foreground opacity-50" />
                    <div>
                      <p className="font-medium">No invoices yet</p>
                      <p className="text-sm text-muted-foreground">
                        Upload your first invoice to start mapping
                      </p>
                    </div>
                    <Button onClick={() => useInvoiceIntakeStore.setState({ uploadDrawerOpen: true })}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Invoice
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredJobs.map((job) => {
                // Calculate variance
                let variance = null
                if (job.lines_json.length > 0) {
                  const lineTotal = job.lines_json.reduce((sum, line) => sum + line.ext_price, 0)
                  const headerSubtotal = job.header_json.subtotal
                  variance = ((lineTotal - headerSubtotal) / headerSubtotal) * 100
                }
                
                return (
                  <TableRow key={job.id} className="cursor-pointer" onClick={() => openReviewModal(job)}>
                    <TableCell>{format(new Date(job.created_at), 'dd MMM yyyy')}</TableCell>
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
                      <Badge variant={
                        job.status === 'approved' ? 'default' :
                        job.status === 'needs_review' ? 'secondary' :
                        job.status === 'rejected' || job.status === 'failed' ? 'destructive' :
                        'outline'
                      }>
                        {job.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{job.lines_json.length}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(job.header_json.total * 100)}
                      <Badge variant="outline" className="ml-2">{job.header_json.gst_mode}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={job.supplier_confidence > 0.8 ? 'default' : 'secondary'}>
                        {Math.round(job.supplier_confidence * 100)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
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
