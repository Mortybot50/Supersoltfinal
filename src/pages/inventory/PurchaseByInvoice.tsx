import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, Trash2, Receipt, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDataStore } from "@/lib/store/dataStore";
import { useAuth } from "@/contexts/AuthContext";
import { PurchaseOrder, PurchaseOrderItem } from "@/types";
import { toast } from "sonner";
import { PageShell, PageToolbar } from "@/components/shared";
import { formatCurrency } from "@/lib/utils/formatters";
import { format } from "date-fns";

interface ManualLine {
  id: string;
  ingredientId: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

const UNITS = ["kg", "g", "L", "mL", "ea"] as const;

function emptyLine(): ManualLine {
  return {
    id: crypto.randomUUID(),
    ingredientId: "",
    quantity: "",
    unit: "ea",
    unitPrice: "",
  };
}

export default function PurchaseByInvoice() {
  const navigate = useNavigate();
  const { currentVenue, currentOrg, user } = useAuth();
  const {
    ingredients,
    suppliers,
    purchaseOrders,
    loadIngredientsFromDB,
    loadSuppliersFromDB,
    loadPurchaseOrdersFromDB,
    addPurchaseOrder,
    updateIngredient,
  } = useDataStore();

  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [deliveryDate, setDeliveryDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ManualLine[]>([emptyLine()]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadIngredientsFromDB();
    loadSuppliersFromDB();
    loadPurchaseOrdersFromDB();
  }, [loadIngredientsFromDB, loadSuppliersFromDB, loadPurchaseOrdersFromDB]);

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (id: string) =>
    setLines((prev) => prev.filter((l) => l.id !== id));
  const updateLine = (id: string, patch: Partial<ManualLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const handleIngredientChange = (id: string, ingredientId: string) => {
    const ing = ingredients.find((i) => i.id === ingredientId);
    updateLine(id, {
      ingredientId,
      unit: ing?.unit ?? "ea",
    });
  };

  const subtotal = useMemo(() => {
    return lines.reduce((sum, l) => {
      const qty = parseFloat(l.quantity) || 0;
      const price = parseFloat(l.unitPrice) || 0;
      return sum + qty * price;
    }, 0);
  }, [lines]);

  // GST 10% (assuming prices are ex-GST for manual entry)
  const taxAmount = subtotal * 0.1;
  const total = subtotal + taxAmount;

  const validLines = lines.filter(
    (l) =>
      l.ingredientId &&
      parseFloat(l.quantity) > 0 &&
      parseFloat(l.unitPrice) >= 0,
  );

  const handleConfirm = async () => {
    if (!supplierId) {
      toast.error("Select a supplier.");
      return;
    }
    if (!invoiceNumber.trim()) {
      toast.error("Enter an invoice number.");
      return;
    }
    if (validLines.length === 0) {
      toast.error(
        "Add at least one line item with an ingredient and quantity.",
      );
      return;
    }
    if (!currentVenue?.id || currentVenue.id === "all") {
      toast.error("Select a specific venue before saving.");
      return;
    }

    // Check for duplicate
    const poNumber = `INV-${invoiceNumber.trim()}`;
    const duplicate = purchaseOrders.find(
      (po) => po.po_number === poNumber && po.venue_id === currentVenue.id,
    );
    if (duplicate) {
      toast.error(
        `Invoice ${invoiceNumber} has already been logged (${poNumber}).`,
      );
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date();
      const poId = crypto.randomUUID();
      const supplier = suppliers.find((s) => s.id === supplierId);

      const items: PurchaseOrderItem[] = validLines.map((l) => {
        const ing = ingredients.find((i) => i.id === l.ingredientId)!;
        const qty = parseFloat(l.quantity);
        const unitCost = Math.round((parseFloat(l.unitPrice) || 0) * 100); // cents
        return {
          id: crypto.randomUUID(),
          purchase_order_id: poId,
          ingredient_id: l.ingredientId,
          ingredient_name: ing?.name ?? "",
          quantity_ordered: qty,
          quantity_received: qty,
          unit: l.unit,
          unit_cost: unitCost,
          line_total: Math.round(qty * unitCost),
          notes: undefined,
        };
      });

      const subtotalCents = Math.round(subtotal * 100);
      const taxCents = Math.round(taxAmount * 100);
      const totalCents = subtotalCents + taxCents;

      const po: PurchaseOrder = {
        id: poId,
        po_number: poNumber,
        org_id: currentOrg?.id ?? undefined,
        venue_id: currentVenue.id,
        supplier_id: supplierId,
        supplier_name: supplier?.name ?? "Unknown",
        order_date: new Date(invoiceDate),
        expected_delivery_date: new Date(deliveryDate),
        status: "delivered",
        subtotal: subtotalCents,
        tax_amount: taxCents,
        total: totalCents,
        notes: notes || undefined,
        created_by: user?.id ?? "",
        created_by_name: undefined,
        delivered_at: new Date(deliveryDate),
        created_at: now,
        updated_at: now,
      };

      // 1. Create PO
      await addPurchaseOrder(po, items);

      // 2. Update ingredient stock + cost
      for (const line of validLines) {
        const qty = parseFloat(line.quantity) || 0;
        const ingredient = ingredients.find((i) => i.id === line.ingredientId);
        if (!ingredient || qty <= 0) continue;

        const unitCostCents = Math.round(
          (parseFloat(line.unitPrice) || 0) * 100,
        );
        await updateIngredient(line.ingredientId, {
          current_stock: (ingredient.current_stock ?? 0) + qty,
          cost_per_unit: unitCostCents,
          last_cost_update: now,
        });
      }

      toast.success("Invoice logged. Stock and costs updated.");
      navigate(`/inventory/purchase-orders/${poId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to log invoice";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const toolbar = (
    <PageToolbar
      title="Log Invoice"
      filters={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/inventory/purchase-orders?view=invoices")}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      }
      primaryAction={{
        label: "Log Invoice",
        icon: Receipt,
        onClick: handleConfirm,
        disabled: isSaving,
        variant: "primary",
      }}
    />
  );

  return (
    <PageShell toolbar={toolbar}>
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        {/* ── Invoice Header ─────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier…" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-number">Invoice Number *</Label>
              <Input
                id="inv-number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-12345"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-date">Invoice Date</Label>
              <Input
                id="inv-date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="del-date">Delivery Date</Label>
              <Input
                id="del-date"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Line Items ──────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Line Items</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={addLine}
              className="h-7 text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient *</TableHead>
                    <TableHead className="w-24">Qty *</TableHead>
                    <TableHead className="w-20">Unit</TableHead>
                    <TableHead className="w-28">Unit Price (ex GST)</TableHead>
                    <TableHead className="w-28 text-right">
                      Line Total
                    </TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => {
                    const qty = parseFloat(line.quantity) || 0;
                    const price = parseFloat(line.unitPrice) || 0;
                    const lineTotal = qty * price;

                    return (
                      <TableRow key={line.id}>
                        <TableCell className="min-w-[180px]">
                          <Select
                            value={line.ingredientId}
                            onValueChange={(val) =>
                              handleIngredientChange(line.id, val)
                            }
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select ingredient…" />
                            </SelectTrigger>
                            <SelectContent>
                              {ingredients
                                .filter((i) => i.active)
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((ing) => (
                                  <SelectItem key={ing.id} value={ing.id}>
                                    {ing.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.001"
                            value={line.quantity}
                            onChange={(e) =>
                              updateLine(line.id, { quantity: e.target.value })
                            }
                            className="h-8 text-sm w-20"
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={line.unit}
                            onValueChange={(val) =>
                              updateLine(line.id, { unit: val })
                            }
                          >
                            <SelectTrigger className="h-8 text-sm w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {UNITS.map((u) => (
                                <SelectItem key={u} value={u}>
                                  {u}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitPrice}
                            onChange={(e) =>
                              updateLine(line.id, { unitPrice: e.target.value })
                            }
                            className="h-8 text-sm w-24"
                            placeholder="0.00"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {lineTotal > 0
                            ? formatCurrency(lineTotal * 100)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeLine(line.id)}
                            disabled={lines.length === 1}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ── Totals + Notes ──────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any notes about this delivery…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          <Card>
            <CardContent className="pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal (ex GST)</span>
                <span>{formatCurrency(subtotal * 100)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST (10%)</span>
                <span>{formatCurrency(taxAmount * 100)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span>{formatCurrency(total * 100)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Footer Actions ──────────────────────────────────── */}
        <div className="flex justify-end gap-3 pb-6">
          <Button
            variant="outline"
            onClick={() => navigate("/inventory/purchase-orders?view=invoices")}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Receipt className="h-4 w-4 mr-2" />
            )}
            Log Invoice
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
