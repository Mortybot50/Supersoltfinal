import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
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
  AlertTriangle,
  Clock,
  User,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { useDataStore } from '@/lib/store/dataStore'
import { useAuth } from '@/contexts/AuthContext'
import { PurchaseOrder, PurchaseOrderItem } from '@/types'
import { logPriceChange, runCostCascade, applyCascadeToState } from '@/lib/services/costCascade'
import { PageShell, PageToolbar } from '@/components/shared'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { calculateCostPerBaseUnit, calculatePackToBaseFactor } from '@/lib/utils/unitConversions'
import { getDefaultOrgSettings } from '@/lib/venueSettings'
import { formatCurrency } from '@/lib/utils/formatters'
import { toast } from 'sonner'
import { format, isBefore, differenceInDays, isValid } from 'date-fns'

// ─── Helpers ───────────────────────────────────────────────────────────────

function safeFormat(date: unknown, fmt: string, fallback = '—'): string {
  try {
    const d = date instanceof Date ? date : new Date(date as string | number)
    return isValid(d) ? format(d, fmt) : fallback
  } catch {
    return fallback
  }
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

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive'; color: string }
> = {
  draft: { label: 'Draft', variant: 'secondary', color: 'text-muted-foreground' },
  submitted: { label: 'Submitted', variant: 'default', color: 'text-blue-600' },
  confirmed: { label: 'Confirmed', variant: 'default', color: 'text-purple-600' },
  delivered: { label: 'Delivered', variant: 'default', color: 'text-green-600' },
  cancelled: { label: 'Cancelled', variant: 'destructive', color: 'text-destructive' },
}

interface ReceiveLineState {
  quantity: number
  actualUnitCost: number
  updateCost: boolean
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function PurchaseOrderDetail() {
  const { poId } = useParams()
  const navigate = useNavigate()
  const {
    purchaseOrders,
    suppliers,
    ingredients,
    recipes,
    recipeIngredients,
    menuItems,
    updatePurchaseOrder,
    updateIngredient,
    deletePurchaseOrder,
    loadPurchaseOrdersFromDB,
    loadSuppliersFromDB,
    setIngredients: setStoreIngredients,
    setRecipes,
    setRecipeIngredients: setStoreRecipeIngredients,
    setMenuItems,
  } = useDataStore()
  const { user } = useAuth()

  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false)
  const [emailMessage, setEmailMessage] = useState('')
  const [cancellationReason, setCancellationReason] = useState('')
  const [receiveLines, setReceiveLines] = useState<Record<string, ReceiveLineState>>({})

  useEffect(() => {
    loadPurchaseOrdersFromDB()
    loadSuppliersFromDB()
  }, [loadPurchaseOrdersFromDB, loadSuppliersFromDB])

  const po = purchaseOrders.find((p: PurchaseOrder) => p.id === poId)
  const supplier = po ? suppliers.find((s) => s.id === po.supplier_id) : null
  const overdue = po ? isOverdue(po) : false
  const daysOverdue =
    overdue && po ? differenceInDays(new Date(), new Date(po.expected_delivery_date)) : 0

  const isDelivered = po?.status === 'delivered'

  // Variance summary for receive dialog
  const receiveVarianceSummary = useMemo(() => {
    if (!po?.items) return { totalVariance: 0, itemsWithVariance: 0 }
    let totalVariance = 0
    let itemsWithVariance = 0
    for (const item of po.items) {
      const line = receiveLines[item.id]
      if (!line) continue
      const diff = line.actualUnitCost - item.unit_cost
      if (diff !== 0 && line.quantity > 0) {
        totalVariance += diff * line.quantity
        itemsWithVariance++
      }
    }
    return { totalVariance, itemsWithVariance }
  }, [po?.items, receiveLines])

  // ─── Audit trail ────────────────────────────────────────────────────────

  const auditTrail = useMemo(() => {
    if (!po) return []
    const events: Array<{ label: string; timestamp: unknown; by?: string }> = []

    if (po.created_at) {
      events.push({ label: 'Created', timestamp: po.created_at, by: po.created_by_name || po.created_by })
    }
    if (po.submitted_at) {
      events.push({ label: 'Submitted', timestamp: po.submitted_at, by: po.submitted_by })
    }
    if (po.confirmed_at) {
      events.push({ label: 'Confirmed', timestamp: po.confirmed_at })
    }
    if (po.delivered_at) {
      events.push({ label: 'Received', timestamp: po.delivered_at })
    }
    if (po.cancelled_at) {
      events.push({ label: 'Cancelled', timestamp: po.cancelled_at })
    }

    return events
  }, [po])

  // ─── Not found ──────────────────────────────────────────────────────────

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

  // ─── Action Handlers ────────────────────────────────────────────────────

  const handleSubmit = () => {
    if (!supplier?.email) {
      toast.error('Supplier has no email address')
      return
    }

    const defaultMessage = `Hi ${supplier.contact_person || 'there'},

Please find our purchase order ${po.po_number} attached.

Expected delivery: ${safeFormat(po.expected_delivery_date, 'EEEE, dd MMMM yyyy')}

Total: ${formatCurrency(po.total)} (inc GST)

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
        submitted_by: user?.id,
      })
      toast.success(`Purchase order sent to ${supplier?.email}`)
      setSubmitDialogOpen(false)
    } catch {
      toast.error('Failed to submit order')
    }
  }

  const handleCancel = () => setCancelDialogOpen(true)

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
    } catch {
      toast.error('Failed to cancel order')
    }
  }

  const handleReceive = () => {
    const lines: Record<string, ReceiveLineState> = {}
    po.items?.forEach((item: PurchaseOrderItem) => {
      lines[item.id] = {
        quantity: item.quantity_ordered - (item.quantity_received || 0),
        actualUnitCost: item.unit_cost,
        updateCost: false,
      }
    })
    setReceiveLines(lines)
    setReceiveDialogOpen(true)
  }

  const confirmReceive = async () => {
    try {
      const updatedItems = po.items?.map((item: PurchaseOrderItem) => ({
        ...item,
        quantity_received: (item.quantity_received || 0) + (receiveLines[item.id]?.quantity || 0),
      }))

      const allReceived = updatedItems?.every(
        (item: PurchaseOrderItem) =>
          (item.quantity_received || 0) >= item.quantity_ordered
      )

      await updatePurchaseOrder(po.id, {
        items: updatedItems,
        status: allReceived ? 'delivered' : 'confirmed',
        ...(allReceived && { delivered_at: new Date() }),
      })

      // Update ingredient stock and optionally cost, then cascade
      const gpThreshold = getDefaultOrgSettings().below_gp_threshold_alert_percent ?? 60
      const costChangedIngredients: Array<{
        id: string
        oldCost: number
        newCost: number
      }> = []

      for (const item of po.items || []) {
        const line = receiveLines[item.id]
        if (!line || line.quantity <= 0) continue

        const ingredient = ingredients.find((i) => i.id === item.ingredient_id)
        if (!ingredient) continue

        const updates: Record<string, unknown> = {
          current_stock: ingredient.current_stock + line.quantity,
        }

        if (line.updateCost && line.actualUnitCost !== item.unit_cost) {
          updates.cost_per_unit = line.actualUnitCost
          updates.last_cost_update = new Date()
          costChangedIngredients.push({
            id: ingredient.id,
            oldCost: ingredient.cost_per_unit,
            newCost: line.actualUnitCost,
          })
        }

        await updateIngredient(ingredient.id, updates)
      }

      // Cost cascade
      let totalAffectedRecipes = 0
      let totalGpAlerts = 0
      let currentIngredients = ingredients
      let currentRecipes = recipes
      let currentRecipeIngredients = recipeIngredients
      let currentMenuItems = menuItems

      for (const change of costChangedIngredients) {
        await logPriceChange(change.id, change.oldCost, change.newCost, 'invoice')
        const ing = currentIngredients.find((i) => i.id === change.id)
        const packToBase = calculatePackToBaseFactor(
          ing?.units_per_pack ?? 1,
          ing?.unit_size ?? 1,
          ing?.unit ?? 'ea'
        )
        const unitCostExBase = calculateCostPerBaseUnit(change.newCost, packToBase)

        const cascade = runCostCascade(
          change.id,
          change.newCost,
          unitCostExBase,
          currentIngredients,
          currentRecipes,
          currentRecipeIngredients,
          currentMenuItems,
          gpThreshold
        )
        if (cascade.affectedRecipes.length > 0) {
          const applied = applyCascadeToState(
            cascade,
            currentIngredients,
            currentRecipes,
            currentRecipeIngredients,
            currentMenuItems,
            change.newCost,
            unitCostExBase
          )
          currentIngredients = applied.ingredients
          currentRecipes = applied.recipes
          currentRecipeIngredients = applied.recipeIngredients
          currentMenuItems = applied.menuItems
          totalAffectedRecipes += cascade.affectedRecipes.length
          totalGpAlerts += cascade.gpAlerts.length
        }
      }

      if (costChangedIngredients.length > 0) {
        setStoreIngredients(currentIngredients)
        setRecipes(currentRecipes)
        setStoreRecipeIngredients(currentRecipeIngredients)
        setMenuItems(currentMenuItems)
      }

      if (costChangedIngredients.length > 0) {
        const alertMsg = totalGpAlerts > 0 ? ` ${totalGpAlerts} GP alert(s)!` : ''
        toast.success(
          `Delivery recorded. ${costChangedIngredients.length} price update(s), ${totalAffectedRecipes} recipe(s) recalculated.${alertMsg}`
        )
      } else {
        toast.success('Delivery recorded. Stock updated.')
      }

      setReceiveDialogOpen(false)
    } catch {
      toast.error('Failed to record delivery')
    }
  }

  const handleDelete = async () => {
    if (confirm(`Delete ${po.po_number}? This cannot be undone.`)) {
      try {
        await deletePurchaseOrder(po.id)
        toast.success('Purchase order deleted')
        navigate('/inventory/purchase-orders')
      } catch {
        toast.error('Failed to delete order')
      }
    }
  }

  const handlePrint = () => window.print()
  const handleDownload = () => toast.info('PDF download coming soon')

  // ─── Toolbar ────────────────────────────────────────────────────────────

  const toolbar = (
    <PageToolbar
      title={po.po_number}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => navigate('/inventory/purchase-orders')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Separator orientation="vertical" className="h-5" />
          {overdue && (
            <Badge variant="destructive">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {daysOverdue}d Overdue
            </Badge>
          )}
          {canReceive && (
            <Button onClick={() => navigate(`/inventory/purchase-orders/${po.id}/receive`)} variant="outline" size="sm">
              <Package className="h-4 w-4 mr-2" />
              Receive
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </>
      }
      primaryAction={
        canSubmit
          ? { label: 'Submit Order', icon: Send, onClick: handleSubmit, variant: 'primary' as const }
          : undefined
      }
    />
  )

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <PageShell toolbar={toolbar}>
      <div className="p-4 md:p-6 space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/inventory/purchase-orders">Purchase Orders</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{po.po_number}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* ─── Header Cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Status */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge variant={STATUS_CONFIG[po.status]?.variant || 'secondary'}>
                {STATUS_CONFIG[po.status]?.label || po.status}
              </Badge>
            </div>
            {po.cancellation_reason && (
              <p className="text-sm text-destructive mt-1">
                Reason: {po.cancellation_reason}
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

          {/* Supplier */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Supplier</p>
            </div>
            <p className="font-semibold">{po.supplier_name}</p>
            {supplier && (
              <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                {supplier.contact_person && <p>{supplier.contact_person}</p>}
                {supplier.email && <p>{supplier.email}</p>}
                {supplier.phone && <p>{supplier.phone}</p>}
              </div>
            )}
          </Card>

          {/* Delivery */}
          <Card className={`p-6 ${overdue ? 'border-red-300 dark:border-red-700' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Delivery</p>
            </div>
            <p className={`font-semibold ${overdue ? 'text-red-600' : ''}`}>
              {safeFormat(po.expected_delivery_date, 'EEEE, dd MMM yyyy')}
            </p>
            {overdue && (
              <p className="text-sm text-red-600 mt-1 font-medium">
                {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
              </p>
            )}
            {supplier && !overdue && (
              <p className="text-sm text-muted-foreground mt-1">
                {supplier.delivery_lead_days} day lead time
              </p>
            )}
          </Card>
        </div>

        {/* ─── Line Items ────────────────────────────────────────────── */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Order Items</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Qty Ordered</TableHead>
                <TableHead className="text-right">Qty Received</TableHead>
                {isDelivered && (
                  <>
                    <TableHead className="text-right">Qty Variance</TableHead>
                    <TableHead className="text-right">Price Variance</TableHead>
                  </>
                )}
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.items?.map((item: PurchaseOrderItem) => {
                const receiveProgress =
                  item.quantity_ordered > 0
                    ? ((item.quantity_received || 0) / item.quantity_ordered) * 100
                    : 0
                const qtyVariance = (item.quantity_received || 0) - item.quantity_ordered

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.ingredient_name}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">{item.quantity_ordered}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span
                          className={
                            (item.quantity_received || 0) >= item.quantity_ordered
                              ? 'text-green-600 font-semibold'
                              : (item.quantity_received || 0) > 0
                              ? 'text-orange-600 font-semibold'
                              : ''
                          }
                        >
                          {item.quantity_received || 0}
                        </span>
                        {isDelivered && receiveProgress >= 100 && (
                          <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                        )}
                      </div>
                    </TableCell>
                    {isDelivered && (
                      <>
                        <TableCell className="text-right">
                          {qtyVariance !== 0 ? (
                            <span
                              className={
                                qtyVariance < 0
                                  ? 'text-red-600 font-semibold'
                                  : 'text-green-600 font-semibold'
                              }
                            >
                              {qtyVariance > 0 ? '+' : ''}
                              {qtyVariance}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {/* Price variance would need actual received cost stored — placeholder */}
                          <span className="text-muted-foreground">—</span>
                        </TableCell>
                      </>
                    )}
                    <TableCell className="text-right">
                      {formatCurrency(item.unit_cost)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(item.line_total)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          <Separator className="my-4" />

          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">{formatCurrency(po.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">GST (10%):</span>
                <span className="font-medium">{formatCurrency(po.tax_amount || 0)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>{formatCurrency(po.total)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* ─── Notes ─────────────────────────────────────────────────── */}
        {po.notes && (
          <Card className="p-6">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Notes
            </h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{po.notes}</p>
          </Card>
        )}

        {/* ─── Audit Trail ───────────────────────────────────────────── */}
        {auditTrail.length > 0 && (
          <Card className="p-6">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Audit Trail
            </h3>
            <div className="space-y-3">
              {auditTrail.map((event, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />
                  <div className="flex-1">
                    <span className="font-medium">{event.label}</span>
                    {event.by && (
                      <span className="text-muted-foreground ml-2">
                        <User className="h-3 w-3 inline mr-0.5" />
                        {event.by}
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {safeFormat(event.timestamp, 'dd MMM yyyy HH:mm')}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ─── Submit Dialog ─────────────────────────────────────────── */}
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

        {/* ─── Cancel Dialog ─────────────────────────────────────────── */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Purchase Order</DialogTitle>
              <DialogDescription>
                Provide a reason for cancelling this purchase order
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
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

        {/* ─── Receive Dialog ────────────────────────────────────────── */}
        <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Receive Items — {po.po_number}</DialogTitle>
              <DialogDescription>
                Enter quantity received and actual unit cost for each item. Stock will be
                updated automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Prev. Received</TableHead>
                    <TableHead className="text-right w-24">Receiving</TableHead>
                    <TableHead className="text-right">PO Cost</TableHead>
                    <TableHead className="text-right w-28">Actual Cost</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-center w-20">Update Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {po.items?.map((item: PurchaseOrderItem) => {
                    const remaining = item.quantity_ordered - (item.quantity_received || 0)
                    const line = receiveLines[item.id]
                    if (!line) return null

                    const costDiff = line.actualUnitCost - item.unit_cost
                    const variancePercent =
                      item.unit_cost > 0
                        ? ((costDiff / item.unit_cost) * 100).toFixed(1)
                        : '0'

                    return (
                      <TableRow
                        key={item.id}
                        className={
                          costDiff !== 0 ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''
                        }
                      >
                        <TableCell className="font-medium">{item.ingredient_name}</TableCell>
                        <TableCell className="text-right">{item.quantity_ordered}</TableCell>
                        <TableCell className="text-right">
                          {item.quantity_received || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            max={remaining}
                            value={line.quantity}
                            onChange={(e) =>
                              setReceiveLines({
                                ...receiveLines,
                                [item.id]: {
                                  ...line,
                                  quantity: parseInt(e.target.value) || 0,
                                },
                              })
                            }
                            className="w-20 text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(item.unit_cost)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={line.actualUnitCost}
                            onChange={(e) =>
                              setReceiveLines({
                                ...receiveLines,
                                [item.id]: {
                                  ...line,
                                  actualUnitCost: parseInt(e.target.value) || 0,
                                },
                              })
                            }
                            className={`w-24 text-right ${costDiff !== 0 ? 'border-amber-400' : ''}`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {costDiff !== 0 ? (
                            <span
                              className={
                                costDiff > 0
                                  ? 'text-red-600 font-semibold'
                                  : 'text-green-600 font-semibold'
                              }
                            >
                              {costDiff > 0 ? '+' : ''}
                              {formatCurrency(costDiff)}
                              <span className="text-xs ml-1">({variancePercent}%)</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {costDiff !== 0 && (
                            <Checkbox
                              checked={line.updateCost}
                              onCheckedChange={(checked) =>
                                setReceiveLines({
                                  ...receiveLines,
                                  [item.id]: { ...line, updateCost: checked === true },
                                })
                              }
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Variance summary */}
              {receiveVarianceSummary.itemsWithVariance > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {receiveVarianceSummary.itemsWithVariance} item
                      {receiveVarianceSummary.itemsWithVariance !== 1 ? 's' : ''} with price
                      variance. Net impact:{' '}
                      {receiveVarianceSummary.totalVariance > 0 ? '+' : ''}
                      {formatCurrency(receiveVarianceSummary.totalVariance)}
                    </span>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Check &quot;Update Cost&quot; to update the ingredient&apos;s unit cost in the
                    system.
                  </p>
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Received quantities will be added to ingredient stock levels automatically.
                </p>
              </div>
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
    </PageShell>
  )
}
