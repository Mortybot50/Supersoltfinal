import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ShoppingCart,
  CheckCircle,
  AlertCircle,
  Loader2,
  Package,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDataStore } from '@/lib/store/dataStore'
import { useAuth } from '@/contexts/AuthContext'
import { PurchaseOrder, PurchaseOrderItem } from '@/types'
import { toast } from 'sonner'
import { PageShell, PageToolbar } from '@/components/shared'
import { formatCurrency } from '@/lib/utils/formatters'
import { format, isValid } from 'date-fns'

function safeFormat(date: unknown, fmt: string, fallback = '—'): string {
  try {
    const d = date instanceof Date ? date : new Date(date as string)
    return isValid(d) ? format(d, fmt) : fallback
  } catch {
    return fallback
  }
}

interface PurchaseLine {
  invoiceLineItemId: string
  ingredientId: string | null
  ingredientName: string
  rawDescription: string
  quantity: string
  unit: string
  unitPrice: string
  included: boolean
  updateCost: boolean
  updateStock: boolean
  matchStatus: string
  confidenceScore: number
}

const MATCH_CONFIG = {
  auto_matched: { label: 'Auto', variant: 'default' as const },
  manual_matched: { label: 'Manual', variant: 'secondary' as const },
  new_ingredient: { label: 'New', variant: 'outline' as const },
  unmatched: { label: 'Unmatched', variant: 'destructive' as const },
}

