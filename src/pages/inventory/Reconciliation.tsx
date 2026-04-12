import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  GitMerge,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDataStore } from "@/lib/store/dataStore";
import { useAuth } from "@/contexts/AuthContext";
import { ReconciliationLog, ReconciliationLineItem } from "@/types";
import { toast } from "sonner";
import { PageShell, PageToolbar } from "@/components/shared";
import { formatCurrency } from "@/lib/utils/formatters";

// Per-line reconciliation state
interface ReconLine {
  invoiceLineItemId: string;
  poLineItemId: string | null;
  ingredientId: string | null;
  ingredientName: string;
  rawDescription: string;
  expectedQuantity: number | null; // from PO
  receivedQuantity: string; // operator enters this
  expectedUnitPrice: number | null;
  actualUnitPrice: number | null;
  updateCost: boolean; // whether to update ingredient default cost
}

function varianceColor(pct: number | null): string {
  if (pct === null) return "";
  if (Math.abs(pct) < 2) return "text-green-600";
  if (Math.abs(pct) <= 10) return "text-amber-600";
  return "text-destructive";
}

function varianceBadge(status: ReconciliationLineItem["status"]) {
  switch (status) {
    case "received_full":
      return (
        <Badge variant="default" className="bg-green-500 text-white text-xs">
          Received
        </Badge>
      );
    case "received_partial":
      return (
        <Badge
          variant="secondary"
          className="bg-amber-100 text-amber-700 border-amber-300 text-xs"
        >
          Partial
        </Badge>
      );
    case "not_received":
      return (
        <Badge variant="destructive" className="text-xs">
          Not Received
        </Badge>
      );
    case "unexpected":
      return (
        <Badge variant="outline" className="text-xs">
          Unexpected
        </Badge>
      );
  }
}

function calcLineStatus(
  expected: number | null,
  received: number,
): ReconciliationLineItem["status"] {
  if (expected === null) return "unexpected";
  if (received <= 0) return "not_received";
  if (Math.abs(received - expected) / expected < 0.02) return "received_full";
  return "received_partial";
}

