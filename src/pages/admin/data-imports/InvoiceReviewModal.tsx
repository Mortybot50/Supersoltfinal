import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Check, X, AlertTriangle, Plus, Package } from 'lucide-react'
import { useInvoiceIntakeStore } from '@/stores/useInvoiceIntakeStore'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/currency'

export function InvoiceReviewModal() {
  const {
    reviewModalOpen,
    selectedJob,
    closeReviewModal,
    approveInvoice,
    rejectInvoice,
    saveDraft,
    isProcessing
  } = useInvoiceIntakeStore()
  
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  
  if (!selectedJob) return null
  
  // Calculate totals and variance
  const lineTotal = selectedJob.lines_json.reduce((sum, line) => sum + line.ext_price, 0)
  const headerSubtotal = selectedJob.header_json.subtotal
  const variance = lineTotal - headerSubtotal
  const variancePercent = (variance / headerSubtotal) * 100
  
  // Count unmapped
  const unmappedCount = selectedJob.mapping_json.filter(
    (m) => m.match_type === 'new_item' || !m.ingredient_id
  ).length
  
  // Check if approvable
  const hasErrors = Math.abs(variancePercent) > 2
  const hasMissingMappings = selectedJob.mapping_json.some(
    (m) => m.match_type !== 'new_item' && !m.ingredient_id
  )
  const canApprove = !hasErrors && !hasMissingMappings
  
  return (
    <Dialog open={reviewModalOpen} onOpenChange={(open) => { if (!open) closeReviewModal() }}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Invoice</DialogTitle>
          <DialogDescription>
            Verify extracted data and map line items to ingredients
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Header Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Supplier</p>
                  <p className="font-medium">{selectedJob.header_json.supplier_name}</p>
                  {selectedJob.header_json.abn && (
                    <p className="text-xs text-muted-foreground mt-1">ABN: {selectedJob.header_json.abn}</p>
                  )}
                </div>
                <Badge variant={selectedJob.supplier_confidence > 0.8 ? 'default' : 'secondary'}>
                  {Math.round(selectedJob.supplier_confidence * 100)}%
                </Badge>
              </div>
            </Card>
            
            <Card className="p-4">
              <div>
                <p className="text-sm text-muted-foreground">Invoice Details</p>
                <p className="font-medium font-mono">{selectedJob.header_json.invoice_number}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(selectedJob.header_json.invoice_date), 'dd MMM yyyy')}
                </p>
              </div>
            </Card>
            
            <Card className="p-4">
              <div>
                <p className="text-sm text-muted-foreground">Totals</p>
                <div className="space-y-1 mt-1">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(selectedJob.header_json.subtotal * 100)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>GST:</span>
                    <span>{formatCurrency(selectedJob.header_json.gst * 100)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-1">
                    <span>Total:</span>
                    <span>{formatCurrency(selectedJob.header_json.total * 100)}</span>
                  </div>
                  <Badge variant="outline" className="w-full justify-center">
                    GST {selectedJob.header_json.gst_mode}
                  </Badge>
                </div>
              </div>
            </Card>
          </div>
          
          {/* Variance Alert */}
          {Math.abs(variancePercent) > 0.5 && (
            <Card className={`p-4 ${Math.abs(variancePercent) > 2 ? 'border-destructive' : 'border-yellow-500'}`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className={`h-5 w-5 ${Math.abs(variancePercent) > 2 ? 'text-destructive' : 'text-yellow-500'}`} />
                <div className="flex-1">
                  <p className="font-medium">Totals Variance Detected</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Line total differs by {variance > 0 ? '+' : ''}{formatCurrency(Math.abs(variance) * 100)}
                    {' '}({Math.abs(variancePercent).toFixed(2)}%)
                  </p>
                  {Math.abs(variancePercent) > 2 && (
                    <p className="text-sm text-destructive mt-1">
                      ⚠️ Exceeds 2% tolerance. Fix before approving.
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}
          
          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Line Items</h3>
              <Badge variant="secondary">
                {selectedJob.lines_json.length} items • {unmappedCount} unmapped
              </Badge>
            </div>
            
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Mapped To</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedJob.lines_json.map((line, index) => {
                    const mapping = selectedJob.mapping_json[index]
                    
                    return (
                      <TableRow key={index}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{line.raw_desc}</p>
                            {line.pack_size_text && (
                              <Badge variant="outline" className="text-xs mt-1">
                                <Package className="h-3 w-3 mr-1" />
                                {line.pack_size_text}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{line.qty}</TableCell>
                        <TableCell className="text-right">{formatCurrency(line.unit_price * 100)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(line.ext_price * 100)}
                        </TableCell>
                        <TableCell>
                          {mapping.match_type === 'new_item' ? (
                            <Badge variant="outline" className="bg-blue-50">
                              <Plus className="h-3 w-3 mr-1" />
                              Create New
                            </Badge>
                          ) : mapping.ingredient_id ? (
                            <span className="text-sm">{mapping.ingredient_id}</span>
                          ) : (
                            <Badge variant="secondary">Unmapped</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {mapping.unit_cost_computed ? (
                            <div className="text-sm">
                              <p className="font-medium">
                                {formatCurrency(mapping.unit_cost_computed)}/{mapping.unit}
                              </p>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            mapping.match_type === 'exact' ? 'default' :
                            mapping.match_type === 'fuzzy' ? 'secondary' :
                            'outline'
                          }>
                            {mapping.match_type}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>
          
          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" onClick={() => saveDraft(selectedJob.id)} disabled={isProcessing}>
              Save Draft
            </Button>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowRejectDialog(true)} disabled={isProcessing}>
                <X className="h-4 w-4 mr-2" />
                Reject
              </Button>
              
              <Button onClick={() => approveInvoice(selectedJob.id)} disabled={!canApprove || isProcessing}>
                <Check className="h-4 w-4 mr-2" />
                {isProcessing ? 'Processing...' : 'Approve & Update Costs'}
              </Button>
            </div>
          </div>
          
          {/* Error Messages */}
          {!canApprove && (
            <Card className="p-4 border-destructive">
              <div className="space-y-2">
                <p className="font-medium text-destructive">Cannot Approve:</p>
                <ul className="text-sm space-y-1">
                  {hasErrors && (
                    <li className="flex items-start gap-2">
                      <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <span>Totals variance exceeds 2%</span>
                    </li>
                  )}
                  {hasMissingMappings && (
                    <li className="flex items-start gap-2">
                      <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <span>Some lines unmapped</span>
                    </li>
                  )}
                </ul>
              </div>
            </Card>
          )}
        </div>
        
        {/* Reject Dialog */}
        {showRejectDialog && (
          <div className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center">
            <Card className="w-full max-w-md p-6 space-y-4">
              <div>
                <h3 className="text-lg font-medium">Reject Invoice</h3>
                <p className="text-sm text-muted-foreground mt-1">Provide reason</p>
              </div>
              
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="E.g., Incorrect supplier, prices don't match..."
                rows={4}
              />
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setShowRejectDialog(false); setRejectReason('') }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    rejectInvoice(selectedJob.id, rejectReason)
                    setShowRejectDialog(false)
                    setRejectReason('')
                  }}
                  disabled={!rejectReason.trim()}
                  className="flex-1"
                >
                  Reject
                </Button>
              </div>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
