import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Package,
  CheckCircle,
  AlertTriangle,
  Clock,
  Building2,
  Calendar,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { PageShell, PageToolbar } from '@/components/shared'
import { useDataStore } from '@/lib/store/dataStore'
import { useAuth } from '@/contexts/AuthContext'
import { logPriceChange, runCostCascade, applyCascadeToState, persistCascadeResults } from '@/lib/services/costCascade'
import { calculateCostPerBaseUnit, calculatePackToBaseFactor } from '@/lib/utils/unitConversions'
import { getDefaultOrgSettings } from '@/lib/venueSettings'
import { formatCurrency } from '@/lib/utils/formatters'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { format, isValid, differenceInCalendarDays } from 'date-fns'
import type { PurchaseOrderItem } from '@/types'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReceiveLineState {
  receivingQty: number
  actualUnitCost: number
  updateCost: boolean
  notes: string
  backordered: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeFormat(date: unknown, fmt: string, fallback = '—'): string {
  try {
    const d = date instanceof Date ? date : new Date(date as string | number)
    return isValid(d) ? format(d, fmt) : fallback
  } catch {
    return fallback
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function POReceiving() {
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
    loadPurchaseOrdersFromDB,
    loadSuppliersFromDB,
    setIngredients: setStoreIngredients,
    setRecipes,
    setRecipeIngredients: setStoreRecipeIngredients,
    setMenuItems,
  } = useDataStore()
  const { user, profile } = useAuth()

  const [lines, setLines] = useState<Record<string, ReceiveLineState>>({})
  const [receivingNotes, setReceivingNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [receiveResult, setReceiveResult] = useState<{
    allReceived: boolean
    itemCount: number
    totalValue: number
  } | null>(null)

  useEffect(() => {
    loadPurchaseOrdersFromDB()
    loadSuppliersFromDB()
  }, [loadPurchaseOrdersFromDB, loadSuppliersFromDB])

  const po = purchaseOrders.find((p) => p.id === poId)
  const supplier = po ? suppliers.find((s) => s.id === po.supplier_id) : null

  // Initialise line states from PO items
  useEffect(() => {
    if (!po?.items) return
    const init: Record<string, ReceiveLineState> = {}
    po.items.forEach((item: PurchaseOrderItem) => {
      const remaining = item.quantity_ordered - (item.quantity_received || 0)
      init[item.id] = {
        receivingQty: Math.max(0, remaining),
        actualUnitCost: item.unit_cost,
        updateCost: false,
        notes: '',
        backordered: false,
      }
    })
    setLines(init)
  }, [po?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Derived stats (hooks must be before any early return) ──────────────

  const varianceSummary = useMemo(() => {
    if (!po?.items) return { items: 0, costImpact: 0 }
    let items = 0
    let costImpact = 0
    for (const item of po.items) {
      const line = lines[item.id]
      if (!line) continue
      const diff = line.actualUnitCost - item.unit_cost
      if (diff !== 0 && line.receivingQty > 0) {
        items++
        costImpact += diff * line.receivingQty
      }
    }
    return { items, costImpact }
  }, [po?.items, lines])

  const totalReceivingValue = useMemo(() => {
    if (!po?.items) return 0
    return po.items.reduce((sum, item) => {
      const line = lines[item.id]
      if (!line || line.backordered) return sum
      return sum + line.receivingQty * line.actualUnitCost
    }, 0)
  }, [po?.items, lines])

  // ─── Guards ─────────────────────────────────────────────────────────────

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

  if (po.status !== 'submitted' && po.status !== 'confirmed') {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <p className="font-semibold mb-1">Cannot receive this order</p>
          <p className="text-muted-foreground text-sm mb-4">
            Only submitted or confirmed POs can be received. This order is <strong>{po.status}</strong>.
          </p>
          <Button variant="outline" onClick={() => navigate(`/inventory/purchase-orders/${po.id}`)}>
            View Order
          </Button>
        </Card>
      </div>
    )
  }

  // ─── Line state helpers ─────────────────────────────────────────────────

  const setLine = (id: string, patch: Partial<ReceiveLineState>) => {
    setLines((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  // ─── Submit ─────────────────────────────────────────────────────────────

  const handleConfirmReceive = async () => {
    setSaving(true)
    try {
      const updatedItems = po.items?.map((item: PurchaseOrderItem) => {
        const line = lines[item.id]
        const received = line?.backordered ? 0 : (line?.receivingQty || 0)
        return {
          ...item,
          quantity_received: (item.quantity_received || 0) + received,
          notes: line?.notes || item.notes,
        }
      })

      const allReceived = updatedItems?.every(
        (item: PurchaseOrderItem) => (item.quantity_received || 0) >= item.quantity_ordered
      )

      const receivedByName = profile
        ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Manager'
        : 'Manager'

      await updatePurchaseOrder(po.id, {
        items: updatedItems,
        status: allReceived ? 'delivered' : 'confirmed',
        ...(allReceived && { delivered_at: new Date() }),
        received_by_name: receivedByName,
        notes: receivingNotes
          ? [po.notes, `[Receiving notes] ${receivingNotes}`].filter(Boolean).join('\n')
          : po.notes,
      })

      // ── GAP 4: Record actual lead time for supplier learning ──────────────
      // Log when PO is fully received and has a submitted_at timestamp.
      if (allReceived && po.supplier_id && po.submitted_at && po.org_id) {
        try {
          const submittedAt = new Date(po.submitted_at as unknown as string)
          const receivedAt  = new Date()
          const actualLeadDays = Math.max(0, differenceInCalendarDays(receivedAt, submittedAt))
          const receiverName = profile
            ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || user?.email
            : user?.email

          await supabase
            .from('supplier_lead_time_logs' as never)
            .insert({
              org_id:            po.org_id,
              supplier_id:       po.supplier_id,
              purchase_order_id: po.id,
              submitted_at:      submittedAt.toISOString(),
              received_at:       receivedAt.toISOString(),
              actual_lead_days:  actualLeadDays,
              notes:             `PO ${po.po_number} received by ${receiverName ?? 'unknown'}`,
            } as never)
        } catch {
          // Non-fatal — don't block the main receive flow
        }
      }

      // Update ingredient stock and optionally cost, then cascade
      const gpThreshold = getDefaultOrgSettings().below_gp_threshold_alert_percent ?? 60
      const costChangedIngredients: Array<{ id: string; oldCost: number; newCost: number }> = []

      for (const item of po.items || []) {
        const line = lines[item.id]
        if (!line || line.backordered || line.receivingQty <= 0) continue

        const ingredient = ingredients.find((i) => i.id === item.ingredient_id)
        if (!ingredient) continue

        const updates: Record<string, unknown> = {
          current_stock: ingredient.current_stock + line.receivingQty,
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

      // Cost cascade for changed prices
      let currentIngredients = ingredients
      let currentRecipes = recipes
      let currentRecipeIngredients = recipeIngredients
      let currentMenuItems = menuItems
      let totalAffectedRecipes = 0
      let totalGpAlerts = 0

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
          // Persist cascade results to Supabase (recipes + menu items)
          await persistCascadeResults(cascade, applied.recipes, applied.menuItems)
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

      const itemCount = updatedItems?.filter((i: PurchaseOrderItem) => {
        const line = lines[i.id]
        return line && !line.backordered && line.receivingQty > 0
      }).length ?? 0

      setReceiveResult({ allReceived: allReceived ?? false, itemCount, totalValue: totalReceivingValue })
      setDone(true)

      if (costChangedIngredients.length > 0) {
        const alertMsg = totalGpAlerts > 0 ? ` ${totalGpAlerts} GP alert(s).` : ''
        toast.success(`Delivery recorded. ${costChangedIngredients.length} price(s) updated, ${totalAffectedRecipes} recipe(s) recalculated.${alertMsg}`)
      } else {
        toast.success(allReceived ? 'Delivery complete — stock updated.' : 'Partial delivery recorded.')
      }
    } catch {
      toast.error('Failed to record delivery')
    } finally {
      setSaving(false)
    }
  }

  // ─── Done screen ─────────────────────────────────────────────────────────

  if (done && receiveResult) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Card className="p-10 max-w-md w-full text-center space-y-4">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold">
            {receiveResult.allReceived ? 'Delivery Complete' : 'Partial Delivery Recorded'}
          </h2>
          <p className="text-muted-foreground">
            {receiveResult.itemCount} item{receiveResult.itemCount !== 1 ? 's' : ''} received
            &nbsp;·&nbsp;
            {formatCurrency(receiveResult.totalValue)} total value
          </p>
          <p className="text-sm text-muted-foreground">
            PO status updated to{' '}
            <Badge variant={receiveResult.allReceived ? 'default' : 'secondary'}>
              {receiveResult.allReceived ? 'Delivered' : 'Confirmed (Partial)'}
            </Badge>
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Button variant="outline" onClick={() => navigate('/inventory/purchase-orders')}>
              All Purchase Orders
            </Button>
            <Button onClick={() => navigate(`/inventory/purchase-orders/${po.id}`)}>
              View Order <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // ─── Toolbar ─────────────────────────────────────────────────────────────

  const toolbar = (
    <PageToolbar
      title={`Receive — ${po.po_number}`}
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigate(`/inventory/purchase-orders/${po.id}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Order
        </Button>
      }
      primaryAction={{
        label: saving ? 'Recording…' : 'Confirm Receipt',
        icon: CheckCircle,
        onClick: handleConfirmReceive,
        variant: 'primary',
      }}
    />
  )

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
              <BreadcrumbLink asChild>
                <Link to={`/inventory/purchase-orders/${po.id}`}>{po.po_number}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Receive</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* PO header summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Supplier</p>
              <p className="font-semibold text-sm">{po.supplier_name}</p>
              {supplier?.contact_person && (
                <p className="text-xs text-muted-foreground">{supplier.contact_person}</p>
              )}
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Expected Delivery</p>
              <p className="font-semibold text-sm">
                {safeFormat(po.expected_delivery_date, 'EEE dd MMM yyyy')}
              </p>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Receiving on</p>
              <p className="font-semibold text-sm">{format(new Date(), 'EEE dd MMM yyyy, HH:mm')}</p>
              <p className="text-xs text-muted-foreground">
                by {profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || user?.email : user?.email}
              </p>
            </div>
          </Card>
        </div>

        {/* Line items */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base">Receive Items</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enter quantities received. Mark items as backordered if not delivered.
              </p>
            </div>
            {varianceSummary.items > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-lg">
                <AlertTriangle className="h-4 w-4" />
                {varianceSummary.items} price variance{varianceSummary.items !== 1 ? 's' : ''}
                {' '}({varianceSummary.costImpact > 0 ? '+' : ''}{formatCurrency(varianceSummary.costImpact)})
              </div>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Prev. Received</TableHead>
                <TableHead className="text-right w-24">Receiving</TableHead>
                <TableHead className="text-right">PO Cost</TableHead>
                <TableHead className="text-right w-28">Actual Cost</TableHead>
                <TableHead className="text-center w-24">Update Cost</TableHead>
                <TableHead className="text-center w-24">Backordered</TableHead>
                <TableHead className="w-40">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.items?.map((item: PurchaseOrderItem) => {
                const line = lines[item.id]
                if (!line) return null
                const remaining = item.quantity_ordered - (item.quantity_received || 0)
                const costDiff = line.actualUnitCost - item.unit_cost
                const variancePct =
                  item.unit_cost > 0
                    ? ((costDiff / item.unit_cost) * 100).toFixed(1)
                    : '0'

                return (
                  <TableRow
                    key={item.id}
                    className={[
                      line.backordered ? 'opacity-50' : '',
                      costDiff !== 0 && !line.backordered ? 'bg-amber-50/40 dark:bg-amber-950/20' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{item.ingredient_name}</p>
                        {item.product_code && (
                          <p className="text-xs text-muted-foreground">{item.product_code}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.quantity_ordered} {item.unit}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.quantity_received || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        max={remaining}
                        disabled={line.backordered}
                        value={line.receivingQty}
                        onChange={(e) =>
                          setLine(item.id, { receivingQty: parseFloat(e.target.value) || 0 })
                        }
                        className="w-20 text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {formatCurrency(item.unit_cost)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          disabled={line.backordered}
                          value={line.actualUnitCost}
                          onChange={(e) =>
                            setLine(item.id, { actualUnitCost: parseFloat(e.target.value) || 0 })
                          }
                          className={`w-24 text-right ${costDiff !== 0 ? 'border-amber-400' : ''}`}
                        />
                        {costDiff !== 0 && !line.backordered && (
                          <span
                            className={`text-xs font-semibold ${costDiff > 0 ? 'text-red-600' : 'text-green-600'}`}
                          >
                            {costDiff > 0 ? '+' : ''}
                            {variancePct}%
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {costDiff !== 0 && !line.backordered && (
                        <Checkbox
                          checked={line.updateCost}
                          onCheckedChange={(c) => setLine(item.id, { updateCost: c === true })}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={line.backordered}
                        onCheckedChange={(c) =>
                          setLine(item.id, {
                            backordered: c === true,
                            receivingQty: c === true ? 0 : Math.max(0, remaining),
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="e.g., short by 2"
                        value={line.notes}
                        onChange={(e) => setLine(item.id, { notes: e.target.value })}
                        className="text-xs h-8"
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {/* Totals footer */}
          <div className="p-4 border-t flex items-center justify-between bg-muted/30">
            <div className="text-sm text-muted-foreground space-x-4">
              <span>
                Receiving{' '}
                <strong>
                  {po.items?.filter((i: PurchaseOrderItem) => {
                    const l = lines[i.id]
                    return l && !l.backordered && l.receivingQty > 0
                  }).length ?? 0}
                </strong>{' '}
                / {po.items?.length ?? 0} items
              </span>
              {po.items?.some((i: PurchaseOrderItem) => lines[i.id]?.backordered) && (
                <span className="text-amber-600">
                  {po.items?.filter((i: PurchaseOrderItem) => lines[i.id]?.backordered).length} backordered
                </span>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Receiving Value</p>
              <p className="text-lg font-bold">{formatCurrency(totalReceivingValue)}</p>
            </div>
          </div>
        </Card>

        {/* Receiving notes */}
        <Card className="p-4 space-y-2">
          <Label htmlFor="receiving_notes">Delivery Notes (optional)</Label>
          <Textarea
            id="receiving_notes"
            value={receivingNotes}
            onChange={(e) => setReceivingNotes(e.target.value)}
            placeholder="e.g., Driver arrived 30 min late. Produce quality acceptable. 2 units of X backordered to next delivery."
            rows={3}
          />
        </Card>

        {/* Price variance summary */}
        {varianceSummary.items > 0 && (
          <Card className="p-4 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm text-amber-800 dark:text-amber-200">
                  Price Variance Detected
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  {varianceSummary.items} item{varianceSummary.items !== 1 ? 's have' : ' has'} a price
                  different from the PO. Net impact:{' '}
                  <strong>
                    {varianceSummary.costImpact > 0 ? '+' : ''}
                    {formatCurrency(varianceSummary.costImpact)}
                  </strong>
                  . Tick <strong>Update Cost</strong> on those rows to apply the new price to ingredient
                  records (triggers recipe cost cascade).
                </p>
              </div>
            </div>
          </Card>
        )}

        <Separator />

        {/* Action row */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigate(`/inventory/purchase-orders/${po.id}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Order
          </Button>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm text-muted-foreground hidden sm:block">
              <p>Total receiving value</p>
              <p className="font-bold text-foreground text-base">{formatCurrency(totalReceivingValue)}</p>
            </div>
            <Button
              size="lg"
              disabled={saving}
              onClick={handleConfirmReceive}
            >
              <Package className="h-4 w-4 mr-2" />
              {saving ? 'Recording…' : 'Confirm Receipt'}
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
