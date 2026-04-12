import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Search,
  Plus,
  Eye,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  AlertTriangle,
  Loader2,
  Pencil,
  Trash2,
  ClipboardCheck,
  ArrowRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useDataStore } from "@/lib/store/dataStore";
import { useAuth } from "@/contexts/AuthContext";
import { PurchaseOrder, PurchaseOrderItem, Supplier } from "@/types";
import { format, differenceInDays, isAfter, isBefore, isValid } from "date-fns";
import { PageShell, PageToolbar } from "@/components/shared";
import { formatCurrency } from "@/lib/utils/formatters";
import {
  calculateOrderSuggestions,
  calculateExpectedDelivery,
  isPastCutoff,
  formatDeliverySchedule,
  generatePONumber,
  type OrderSuggestion,
} from "@/lib/utils/purchasingCalculations";
import { toast } from "sonner";
import { z } from "zod";

// ─── Helpers ───────────────────────────────────────────────────────────────

function safeFormat(date: unknown, fmt: string, fallback = "—"): string {
  try {
    const d = date instanceof Date ? date : new Date(date as string | number);
    return isValid(d) ? format(d, fmt) : fallback;
  } catch {
    return fallback;
  }
}

const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    variant: "secondary" as const,
    icon: Clock,
    color: "text-muted-foreground",
  },
  submitted: {
    label: "Submitted",
    variant: "default" as const,
    icon: Send,
    color: "text-blue-600",
  },
  confirmed: {
    label: "Confirmed",
    variant: "default" as const,
    icon: CheckCircle,
    color: "text-purple-600",
  },
  delivered: {
    label: "Delivered",
    variant: "default" as const,
    icon: Package,
    color: "text-green-600",
  },
  cancelled: {
    label: "Cancelled",
    variant: "destructive" as const,
    icon: XCircle,
    color: "text-destructive",
  },
};

type TabKey =
  | "all"
  | "draft"
  | "submitted"
  | "overdue"
  | "delivered"
  | "closed";

function isOverdue(po: PurchaseOrder): boolean {
  if (
    po.status === "delivered" ||
    po.status === "cancelled" ||
    po.status === "draft"
  )
    return false;
  try {
    const d = new Date(po.expected_delivery_date);
    return isValid(d) && isBefore(d, new Date());
  } catch {
    return false;
  }
}

function isClosed(po: PurchaseOrder): boolean {
  return po.status === "delivered" || po.status === "cancelled";
}

// ─── Create PO Step 2 — Line item type ────────────────────────────────────

interface POLineItem {
  ingredientId: string;
  ingredientName: string;
  currentStock: number;
  parLevel: number;
  pendingQty: number;
  suggestedQty: number;
  orderQty: number;
  unit: string;
  unitPrice: number; // cents
  lineTotal: number; // cents
  productCode?: string;
}

// ─── Zod schema for Step 1 ────────────────────────────────────────────────