export default function PurchaseFromInvoice() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const navigate = useNavigate()
  const { currentVenue, currentOrg, user } = useAuth()
  const {
    invoices,
    ingredients,
    suppliers,
    purchaseOrders,
    loadInvoicesFromDB,
    loadIngredientsFromDB,
    loadSuppliersFromDB,
    addPurchaseOrder,
    updateInvoice,
    updateIngredient,
  } = useDataStore()

  const [lines, setLines] = useState<PurchaseLine[]>([])
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (currentVenue?.id && currentVenue.id !== 'all') {
      loadInvoicesFromDB(currentVenue.id)
      loadIngredientsFromDB()
      loadSuppliersFromDB()
    }
  }, [currentVenue?.id, loadInvoicesFromDB, loadIngredientsFromDB, loadSuppliersFromDB])

  const invoice = useMemo(
    () => invoices.find(inv => inv.id === invoiceId),
    [invoices, invoiceId]
  )

  // Initialize lines from invoice line items
  useEffect(() => {
    if (!invoice || initialized) return
    const lineItems = invoice.line_items ?? []
    setLines(
      lineItems.map(li => ({
        invoiceLineItemId: li.id,
        ingredientId: li.ingredient_id ?? null,
        ingredientName: li.ingredient_name ?? li.raw_description,
        rawDescription: li.raw_description,
        quantity: String(li.confirmed_quantity ?? li.extracted_quantity ?? ''),
        unit: li.extracted_unit ?? '',
        unitPrice: String(li.confirmed_unit_price ?? li.extracted_unit_price ?? ''),
        included: li.match_status !== 'unmatched',
        updateCost: li.match_status === 'auto_matched' || li.match_status === 'manual_matched',
        updateStock: li.ingredient_id != null,
        matchStatus: li.match_status,
        confidenceScore: li.confidence_score ?? 0,
      }))
    )
    setInitialized(true)
  }, [invoice, initialized])

  const updateLine = (idx: number, patch: Partial<PurchaseLine>) => {
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  const handleIngredientChange = (idx: number, ingredientId: string) => {
    const ing = ingredients.find(i => i.id === ingredientId)
    updateLine(idx, {
      ingredientId: ing?.id ?? null,
      ingredientName: ing?.name ?? lines[idx].rawDescription,
      updateCost: !!ing,
      updateStock: !!ing,
    })
  }

  // Totals
  const matchedTotal = useMemo(() => {
    return lines
      .filter(l => l.included)
      .reduce((sum, l) => {
        const qty = parseFloat(l.quantity) || 0
        const price = parseFloat(l.unitPrice) || 0
        return sum + qty * price
      }, 0)
  }, [lines])

  const invoiceTotal = invoice?.total_amount ?? 0
  const variance = matchedTotal - invoiceTotal
  const variancePct = invoiceTotal > 0 ? (variance / invoiceTotal) * 100 : 0

  // Already converted to a purchase?
  const existingPO = useMemo(() => {
    const prefix = `INV-${invoice?.invoice_number ?? ''}`
    return purchaseOrders.find(po => po.po_number === prefix)
  }, [purchaseOrders, invoice])

  const handleConfirm = async () => {
    if (!invoice) return
    if (!currentVenue?.id || currentVenue.id === 'all') {
      toast.error('Select a specific venue before confirming.')
      return
    }

    const includedLines = lines.filter(l => l.included)
    if (includedLines.length === 0) {
      toast.error('Include at least one line item.')
      return
    }

    setIsSaving(true)
    try {
      const now = new Date()
      const poId = crypto.randomUUID()

      // Use invoice number for PO number; fall back to a timestamp slug
      const poNumber = `INV-${invoice.invoice_number ?? now.getTime()}`

      const supplier = suppliers.find(s => s.id === invoice.supplier_id)

      const subtotal = includedLines.reduce((sum, l) => {
        const qty = parseFloat(l.quantity) || 0
        const price = parseFloat(l.unitPrice) || 0
        return sum + qty * price * 100 // cents
      }, 0)
      const taxAmount = Math.round(subtotal / 11) // GST 10% (inclusive)
      const total = subtotal

      const items: PurchaseOrderItem[] = includedLines
        .filter(l => l.ingredientId)
        .map(l => {
          const qty = parseFloat(l.quantity) || 0
          const unitCost = Math.round((parseFloat(l.unitPrice) || 0) * 100) // cents
          return {
            id: crypto.randomUUID(),
            purchase_order_id: poId,
            ingredient_id: l.ingredientId!,
            ingredient_name: l.ingredientName,
            quantity_ordered: qty,
            quantity_received: qty,
            unit: l.unit || 'ea',
            unit_cost: unitCost,
            line_total: Math.round(qty * unitCost),
            notes: undefined,
          }
        })

      const invoiceDate = invoice.invoice_date ? new Date(invoice.invoice_date) : now

      const po: PurchaseOrder = {
        id: poId,
        po_number: poNumber,
        org_id: currentOrg?.id ?? undefined,
        venue_id: currentVenue.id,
        supplier_id: invoice.supplier_id ?? '',
        supplier_name: invoice.supplier_name ?? supplier?.name ?? 'Unknown Supplier',
        order_date: invoiceDate,
        expected_delivery_date: invoiceDate,
        status: 'delivered',
        subtotal,
        tax_amount: taxAmount,
        total,
        notes: notes || undefined,
        created_by: user?.id ?? '',
        created_by_name: undefined,
        delivered_at: now,
        created_at: now,
        updated_at: now,
      }

      // 1. Create PO
      await addPurchaseOrder(po, items)

      // 2. Update stock + cost per ingredient
      for (const line of includedLines) {
        if (!line.ingredientId) continue
        const qty = parseFloat(line.quantity) || 0
        if (qty <= 0) continue

        const ingredient = ingredients.find(i => i.id === line.ingredientId)
        if (!ingredient) continue

        const updates: Record<string, unknown> = {}

        if (line.updateStock) {
          updates.current_stock = (ingredient.current_stock ?? 0) + qty
        }

        if (line.updateCost) {
          const priceDollars = parseFloat(line.unitPrice) || 0
          // cost_per_unit stored in cents
          updates.cost_per_unit = Math.round(priceDollars * 100)
          updates.last_cost_update = now
        }

        if (Object.keys(updates).length > 0) {
          await updateIngredient(line.ingredientId, updates)
        }
      }

      // 3. Mark invoice as confirmed
      await updateInvoice(invoice.id, {
        status: 'confirmed',
        confirmed_at: now.toISOString(),
        confirmed_by: user?.id ?? undefined,
        matched_po_id: poId,
      })

      toast.success('Purchase created. Stock and costs updated.')
      navigate(`/inventory/purchase-orders/${poId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create purchase'
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  if (!invoice) {
    return (
      <PageShell toolbar={<div />}>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Package className="h-10 w-10 opacity-30 mb-2" />
          <p className="text-sm">Invoice not found.</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate('/inventory/invoices')}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Invoices
          </Button>
        </div>
      </PageShell>
    )
  }

  const toolbar = (
    <PageToolbar
      title="Create Purchase from Invoice"
      filters={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/inventory/invoices/${invoice.id}`)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Invoice
        </Button>
      }
      primaryAction={
        existingPO
          ? undefined
          : {
              label: 'Confirm Purchase',
              icon: ShoppingCart,
              onClick: handleConfirm,
              disabled: isSaving,
              variant: 'primary',
            }
      }
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

        {/* Already converted warning */}
        {existingPO && (
          <Card className="border-green-300 bg-green-50/40 dark:bg-green-950/20">
            <CardContent className="pt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>This invoice has already been converted to purchase <span className="font-medium">{existingPO.po_number}</span>.</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/inventory/purchase-orders/${existingPO.id}`)}
              >
                View Purchase
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Invoice Header ───────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Supplier</span>
                <span className="font-medium">{invoice.supplier_name ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice #</span>
                <span className="font-mono">{invoice.invoice_number ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span>{safeFormat(invoice.invoice_date, 'd MMM yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={invoice.status === 'confirmed' ? 'default' : 'secondary'} className="capitalize">
                  {invoice.status.replace('_', ' ')}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice Total</span>
                <span className="font-medium">{formatCurrency((invoiceTotal) * 100)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Matched Lines Total</span>
                <span className="font-medium">{formatCurrency(matchedTotal * 100)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium">
                <span>Variance</span>
                <span
                  className={
                    Math.abs(variancePct) < 2
                      ? 'text-green-600'
                      : Math.abs(variancePct) <= 10
                      ? 'text-amber-600'
                      : 'text-destructive'
                  }
                >
                  {variance >= 0 ? '+' : ''}{formatCurrency(variance * 100)}
                  {invoiceTotal > 0 && (
                    <span className="ml-1 text-xs font-normal">
                      ({variancePct >= 0 ? '+' : ''}{variancePct.toFixed(1)}%)
                    </span>
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Line Items ───────────────────────────────────────── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">
              Line Items
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({lines.filter(l => l.included).length} of {lines.length} included)
              </span>
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => setLines(prev => prev.map(l => ({ ...l, included: true })))}
              >
                Include All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => setLines(prev => prev.map(l => ({ ...l, included: false })))}
              >
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <span className="sr-only">Include</span>
                    </TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Ingredient</TableHead>
                    <TableHead className="w-24">Match</TableHead>
                    <TableHead className="w-24">Qty</TableHead>
                    <TableHead className="w-20">Unit</TableHead>
                    <TableHead className="w-28">Unit Price</TableHead>
                    <TableHead className="w-28 text-right">Line Total</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, idx) => {
                    const matchCfg = MATCH_CONFIG[line.matchStatus as keyof typeof MATCH_CONFIG] ?? MATCH_CONFIG.unmatched
                    const qty = parseFloat(line.quantity) || 0
                    const price = parseFloat(line.unitPrice) || 0
                    const lineTotal = qty * price

                    return (
                      <TableRow
                        key={line.invoiceLineItemId}
                        className={!line.included ? 'opacity-40' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={line.included}
                            onCheckedChange={checked =>
                              updateLine(idx, { included: !!checked })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-sm max-w-[160px]">
                          <p className="truncate text-muted-foreground text-xs" title={line.rawDescription}>
                            {line.rawDescription}
                          </p>
                        </TableCell>
                        <TableCell className="min-w-[160px]">
                          {line.ingredientId ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium truncate max-w-[130px]">
                                {line.ingredientName}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 shrink-0"
                                title="Change ingredient"
                                onClick={() => updateLine(idx, { ingredientId: null, ingredientName: line.rawDescription, updateCost: false, updateStock: false })}
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <Select
                              value={line.ingredientId ?? ''}
                              onValueChange={val => handleIngredientChange(idx, val)}
                            >
                              <SelectTrigger className="h-7 text-xs w-[160px]">
                                <SelectValue placeholder="Assign ingredient…" />
                              </SelectTrigger>
                              <SelectContent>
                                {ingredients
                                  .filter(i => i.active)
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(ing => (
                                    <SelectItem key={ing.id} value={ing.id}>
                                      {ing.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={matchCfg.variant} className="text-xs">
                            {matchCfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.001"
                            value={line.quantity}
                            onChange={e => updateLine(idx, { quantity: e.target.value })}
                            className="h-7 text-xs w-20"
                            disabled={!line.included}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={line.unit}
                            onChange={e => updateLine(idx, { unit: e.target.value })}
                            className="h-7 text-xs w-16"
                            placeholder="ea"
                            disabled={!line.included}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitPrice}
                            onChange={e => updateLine(idx, { unitPrice: e.target.value })}
                            className="h-7 text-xs w-24"
                            disabled={!line.included}
                          />
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {lineTotal > 0 ? formatCurrency(lineTotal * 100) : '—'}
                        </TableCell>
                        <TableCell>
                          {line.ingredientId && line.included && (
                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <Checkbox
                                  checked={line.updateStock}
                                  onCheckedChange={checked => updateLine(idx, { updateStock: !!checked })}
                                  className="h-3 w-3"
                                />
                                Stock
                              </label>
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <Checkbox
                                  checked={line.updateCost}
                                  onCheckedChange={checked => updateLine(idx, { updateCost: !!checked })}
                                  className="h-3 w-3"
                                />
                                Cost
                              </label>
                            </div>
                          )}
                          {!line.ingredientId && line.included && (
                            <div className="flex items-center gap-1 text-xs text-amber-600">
                              <AlertCircle className="h-3 w-3" />
                              <span>Assign to update</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ── Notes ───────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="purchase-notes">Notes (optional)</Label>
          <textarea
            id="purchase-notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Add any notes about this delivery…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>

        {/* ── Footer Actions ──────────────────────────────────── */}
        {!existingPO && (
          <div className="flex justify-end gap-3 pb-6">
            <Button
              variant="outline"
              onClick={() => navigate(`/inventory/invoices/${invoice.id}`)}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShoppingCart className="h-4 w-4 mr-2" />
              )}
              Confirm Purchase
            </Button>
          </div>
        )}
      </div>
    </PageShell>
  )
}