export default function Reconciliation() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const { currentVenue, user } = useAuth();
  const {
    invoices,
    purchaseOrders,
    ingredients,
    loadInvoicesFromDB,
    addReconciliation,
    updateInvoice,
    updateIngredient,
  } = useDataStore();

  const [selectedPoId, setSelectedPoId] = useState("");
  const [lines, setLines] = useState<ReconLine[]>([]);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const invoice = useMemo(
    () => invoices.find((inv) => inv.id === invoiceId),
    [invoices, invoiceId],
  );

  useEffect(() => {
    if (currentVenue?.id && currentVenue.id !== "all") {
      loadInvoicesFromDB(currentVenue.id);
    }
  }, [currentVenue?.id, loadInvoicesFromDB]);

  // Populate recon lines from invoice line items
  useEffect(() => {
    if (!invoice) return;
    const lineItems = invoice.line_items ?? [];

    const initial: ReconLine[] = lineItems.map((li) => {
      // Try to match to PO line if a PO is selected
      const selectedPO = purchaseOrders.find((po) => po.id === selectedPoId);
      const poLine = selectedPO?.items?.find(
        (pi) => pi.ingredient_id === li.ingredient_id,
      );

      return {
        invoiceLineItemId: li.id,
        poLineItemId: poLine?.id ?? null,
        ingredientId: li.ingredient_id ?? null,
        ingredientName: li.ingredient_name ?? li.raw_description,
        rawDescription: li.raw_description,
        expectedQuantity: poLine?.quantity_ordered ?? null,
        receivedQuantity: (
          li.confirmed_quantity ??
          li.extracted_quantity ??
          ""
        ).toString(),
        expectedUnitPrice: poLine?.unit_cost ?? null,
        actualUnitPrice:
          li.confirmed_unit_price ?? li.extracted_unit_price ?? null,
        updateCost: false,
      };
    });

    setLines(initial);
  }, [invoice, selectedPoId, purchaseOrders]);

  // Filter POs by supplier + venue
  const eligiblePOs = useMemo(() => {
    if (!invoice) return [];
    return purchaseOrders.filter(
      (po) =>
        po.supplier_id === invoice.supplier_id &&
        po.venue_id === currentVenue?.id &&
        ["submitted", "confirmed"].includes(po.status),
    );
  }, [purchaseOrders, invoice, currentVenue?.id]);

  const updateLine = (idx: number, updates: Partial<ReconLine>) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...updates } : l)),
    );
  };

  const totals = useMemo(() => {
    const totalExpected = lines.reduce((s, l) => {
      if (l.expectedQuantity != null && l.expectedUnitPrice != null) {
        return s + l.expectedQuantity * l.expectedUnitPrice;
      }
      return s;
    }, 0);
    const totalReceived = lines.reduce((s, l) => {
      const qty = parseFloat(l.receivedQuantity) || 0;
      const price = l.actualUnitPrice ?? l.expectedUnitPrice ?? 0;
      return s + qty * price;
    }, 0);
    return {
      totalExpected,
      totalReceived,
      variance: totalReceived - totalExpected,
    };
  }, [lines]);

  const handleConfirm = async () => {
    if (!invoice || !currentVenue?.id || currentVenue.id === "all") {
      toast.error("Please select a specific venue.");
      return;
    }

    setIsSaving(true);
    try {
      const reconId = crypto.randomUUID();
      const now = new Date().toISOString();

      const reconLineItems: ReconciliationLineItem[] = lines.map((l) => {
        const qty = parseFloat(l.receivedQuantity) || 0;
        const qtyVariance =
          l.expectedQuantity != null ? qty - l.expectedQuantity : null;
        const priceVariance =
          l.actualUnitPrice != null && l.expectedUnitPrice != null
            ? l.actualUnitPrice - l.expectedUnitPrice
            : null;

        return {
          id: crypto.randomUUID(),
          reconciliation_id: reconId,
          invoice_line_item_id: l.invoiceLineItemId,
          po_line_item_id: l.poLineItemId ?? undefined,
          ingredient_id: l.ingredientId ?? undefined,
          ingredient_name: l.ingredientName,
          expected_quantity: l.expectedQuantity ?? undefined,
          received_quantity: qty,
          expected_unit_price: l.expectedUnitPrice ?? undefined,
          actual_unit_price: l.actualUnitPrice ?? undefined,
          quantity_variance: qtyVariance ?? undefined,
          price_variance: priceVariance ?? undefined,
          status: calcLineStatus(l.expectedQuantity, qty),
        };
      });

      const overallStatus: ReconciliationLog["status"] = reconLineItems.every(
        (l) => l.status === "received_full",
      )
        ? "fully_received"
        : reconLineItems.some((l) => l.status === "not_received")
          ? "disputed"
          : "partial";

      const reconLog: ReconciliationLog = {
        id: reconId,
        invoice_id: invoice.id,
        purchase_order_id: selectedPoId || undefined,
        venue_id: currentVenue.id,
        reconciled_by: user?.id,
        reconciled_at: now,
        total_expected_value: totals.totalExpected,
        total_received_value: totals.totalReceived,
        total_variance: totals.variance,
        status: overallStatus,
        notes: notes || undefined,
        line_items: reconLineItems,
      };

      // 1. Save reconciliation log
      await addReconciliation(reconLog, reconLineItems);

      // 2. Update invoice status
      await updateInvoice(invoice.id, {
        status: "confirmed",
        matched_po_id: selectedPoId || undefined,
        confirmed_at: now,
        confirmed_by: user?.id,
      });

      // 3. Update ingredient stock levels + costs for received items
      for (const line of lines) {
        if (!line.ingredientId) continue;
        const receivedQty = parseFloat(line.receivedQuantity) || 0;
        if (receivedQty <= 0) continue;

        const ingredient = ingredients.find((i) => i.id === line.ingredientId);
        if (!ingredient) continue;

        const newStock = (ingredient.current_stock ?? 0) + receivedQty;
        const updates: Record<string, unknown> = { current_stock: newStock };

        // Update cost if price changed and operator opted in
        if (line.updateCost && line.actualUnitPrice != null) {
          updates.cost_per_unit = line.actualUnitPrice;
          updates.last_cost_update = now;
        }

        await updateIngredient(line.ingredientId, updates);
      }

      toast.success("Reconciliation confirmed. Stock levels updated.");
      navigate(`/inventory/invoices/${invoice.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Reconciliation failed";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (!invoice) {
    return (
      <PageShell toolbar={<div />}>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <p className="text-sm">Invoice not found.</p>
        </div>
      </PageShell>
    );
  }

  const toolbar = (
    <PageToolbar
      title="Reconcile Invoice"
      filters={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/inventory/invoices/${invoiceId}`)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Invoice
        </Button>
      }
    />
  );

  return (
    <PageShell toolbar={toolbar}>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        {/* ── Summary header ─────────────────────────────────────── */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-sm text-muted-foreground">
            Invoice:{" "}
            <span className="font-medium text-foreground">
              {invoice.invoice_number ?? invoice.id.slice(0, 8)}
            </span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            Supplier:{" "}
            <span className="font-medium text-foreground">
              {invoice.supplier_name ?? "—"}
            </span>
          </div>
          <div className="ml-auto">
            <div className="space-y-1 w-48">
              <Label htmlFor="po-select">Link to Purchase Order</Label>
              <Select value={selectedPoId} onValueChange={setSelectedPoId}>
                <SelectTrigger id="po-select">
                  <SelectValue placeholder="No PO (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No PO</SelectItem>
                  {eligiblePOs.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.po_number} — {po.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ── Line-by-line comparison ────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3">
          {lines.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No line items to reconcile.
            </div>
          )}

          {lines.map((line, idx) => {
            const received = parseFloat(line.receivedQuantity) || 0;
            const status = calcLineStatus(line.expectedQuantity, received);
            const qtyVariance =
              line.expectedQuantity != null
                ? received - line.expectedQuantity
                : null;
            const qtyVariancePct =
              line.expectedQuantity && line.expectedQuantity > 0
                ? ((received - line.expectedQuantity) / line.expectedQuantity) *
                  100
                : null;
            const priceVariance =
              line.actualUnitPrice != null && line.expectedUnitPrice != null
                ? line.actualUnitPrice - line.expectedUnitPrice
                : null;
            const priceVariancePct =
              line.expectedUnitPrice &&
              line.expectedUnitPrice > 0 &&
              priceVariance != null
                ? (priceVariance / line.expectedUnitPrice) * 100
                : null;

            return (
              <Card
                key={line.invoiceLineItemId}
                className={`${
                  status === "not_received"
                    ? "border-destructive/40 bg-destructive/5"
                    : status === "received_partial"
                      ? "border-amber-400/40 bg-amber-50/30 dark:bg-amber-950/10"
                      : status === "received_full"
                        ? "border-green-400/30"
                        : ""
                }`}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    {/* Left: item info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {line.ingredientName}
                        </p>
                        {varianceBadge(status)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {line.rawDescription}
                      </p>
                    </div>

                    {/* Centre: quantity comparison */}
                    <div className="flex items-center gap-6 text-sm flex-wrap">
                      {/* PO quantity (expected) */}
                      <div className="text-center min-w-[80px]">
                        <p className="text-xs text-muted-foreground mb-1">
                          Expected (PO)
                        </p>
                        <p className="font-medium">
                          {line.expectedQuantity != null
                            ? line.expectedQuantity
                            : "—"}
                        </p>
                      </div>

                      <ArrowRight className="h-4 w-4 text-muted-foreground" />

                      {/* Received quantity (operator input) */}
                      <div className="text-center min-w-[80px]">
                        <p className="text-xs text-muted-foreground mb-1">
                          Received
                        </p>
                        <Input
                          className="w-24 h-8 text-center text-sm"
                          value={line.receivedQuantity}
                          onChange={(e) =>
                            updateLine(idx, {
                              receivedQuantity: e.target.value,
                            })
                          }
                          placeholder="0"
                        />
                      </div>

                      {/* Qty variance */}
                      {qtyVariance !== null && (
                        <div className="text-center min-w-[70px]">
                          <p className="text-xs text-muted-foreground mb-1">
                            Qty Δ
                          </p>
                          <p
                            className={`font-medium ${varianceColor(qtyVariancePct)}`}
                          >
                            {qtyVariance >= 0 ? "+" : ""}
                            {qtyVariance.toFixed(2)}
                            {qtyVariancePct != null && (
                              <span className="text-xs ml-1">
                                ({qtyVariancePct.toFixed(1)}%)
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right: price comparison */}
                    <div className="flex items-center gap-4 text-sm flex-wrap">
                      <div className="text-center min-w-[80px]">
                        <p className="text-xs text-muted-foreground mb-1">
                          PO Price
                        </p>
                        <p>
                          {line.expectedUnitPrice != null
                            ? formatCurrency(line.expectedUnitPrice * 100)
                            : "—"}
                        </p>
                      </div>
                      <div className="text-center min-w-[80px]">
                        <p className="text-xs text-muted-foreground mb-1">
                          Invoice Price
                        </p>
                        <p
                          className={
                            priceVariancePct != null
                              ? varianceColor(priceVariancePct)
                              : ""
                          }
                        >
                          {line.actualUnitPrice != null
                            ? formatCurrency(line.actualUnitPrice * 100)
                            : "—"}
                        </p>
                      </div>

                      {priceVariance != null &&
                        Math.abs(priceVariance) > 0.005 && (
                          <div className="flex items-center gap-2">
                            {priceVariance > 0 ? (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                            <div>
                              <p
                                className={`text-xs font-medium ${varianceColor(priceVariancePct)}`}
                              >
                                {priceVariance > 0 ? "+" : ""}
                                {formatCurrency(priceVariance * 100)}
                                {priceVariancePct != null &&
                                  ` (${priceVariancePct.toFixed(1)}%)`}
                              </p>
                              {line.ingredientId && (
                                <label className="flex items-center gap-1.5 text-xs cursor-pointer mt-1">
                                  <input
                                    type="checkbox"
                                    checked={line.updateCost}
                                    onChange={(e) =>
                                      updateLine(idx, {
                                        updateCost: e.target.checked,
                                      })
                                    }
                                    className="rounded"
                                  />
                                  Update cost
                                </label>
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── Totals ──────────────────────────────────────────────── */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between text-sm flex-wrap gap-4">
              <div className="space-y-1">
                <div className="flex gap-8">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Expected Value
                    </p>
                    <p className="font-medium">
                      {formatCurrency(totals.totalExpected * 100)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Received Value
                    </p>
                    <p className="font-medium">
                      {formatCurrency(totals.totalReceived * 100)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Variance</p>
                    <p
                      className={`font-medium ${totals.variance === 0 ? "text-green-600" : Math.abs(totals.variance) < 5 ? "text-amber-600" : "text-destructive"}`}
                    >
                      {totals.variance >= 0 ? "+" : ""}
                      {formatCurrency(totals.variance * 100)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="w-64">
                <Label htmlFor="recon-notes" className="text-xs">
                  Notes
                </Label>
                <Input
                  id="recon-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional reconciliation notes..."
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Actions ─────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(`/inventory/invoices/${invoiceId}`)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSaving || lines.length === 0}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                <GitMerge className="h-4 w-4 mr-2" />
                Confirm Receipt
              </>
            )}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