const step1Schema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Main Component ───────────────────────────────────────────────────────

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const { user, currentOrg, currentVenue } = useAuth();
  const {
    purchaseOrders,
    suppliers,
    ingredients,
    isLoading,
    loadPurchaseOrdersFromDB,
    loadSuppliersFromDB,
    loadIngredientsFromDB,
    addPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
  } = useDataStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  // Create PO state
  const [createStep, setCreateStep] = useState<0 | 1 | 2>(0); // 0 = closed, 1 = modal, 2 = full page
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [poReference, setPOReference] = useState("");
  const [poNotes, setPONotes] = useState("");
  const [lineItems, setLineItems] = useState<POLineItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPurchaseOrdersFromDB();
    loadSuppliersFromDB();
    loadIngredientsFromDB();
  }, [loadPurchaseOrdersFromDB, loadSuppliersFromDB, loadIngredientsFromDB]);

  // ─── Tab counts ─────────────────────────────────────────────────────────

  const tabCounts = useMemo(() => {
    const counts = {
      all: 0,
      draft: 0,
      submitted: 0,
      overdue: 0,
      delivered: 0,
      closed: 0,
    };
    for (const po of purchaseOrders) {
      counts.all++;
      if (po.status === "draft") counts.draft++;
      if (po.status === "submitted" || po.status === "confirmed")
        counts.submitted++;
      if (isOverdue(po)) counts.overdue++;
      if (po.status === "delivered") counts.delivered++;
      if (isClosed(po)) counts.closed++;
    }
    return counts;
  }, [purchaseOrders]);

  // ─── Filtered POs ──────────────────────────────────────────────────────

  const filteredPOs = useMemo(() => {
    let filtered = purchaseOrders;

    // Tab filter
    switch (activeTab) {
      case "draft":
        filtered = filtered.filter((po) => po.status === "draft");
        break;
      case "submitted":
        filtered = filtered.filter(
          (po) => po.status === "submitted" || po.status === "confirmed",
        );
        break;
      case "overdue":
        filtered = filtered.filter((po) => isOverdue(po));
        break;
      case "delivered":
        filtered = filtered.filter((po) => po.status === "delivered");
        break;
      case "closed":
        filtered = filtered.filter((po) => isClosed(po));
        break;
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (po) =>
          (po.po_number ?? "").toLowerCase().includes(q) ||
          (po.supplier_name ?? "").toLowerCase().includes(q) ||
          po.notes?.toLowerCase().includes(q),
      );
    }

    return filtered.sort(
      (a, b) =>
        (new Date(b.order_date).getTime() || 0) -
        (new Date(a.order_date).getTime() || 0),
    );
  }, [purchaseOrders, activeTab, searchQuery]);

  // ─── Create PO Helpers ─────────────────────────────────────────────────

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId) || null,
    [suppliers, selectedSupplierId],
  );

  const expectedDelivery = useMemo(() => {
    if (!selectedSupplier) return null;
    return calculateExpectedDelivery(selectedSupplier);
  }, [selectedSupplier]);

  const pastCutoff = useMemo(() => {
    if (!selectedSupplier) return false;
    return isPastCutoff(selectedSupplier);
  }, [selectedSupplier]);

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.active !== false),
    [suppliers],
  );

  const openCreateModal = useCallback(() => {
    setSelectedSupplierId("");
    setPOReference("");
    setPONotes("");
    setLineItems([]);
    setCreateStep(1);
  }, []);

  const proceedToStep2 = useCallback(() => {
    const result = step1Schema.safeParse({
      supplierId: selectedSupplierId,
      reference: poReference,
      notes: poNotes,
    });
    if (!result.success) {
      toast.error("Please select a supplier");
      return;
    }
    if (!currentVenue) {
      toast.error("No venue selected");
      return;
    }

    // Generate suggestions
    const suggestions = calculateOrderSuggestions(
      selectedSupplierId,
      currentVenue.id,
      ingredients,
      purchaseOrders,
      suppliers,
    );

    const items: POLineItem[] = suggestions.map((s) => ({
      ingredientId: s.ingredientId,
      ingredientName: s.ingredientName,
      currentStock: s.currentStock,
      parLevel: s.parLevel,
      pendingQty: s.pendingQty,
      suggestedQty: s.suggestedQty,
      orderQty: s.suggestedQty,
      unit: s.unit,
      unitPrice: s.lastPrice,
      lineTotal: s.suggestedQty * s.lastPrice,
      productCode: s.productCode,
    }));

    setLineItems(items);
    setCreateStep(2);
  }, [
    selectedSupplierId,
    poReference,
    poNotes,
    currentVenue,
    ingredients,
    purchaseOrders,
    suppliers,
  ]);

  const updateLineItem = useCallback(
    (index: number, field: "orderQty" | "unitPrice", value: number) => {
      setLineItems((prev) => {
        const updated = [...prev];
        const item = { ...updated[index] };
        item[field] = value;
        item.lineTotal = item.orderQty * item.unitPrice;
        updated[index] = item;
        return updated;
      });
    },
    [],
  );

  const addBlankLine = useCallback(() => {
    setLineItems((prev) => [
      ...prev,
      {
        ingredientId: "",
        ingredientName: "",
        currentStock: 0,
        parLevel: 0,
        pendingQty: 0,
        suggestedQty: 0,
        orderQty: 0,
        unit: "ea",
        unitPrice: 0,
        lineTotal: 0,
      },
    ]);
  }, []);

  const removeLineItem = useCallback((index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const orderTotals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const gst = Math.round(subtotal * 0.1);
    return { subtotal, gst, total: subtotal + gst };
  }, [lineItems]);

  const handleSaveDraft = useCallback(async () => {
    if (!selectedSupplier || !currentVenue || !currentOrg) return;
    setIsSaving(true);
    try {
      await savePO("draft");
      toast.success("Purchase order saved as draft");
      setCreateStep(0);
    } catch {
      toast.error("Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  }, [selectedSupplier, currentVenue, currentOrg, lineItems, orderTotals]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmitPO = useCallback(async () => {
    if (!selectedSupplier || !currentVenue || !currentOrg) return;
    const validItems = lineItems.filter(
      (li) => li.orderQty > 0 && li.ingredientId,
    );
    if (validItems.length === 0) {
      toast.error("Add at least one item with quantity > 0");
      return;
    }
    setIsSaving(true);
    try {
      await savePO("submitted");
      toast.success("Purchase order submitted");
      setCreateStep(0);
    } catch {
      toast.error("Failed to submit order");
    } finally {
      setIsSaving(false);
    }
  }, [selectedSupplier, currentVenue, currentOrg, lineItems, orderTotals]); // eslint-disable-line react-hooks/exhaustive-deps

  const savePO = async (status: "draft" | "submitted") => {
    if (!selectedSupplier || !currentVenue || !currentOrg)
      throw new Error("Missing context");

    const validItems = lineItems.filter(
      (li) => li.orderQty > 0 && li.ingredientId,
    );
    const poNumber = generatePONumber(purchaseOrders);
    const delivery = expectedDelivery || new Date();

    const poId = crypto.randomUUID();
    const po: PurchaseOrder = {
      id: poId,
      po_number: poNumber,
      org_id: currentOrg.id,
      venue_id: currentVenue.id,
      supplier_id: selectedSupplier.id,
      supplier_name: selectedSupplier.name,
      order_date: new Date(),
      expected_delivery_date: delivery,
      status,
      subtotal: orderTotals.subtotal,
      tax_amount: orderTotals.gst,
      total: orderTotals.total,
      notes: [poReference, poNotes].filter(Boolean).join(" — ") || undefined,
      created_by: user?.id,
      created_by_name: user?.email || undefined,
      ...(status === "submitted"
        ? { submitted_at: new Date(), submitted_by: user?.id }
        : {}),
    };

    const items: PurchaseOrderItem[] = validItems.map((li) => ({
      id: crypto.randomUUID(),
      purchase_order_id: poId,
      ingredient_id: li.ingredientId,
      ingredient_name: li.ingredientName,
      quantity_ordered: li.orderQty,
      quantity_received: 0,
      unit: li.unit,
      unit_cost: li.unitPrice,
      line_total: li.lineTotal,
    }));

    await addPurchaseOrder(po, items);
  };

  // ─── Action handlers for list ──────────────────────────────────────────

  const handleSubmitExisting = useCallback(
    async (po: PurchaseOrder, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await updatePurchaseOrder(po.id, {
          status: "submitted",
          submitted_at: new Date(),
          submitted_by: user?.id,
        });
        toast.success(`${po.po_number} submitted`);
      } catch {
        toast.error("Failed to submit");
      }
    },
    [updatePurchaseOrder, user],
  );

  const handleDeletePO = useCallback(
    async (po: PurchaseOrder, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm(`Delete ${po.po_number}? This cannot be undone.`)) return;
      try {
        await deletePurchaseOrder(po.id);
        toast.success(`${po.po_number} deleted`);
      } catch {
        toast.error("Failed to delete");
      }
    },
    [deletePurchaseOrder],
  );

  // ─── Render: Step 2 (Full Page) ────────────────────────────────────────

  if (createStep === 2) {
    const minOrder = selectedSupplier?.minimum_order || 0;
    const belowMinOrder = minOrder > 0 && orderTotals.subtotal < minOrder;

    return (
      <PageShell
        toolbar={
          <PageToolbar
            title={`New PO — ${selectedSupplier?.name || "Unknown"}`}
            actions={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreateStep(1)}
                >
                  Back
                </Button>
                <Separator orientation="vertical" className="h-5" />
                {expectedDelivery && (
                  <Badge variant="outline">
                    Expected: {safeFormat(expectedDelivery, "EEE dd MMM")}
                  </Badge>
                )}
              </>
            }
          />
        }
      >
        <div className="p-4 space-y-4">
          {/* Min order warning */}
          {belowMinOrder && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Subtotal ({formatCurrency(orderTotals.subtotal)}) is below
                minimum order of {formatCurrency(minOrder)}
              </span>
            </div>
          )}

          {/* Line items table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Product</TableHead>
                  <TableHead className="text-right w-20">Stock</TableHead>
                  <TableHead className="text-right w-20">Par</TableHead>
                  <TableHead className="text-right w-20">Pending</TableHead>
                  <TableHead className="text-right w-20">Suggested</TableHead>
                  <TableHead className="text-right w-24">Order Qty</TableHead>
                  <TableHead className="w-16">Unit</TableHead>
                  <TableHead className="text-right w-28">Unit Price</TableHead>
                  <TableHead className="text-right w-24">Line Total</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item, idx) => (
                  <TableRow
                    key={item.ingredientId || `blank-${idx}`}
                    className={
                      item.currentStock <= item.parLevel * 0.25
                        ? "bg-red-50/50 dark:bg-red-950/20"
                        : item.suggestedQty > 0
                          ? "bg-amber-50/30 dark:bg-amber-950/10"
                          : ""
                    }
                  >
                    <TableCell>
                      <div>
                        <span className="font-medium">
                          {item.ingredientName || "—"}
                        </span>
                        {item.productCode && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({item.productCode})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          item.currentStock <= item.parLevel * 0.25
                            ? "text-red-600 font-semibold"
                            : item.currentStock <= item.parLevel * 0.5
                              ? "text-amber-600 font-semibold"
                              : ""
                        }
                      >
                        {item.currentStock}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.parLevel}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.pendingQty > 0 ? (
                        <Badge variant="outline" className="text-xs">
                          {item.pendingQty}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.suggestedQty}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        value={item.orderQty}
                        onChange={(e) =>
                          updateLineItem(
                            idx,
                            "orderQty",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="w-20 text-right h-8"
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {item.unit}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateLineItem(
                            idx,
                            "unitPrice",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="w-24 text-right h-8"
                      />
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(item.lineTotal)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeLineItem(idx)}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Button variant="outline" size="sm" onClick={addBlankLine}>
            <Plus className="h-4 w-4 mr-1" /> Add Item
          </Button>

          {/* Totals footer */}
          <Card className="p-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">
                    {formatCurrency(orderTotals.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GST (10%):</span>
                  <span className="font-medium">
                    {formatCurrency(orderTotals.gst)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>{formatCurrency(orderTotals.total)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setCreateStep(0)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Save Draft
            </Button>
            <Button onClick={handleSubmitPO} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit Order
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  // ─── Render: PO List ────────────────────────────────────────────────────

  const toolbar = (
    <PageToolbar
      title="Purchase Orders"
      filters={
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search PO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-[220px] pl-8 pr-3 text-sm border-border/60"
          />
        </div>
      }
      primaryAction={{
        label: "Create Order",
        icon: Plus,
        onClick: openCreateModal,
        variant: "primary",
      }}
    />
  );

  const renderStatusActions = (po: PurchaseOrder) => {
    switch (po.status) {
      case "draft":
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/inventory/purchase-orders/${po.id}`);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={(e) => handleDeletePO(po, e)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-blue-600 hover:text-blue-700"
              onClick={(e) => handleSubmitExisting(po, e)}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      case "submitted":
      case "confirmed":
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-green-600 hover:text-green-700"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/inventory/purchase-orders/${po.id}`);
              }}
            >
              <Package className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Receive</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/inventory/purchase-orders/${po.id}`);
              }}
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      case "delivered":
        return (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/inventory/purchase-orders/${po.id}`);
            }}
          >
            <ClipboardCheck className="h-3.5 w-3.5 mr-1" />
            <span className="text-xs">Reconcile</span>
          </Button>
        );
      default:
        return (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/inventory/purchase-orders/${po.id}`);
            }}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        );
    }
  };

  const renderTabBadge = (count: number) =>
    count > 0 ? (
      <Badge
        variant="secondary"
        className="ml-1.5 h-5 min-w-[20px] px-1.5 text-[10px]"
      >
        {count}
      </Badge>
    ) : null;

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-6 py-6 space-y-4">
        {/* Overdue alert */}
        {tabCounts.overdue > 0 && activeTab !== "overdue" && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800 dark:text-red-200">
                {tabCounts.overdue} purchase order
                {tabCounts.overdue !== 1 ? "s" : ""} overdue
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => setActiveTab("overdue")}
            >
              View Overdue
            </Button>
          </div>
        )}

        {/* Tab filters */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabKey)}
        >
          <TabsList>
            <TabsTrigger value="all">
              All{renderTabBadge(tabCounts.all)}
            </TabsTrigger>
            <TabsTrigger value="draft">
              Draft{renderTabBadge(tabCounts.draft)}
            </TabsTrigger>
            <TabsTrigger value="submitted">
              Submitted{renderTabBadge(tabCounts.submitted)}
            </TabsTrigger>
            <TabsTrigger value="overdue">
              Overdue{renderTabBadge(tabCounts.overdue)}
            </TabsTrigger>
            <TabsTrigger value="delivered">
              Delivered{renderTabBadge(tabCounts.delivered)}
            </TabsTrigger>
            <TabsTrigger value="closed">
              Closed{renderTabBadge(tabCounts.closed)}
            </TabsTrigger>
          </TabsList>

          {/* Single content for all tabs — filtering handled in useMemo */}
          <TabsContent value={activeTab} className="mt-4">
            {isLoading && purchaseOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
                <p className="text-muted-foreground">
                  Loading purchase orders...
                </p>
              </Card>
            ) : filteredPOs.length === 0 ? (
              <Card className="p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {purchaseOrders.length === 0
                    ? "No Purchase Orders Yet"
                    : "No Orders Found"}
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  {purchaseOrders.length === 0
                    ? "Create your first purchase order to get started"
                    : "Try adjusting your filters or search"}
                </p>
                {purchaseOrders.length === 0 && (
                  <Button onClick={openCreateModal}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Order
                  </Button>
                )}
              </Card>
            ) : (
              <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 dark:bg-slate-800/80">
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        PO #
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Supplier
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Order Date
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Expected Delivery
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Status
                      </TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Items
                      </TableHead>
                      <TableHead className="text-right text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Total
                      </TableHead>
                      <TableHead className="w-32 text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPOs.map((po) => {
                      const statusConfig =
                        STATUS_CONFIG[
                          po.status as keyof typeof STATUS_CONFIG
                        ] || STATUS_CONFIG.draft;
                      const StatusIcon = statusConfig.icon;
                      const overdue = isOverdue(po);
                      const daysOverdue = overdue
                        ? differenceInDays(
                            new Date(),
                            new Date(po.expected_delivery_date),
                          )
                        : 0;

                      return (
                        <TableRow
                          key={po.id}
                          className={`cursor-pointer hover:bg-muted/50 ${overdue ? "bg-red-50/50 dark:bg-red-950/30" : ""}`}
                          onClick={() =>
                            navigate(`/inventory/purchase-orders/${po.id}`)
                          }
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {po.po_number}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{po.supplier_name}</TableCell>
                          <TableCell>
                            {safeFormat(po.order_date, "dd MMM yyyy")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={
                                  overdue ? "text-red-600 font-semibold" : ""
                                }
                              >
                                {safeFormat(
                                  po.expected_delivery_date,
                                  "dd MMM yyyy",
                                )}
                              </span>
                              {overdue && (
                                <Badge
                                  variant="destructive"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {daysOverdue}d late
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusConfig.variant}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">
                              {po.items?.length || 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(po.total)}
                          </TableCell>
                          <TableCell>{renderStatusActions(po)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Create PO Step 1 Modal ──────────────────────────────────────── */}
      <Dialog
        open={createStep === 1}
        onOpenChange={(open) => !open && setCreateStep(0)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
            <DialogDescription>
              Select a supplier and set order details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Select
                value={selectedSupplierId}
                onValueChange={setSelectedSupplierId}
              >
                <SelectTrigger id="supplier">
                  <SelectValue placeholder="Select supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {activeSuppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex flex-col">
                        <span>{s.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDeliverySchedule(s)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Delivery info */}
            {selectedSupplier && (
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {formatDeliverySchedule(selectedSupplier)}
                  </span>
                </div>
                {expectedDelivery && (
                  <div className="flex items-center gap-2 text-sm">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Expected delivery:{" "}
                      <strong>
                        {safeFormat(expectedDelivery, "EEEE dd MMM yyyy")}
                      </strong>
                    </span>
                  </div>
                )}
                {pastCutoff && (
                  <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">
                      Past today&apos;s cutoff ({selectedSupplier.cutoff_time}).
                      Order will be processed next business day.
                    </span>
                  </div>
                )}
                {selectedSupplier.minimum_order &&
                  selectedSupplier.minimum_order > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Info className="h-4 w-4" />
                      <span>
                        Minimum order:{" "}
                        {formatCurrency(selectedSupplier.minimum_order)}
                      </span>
                    </div>
                  )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reference">Reference (optional)</Label>
              <Input
                id="reference"
                value={poReference}
                onChange={(e) => setPOReference(e.target.value)}
                placeholder="e.g., Weekly restock, Event catering"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={poNotes}
                onChange={(e) => setPONotes(e.target.value)}
                placeholder="Any special instructions..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateStep(0)}>
              Cancel
            </Button>
            <Button onClick={proceedToStep2} disabled={!selectedSupplierId}>
              Next: Build Order <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
