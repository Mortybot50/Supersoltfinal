import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  Building2,
  Calendar,
  Package,
  Send,
  CheckCircle,
  XCircle,
  Download,
  Printer,
  Trash2,
  Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useDataStore } from '@/lib/store/dataStore'
import { PurchaseOrder, PurchaseOrderItem } from '@/types'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function PurchaseOrderDetail() {
  const { poId } = useParams()
  const navigate = useNavigate()
  const { 
    purchaseOrders, 
    suppliers, 
    updatePurchaseOrder, 
    deletePurchaseOrder,
    loadPurchaseOrdersFromDB,
    loadSuppliersFromDB 
  } = useDataStore()
  
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false)
  const [emailMessage, setEmailMessage] = useState('')
  const [cancellationReason, setCancellationReason] = useState('')
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({})
  
  useEffect(() => {
    loadPurchaseOrdersFromDB()
    loadSuppliersFromDB()
  }, [])
  
  const po = purchaseOrders.find((p: PurchaseOrder) => p.id === poId)
  const supplier = po ? suppliers.find((s) => s.id === po.supplier_id) : null
  
  if (!po) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Purchase order not found</p>
          <Button onClick={() => navigate('/inventory/purchase-orders')} className="mt-4">
            Back to Purchase Orders
          </Button>
        </Card>
      </div>
    )
  }
  
  const canEdit = po.status === 'draft'
  const canSubmit = po.status === 'draft'
  const canCancel = po.status === 'draft' || po.status === 'submitted'
  const canReceive = po.status === 'submitted' || po.status === 'confirmed'
  
  const handleSubmit = () => {
    if (!supplier?.email) {
      toast.error('Supplier has no email address')
      return
    }
    
    const defaultMessage = `Hi ${supplier.contact_person || 'there'},

Please find our purchase order ${po.po_number} attached.

Expected delivery: ${format(new Date(po.expected_delivery_date), 'EEEE, dd MMMM yyyy')}

Total: $${(po.total / 100).toFixed(2)} (inc GST)

Please confirm receipt of this order.

Thank you,
Team`
    
    setEmailMessage(defaultMessage)
    setSubmitDialogOpen(true)
  }
  
  const confirmSubmit = async () => {
    try {
      await updatePurchaseOrder(po.id, {
        status: 'submitted',
        submitted_at: new Date(),
        submitted_by: 'current-user',
      })
      
      toast.success(`Purchase order sent to ${supplier?.email}`)
      setSubmitDialogOpen(false)
      
      console.log('Email sent:', {
        to: supplier?.email,
        subject: `Purchase Order ${po.po_number}`,
        body: emailMessage,
      })
    } catch (error) {
      toast.error('Failed to submit order')
    }
  }
  
  const handleCancel = () => {
    setCancelDialogOpen(true)
  }
  
  const confirmCancel = async () => {
    if (!cancellationReason.trim()) {
      toast.error('Cancellation reason is required')
      return
    }
    
    try {
      await updatePurchaseOrder(po.id, {
        status: 'cancelled',
        cancelled_at: new Date(),
        cancellation_reason: cancellationReason,
      })
      
      toast.success('Purchase order cancelled')
      setCancelDialogOpen(false)
    } catch (error) {
      toast.error('Failed to cancel order')
    }
  }
  
  const handleReceive = () => {
    const quantities: Record<string, number> = {}
    po.items?.forEach((item: PurchaseOrderItem) => {
      quantities[item.id] = (item.quantity_ordered) - (item.quantity_received || 0)
    })
    setReceivedQuantities(quantities)
    setReceiveDialogOpen(true)
  }

  const confirmReceive = async () => {
    try {
      const updatedItems = po.items?.map((item: PurchaseOrderItem) => ({
        ...item,
        quantity_received: (item.quantity_received || 0) + (receivedQuantities[item.id] || 0),
      }))

      const allReceived = updatedItems?.every(
        (item: PurchaseOrderItem) => (item.quantity_received || 0) >= (item.quantity_ordered)
      )
      
      await updatePurchaseOrder(po.id, {
        items: updatedItems,
        status: allReceived ? 'delivered' : 'confirmed',
        ...(allReceived && { delivered_at: new Date() }),
      })
      
      toast.success('Delivery recorded')
      setReceiveDialogOpen(false)
    } catch (error) {
      toast.error('Failed to record delivery')
    }
  }
  
  const handleDelete = async () => {
    if (confirm(`Delete ${po.po_number}? This cannot be undone.`)) {
      try {
        await deletePurchaseOrder(po.id)
        toast.success('Purchase order deleted')
        navigate('/inventory/purchase-orders')
      } catch (error) {
        toast.error('Failed to delete order')
      }
    }
  }
  
  const handlePrint = () => {
    window.print()
  }
  
  const handleDownload = () => {
    toast.info('PDF download coming soon')
  }
  
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/inventory/purchase-orders')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-muted-foreground" />
              <h1 className="text-3xl font-bold">{po.po_number}</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Created {format(new Date(po.created_at || po.order_date), 'dd MMM yyyy')} 
              {po.created_by_name && ` by ${po.created_by_name}`}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {canSubmit && (
            <Button onClick={handleSubmit} size="lg">
              <Send className="h-4 w-4 mr-2" />
              Submit Order
            </Button>
          )}
          {canReceive && (
            <Button onClick={handleReceive} variant="outline">
              <Package className="h-4 w-4 mr-2" />
              Receive Items
            </Button>
          )}
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          {canEdit && (
            <Button variant="ghost" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            {po.status === 'draft' && <Badge variant="secondary">Draft</Badge>}
            {po.status === 'submitted' && <Badge>Submitted</Badge>}
            {po.status === 'confirmed' && <Badge>Confirmed</Badge>}
            {po.status === 'delivered' && <Badge>Delivered</Badge>}
            {po.status === 'cancelled' && <Badge variant="destructive">Cancelled</Badge>}
          </div>
          {po.submitted_at && (
            <p className="text-sm text-muted-foreground">
              Submitted: {format(new Date(po.submitted_at), 'dd MMM yyyy HH:mm')}
            </p>
          )}
          {po.delivered_at && (
            <p className="text-sm text-muted-foreground">
              Delivered: {format(new Date(po.delivered_at), 'dd MMM yyyy')}
            </p>
          )}
          {canCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-destructive"
              onClick={handleCancel}
            >
              <XCircle className="h-3 w-3 mr-1" />
              Cancel Order
            </Button>
          )}
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Supplier</p>
          </div>
          <p className="font-semibold">{po.supplier_name}</p>
          {supplier && (
            <>
              {supplier.contact_person && (
                <p className="text-sm text-muted-foreground mt-1">
                  {supplier.contact_person}
                </p>
              )}
              {supplier.email && (
                <p className="text-sm text-muted-foreground">{supplier.email}</p>
              )}
              {supplier.phone && (
                <p className="text-sm text-muted-foreground">{supplier.phone}</p>
              )}
            </>
          )}
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Delivery</p>
          </div>
          <p className="font-semibold">
            {format(new Date(po.expected_delivery_date), 'EEEE, dd MMM yyyy')}
          </p>
          {supplier && (
            <p className="text-sm text-muted-foreground mt-1">
              {supplier.delivery_lead_days} day lead time
            </p>
          )}
        </Card>
      </div>
      
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Order Items</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Qty Ordered</TableHead>
              <TableHead className="text-right">Qty Received</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">Line Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {po.items?.map((item: PurchaseOrderItem) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.ingredient_name}</TableCell>
                <TableCell>{item.unit}</TableCell>
                <TableCell className="text-right">{item.quantity_ordered || item.quantity}</TableCell>
                <TableCell className="text-right">
                  <span
                    className={
                      (item.quantity_received || 0) >= (item.quantity_ordered || item.quantity)
                        ? 'text-green-600 font-semibold'
                        : (item.quantity_received || 0) > 0
                        ? 'text-orange-600 font-semibold'
                        : ''
                    }
                  >
                    {item.quantity_received || 0}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  ${(item.unit_cost / 100).toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  ${(item.line_total / 100).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        <Separator className="my-4" />
        
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">${((po.subtotal || 0) / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST (10%):</span>
              <span className="font-medium">${((po.tax_amount || 0) / 100).toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span>${(po.total / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </Card>
      
      {po.notes && (
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-2">Notes</h3>
          <p className="text-sm text-muted-foreground">{po.notes}</p>
        </Card>
      )}
      
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submit Purchase Order</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Send to:</Label>
              <div className="flex items-center gap-2 mt-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">{supplier?.email}</p>
              </div>
            </div>
            
            <div>
              <Label htmlFor="email_message">Email Message</Label>
              <Textarea
                id="email_message"
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                rows={10}
                className="mt-2 font-mono text-sm"
              />
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <p className="text-sm">
                <strong>Note:</strong> This will send an email to {supplier?.email} with
                the purchase order attached as a PDF.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSubmit}>
              <Send className="h-4 w-4 mr-2" />
              Send Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Purchase Order</DialogTitle>
            <DialogDescription>
              Provide a reason for cancelling this purchase order
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please provide a reason for cancelling this order:
            </p>
            <Textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="e.g., Supplier unavailable, changed requirements, etc."
              rows={4}
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Back
            </Button>
            <Button variant="destructive" onClick={confirmCancel}>
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Receive Items</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the quantity received for each item:
            </p>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Ordered</TableHead>
                  <TableHead>Previously Received</TableHead>
                  <TableHead>Receiving Now</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.items?.map((item: PurchaseOrderItem) => {
                  const remaining = (item.quantity_ordered) - (item.quantity_received || 0)
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.ingredient_name}</TableCell>
                      <TableCell>{item.quantity_ordered || item.quantity}</TableCell>
                      <TableCell>{item.quantity_received || 0}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max={remaining}
                          value={receivedQuantities[item.id] || 0}
                          onChange={(e) =>
                            setReceivedQuantities({
                              ...receivedQuantities,
                              [item.id]: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-24"
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmReceive}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirm Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
