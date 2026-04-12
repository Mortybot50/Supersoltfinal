import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ShoppingCart, AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useDataStore } from "@/lib/store/dataStore";
import { useAuth } from "@/contexts/AuthContext";
import {
  getNextDeliveryDate,
  calculateRecommendedQuantity,
  determineUrgency,
  generatePONumber,
  calculateGST,
} from "@/lib/utils/orderCalculations";
import { format, differenceInDays, subDays, isAfter } from "date-fns";
import { toast } from "sonner";
import type {
  OrderRecommendation,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
} from "@/types";
import { PageShell, PageToolbar } from "@/components/shared";
import { StatCards } from "@/components/ui/StatCards";
import { SecondaryStats } from "@/components/ui/SecondaryStats";

function getDaysOfStock(currentStock: number, dailyUsage: number): number {
  if (dailyUsage <= 0) return 999;
  return Math.round(currentStock / dailyUsage);
}

function getDaysOfStockColor(days: number): string {
  if (days < 2) return "text-red-600 font-semibold";
  if (days <= 4) return "text-amber-600 font-semibold";
  return "text-green-600";
}

function getDaysOfStockBadge(days: number) {
  if (days >= 999) return <Badge variant="secondary">No Usage</Badge>;
  if (days < 2) return <Badge variant="destructive">{days}d</Badge>;
  if (days <= 4) return <Badge className="bg-amber-500">{days}d</Badge>;
  return <Badge className="bg-green-600">{days}d</Badge>;
}

export default function OrderGuide() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightIngredientId = searchParams.get("ingredient");
  const { currentVenue, currentOrg, user, profile } = useAuth();
  const {
    suppliers,
    ingredients,
    purchaseOrders,
    orders,
    wasteLogs,
    loadSuppliersFromDB,
    loadIngredientsFromDB,
    loadPurchaseOrdersFromDB,
    loadWasteLogsFromDB,
  } = useDataStore();

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set(),
  );
  const [customQuantities, setCustomQuantities] = useState<
    Record<string, number>
  >({});

  // Load data from Supabase on mount
  useEffect(() => {
    loadSuppliersFromDB();
    loadIngredientsFromDB();
    loadPurchaseOrdersFromDB();
    loadWasteLogsFromDB();
  }, [
    loadSuppliersFromDB,
    loadIngredientsFromDB,
    loadPurchaseOrdersFromDB,
    loadWasteLogsFromDB,
  ]);

  // Auto-select supplier when arriving via deep link from a below-par alert
  useEffect(() => {
    if (!highlightIngredientId || !ingredients.length || !suppliers.length)
      return;
    const ing = ingredients.find((i) => i.id === highlightIngredientId);
    if (ing?.supplier_id && !selectedSupplierId) {
      setSelectedSupplierId(ing.supplier_id);
    }
  }, [highlightIngredientId, ingredients, suppliers, selectedSupplierId]);

  // Compute 30-day waste-based daily usage per ingredient
  const wasteUsageMap = useMemo(() => {
    const thirtyDaysAgo = subDays(new Date(), 30);
    const map: Record<string, number> = {};
    for (const w of wasteLogs) {
      if (!isAfter(new Date(w.waste_date as unknown as string), thirtyDaysAgo))
        continue;
      map[w.ingredient_id] = (map[w.ingredient_id] || 0) + w.quantity;
    }
    // Convert 30-day total to daily average
    for (const id of Object.keys(map)) {
      map[id] = map[id] / 30;
    }
    return map;
  }, [wasteLogs]);

  // Compute 30-day received qty per ingredient from delivered POs
  const receivedUsageMap = useMemo(() => {
    const thirtyDaysAgo = subDays(new Date(), 30);
    const map: Record<string, number> = {};
    for (const po of purchaseOrders) {
      if (po.status !== "delivered" || !po.delivered_at) continue;
      if (
        !isAfter(new Date(po.delivered_at as unknown as string), thirtyDaysAgo)
      )
        continue;
      for (const item of po.items || []) {
        if (!item.ingredient_id) continue;
        map[item.ingredient_id] =
          (map[item.ingredient_id] || 0) + (item.quantity_received || 0);
      }
    }
    for (const id of Object.keys(map)) {
      map[id] = map[id] / 30;
    }
    return map;
  }, [purchaseOrders]);

  // Best daily usage estimate: prioritise received qty (throughput), fall back to waste, then default 0.71 (5/week)
  const getDailyUsage = (ingredientId: string): number => {
    const received = receivedUsageMap[ingredientId];
    if (received && received > 0) return received;
    const waste = wasteUsageMap[ingredientId];
    if (waste && waste > 0) return waste;
    return 5 / 7; // default ~0.71/day
  };

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  // Calculate sales forecast for next 7 days
  const salesForecast = useMemo(() => {
    const thirtyDaysAgo = subDays(new Date(), 30);
    const recentSales = orders
      .filter(
        (o) =>
          new Date(o.order_datetime) >= thirtyDaysAgo &&
          !o.is_void &&
          !o.is_refund,
      )
      .reduce((sum, o) => sum + o.gross_amount / 100, 0);
    const dailyAverage = recentSales / 30;
    return dailyAverage * 7;
  }, [orders]);

  // Get supplier products and calculate recommendations
  const orderRecommendations = useMemo(() => {
    if (!selectedSupplier) return [];

    const supplierProducts = ingredients.filter(
      (p) => p.supplier_id === selectedSupplierId && p.active,
    );

    const nextDelivery = getNextDeliveryDate(selectedSupplier);
    const daysUntilDelivery = differenceInDays(nextDelivery, new Date());

    return supplierProducts
      .map((product): OrderRecommendation => {
        const dailyUsage = getDailyUsage(product.id);
        // estimatedUsage = daily usage × days until next delivery (cover-up period)
        const coverDays = Math.max(daysUntilDelivery, 1);
        const estimatedUsage = dailyUsage * coverDays;
        const safetyStock = product.reorder_point || product.par_level * 0.3;

        const recommended = calculateRecommendedQuantity(
          product.current_stock,
          product.par_level,
          estimatedUsage,
          daysUntilDelivery,
        );
        const urgency = determineUrgency(
          product.current_stock,
          product.par_level,
          safetyStock,
          estimatedUsage,
          daysUntilDelivery,
        );

        return {
          product,
          current_stock: product.current_stock,
          par_level: product.par_level,
          usage_per_thousand_sales: dailyUsage * 7, // weekly usage for display
          forecasted_sales: salesForecast,
          estimated_usage: estimatedUsage,
          days_until_delivery: daysUntilDelivery,
          recommended_quantity: recommended,
          estimated_cost: recommended * product.cost_per_unit,
          urgency,
        };
      })
      .sort((a, b) => {
        const urgencyOrder = {
          critical: 0,
          low: 1,
          adequate: 2,
          overstocked: 3,
        };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedSupplier,
    selectedSupplierId,
    ingredients,
    salesForecast,
    wasteUsageMap,
    receivedUsageMap,
  ]);

  const handleToggleProduct = (productId: string) => {
    setSelectedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const needsOrder = orderRecommendations.filter(
      (r) => r.urgency === "critical" || r.urgency === "low",
    );
    if (needsOrder.length > 0) {
      setSelectedProducts(new Set(needsOrder.map((r) => r.product.id)));
    } else {
      setSelectedProducts(
        new Set(orderRecommendations.map((r) => r.product.id)),
      );
    }
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    setCustomQuantities((prev) => ({
      ...prev,
      [productId]: quantity,
    }));
  };

  const getOrderQuantity = (recommendation: OrderRecommendation) => {
    return (
      customQuantities[recommendation.product.id] ??
      recommendation.recommended_quantity
    );
  };

  const createPOForSupplier = async (
    supplier: Supplier,
    recommendations: OrderRecommendation[],
    productIds: Set<string>,
  ) => {
    const items: PurchaseOrderItem[] = [];

    productIds.forEach((productId) => {
      const recommendation = recommendations.find(
        (r) => r.product.id === productId,
      );
      if (!recommendation) return;

      const quantity = getOrderQuantity(recommendation);
      if (quantity <= 0) return;

      items.push({
        id: crypto.randomUUID(),
        purchase_order_id: "",
        ingredient_id: recommendation.product.id,
        ingredient_name: recommendation.product.name,
        product_code: recommendation.product.product_code,
        quantity_ordered: quantity,
        quantity_received: 0,
        unit: recommendation.product.unit,
        unit_cost: recommendation.product.cost_per_unit,
        line_total: quantity * recommendation.product.cost_per_unit,
      });
    });

    if (items.length === 0) return null;

    const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
    const taxAmount = items.reduce(
      (sum, item) => sum + calculateGST(item.line_total, true),
      0,
    );
    const total = subtotal + taxAmount;

    const poId = crypto.randomUUID();
    const po: PurchaseOrder = {
      id: poId,
      po_number: generatePONumber(purchaseOrders),
      org_id: currentOrg?.id || undefined,
      venue_id: currentVenue?.id || "",
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      order_date: new Date(),
      expected_delivery_date: getNextDeliveryDate(supplier),
      status: "draft",
      subtotal,
      tax_amount: taxAmount,
      total,
      notes: "",
      created_by: user?.id || "",
      created_by_name: profile
        ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
          "Manager"
        : "Manager",
      created_at: new Date(),
      updated_at: new Date(),
    };

    items.forEach((item) => {
      item.purchase_order_id = poId;
    });

    const { addPurchaseOrder } = useDataStore.getState();
    await addPurchaseOrder(po, items);
    return po;
  };

  const handleCreateOrder = async () => {
    if (!selectedSupplier) return;

    if (!currentVenue?.id || currentVenue.id === "all") {
      toast.error("Select a specific venue before creating a purchase order");
      return;
    }

    if (selectedProducts.size === 0) {
      toast.error("Select at least one product");
      return;
    }

    try {
      const po = await createPOForSupplier(
        selectedSupplier,
        orderRecommendations,
        selectedProducts,
      );
      if (po) {
        toast.success(`Purchase order ${po.po_number} created`);
        setSelectedProducts(new Set());
        setCustomQuantities({});
      }
    } catch (error) {
      toast.error(
        `Failed to create purchase order: ${error?.message || error}`,
      );
      console.error(error);
    }
  };

  // Generate All Orders — creates POs for all suppliers with critical/low items
  const handleGenerateAllOrders = async () => {
    if (!currentVenue?.id || currentVenue.id === "all") {
      toast.error("Select a specific venue before generating purchase orders");
      return;
    }
    const activeSuppliers = suppliers.filter((s) => s.active);
    let ordersCreated = 0;

    for (const supplier of activeSuppliers) {
      const supplierProducts = ingredients.filter(
        (p) => p.supplier_id === supplier.id && p.active,
      );
      if (supplierProducts.length === 0) continue;

      const nextDelivery = getNextDeliveryDate(supplier);
      const daysUntilDelivery = differenceInDays(nextDelivery, new Date());

      const recommendations: OrderRecommendation[] = supplierProducts.map(
        (product) => {
          const dailyUsage = getDailyUsage(product.id);
          const coverDays = Math.max(daysUntilDelivery, 1);
          const estimatedUsage = dailyUsage * coverDays;
          const recommended = calculateRecommendedQuantity(
            product.current_stock,
            product.par_level,
            estimatedUsage,
            daysUntilDelivery,
          );
          const urgency = determineUrgency(
            product.current_stock,
            product.par_level,
            product.reorder_point || product.par_level * 0.3,
            estimatedUsage,
            daysUntilDelivery,
          );

          return {
            product,
            current_stock: product.current_stock,
            par_level: product.par_level,
            usage_per_thousand_sales: dailyUsage * 7,
            forecasted_sales: salesForecast,
            estimated_usage: estimatedUsage,
            days_until_delivery: daysUntilDelivery,
            recommended_quantity: recommended,
            estimated_cost: recommended * product.cost_per_unit,
            urgency,
          };
        },
      );

      // Only create PO if there are critical or low stock items
      const needsOrder = recommendations.filter(
        (r) => r.urgency === "critical" || r.urgency === "low",
      );
      if (needsOrder.length === 0) continue;

      const productIds = new Set(needsOrder.map((r) => r.product.id));
      try {
        const po = await createPOForSupplier(
          supplier,
          recommendations,
          productIds,
        );
        if (po) ordersCreated++;
      } catch (error) {
        console.error(`Failed to create PO for ${supplier.name}:`, error);
      }
    }

    if (ordersCreated > 0) {
      toast.success(
        `${ordersCreated} purchase order${ordersCreated !== 1 ? "s" : ""} generated`,
        {
          action: {
            label: "View Orders",
            onClick: () => navigate("/inventory/purchase-orders"),
          },
        },
      );
    } else {
      toast.info("No suppliers need orders — all stock levels are adequate");
    }
  };

  const totalOrderValue = useMemo(() => {
    let sum = 0;
    selectedProducts.forEach((productId) => {
      const recommendation = orderRecommendations.find(
        (r) => r.product.id === productId,
      );
      if (!recommendation) return;

      const quantity = getOrderQuantity(recommendation);
      sum += quantity * recommendation.product.cost_per_unit;
    });
    return sum;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProducts, orderRecommendations, customQuantities]); // getOrderQuantity only reads customQuantities (already listed)

  // Stats across all suppliers
  const globalStats = useMemo(() => {
    let criticalCount = 0;
    let lowCount = 0;
    for (const supplier of suppliers.filter((s) => s.active)) {
      const supplierProducts = ingredients.filter(
        (p) => p.supplier_id === supplier.id && p.active,
      );
      for (const product of supplierProducts) {
        const dailyUsage = getDailyUsage(product.id);
        const days = getDaysOfStock(product.current_stock, dailyUsage);
        if (days < 2) criticalCount++;
        else if (days <= 4) lowCount++;
      }
    }
    return { criticalCount, lowCount };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppliers, ingredients, wasteUsageMap, receivedUsageMap]);

  // Per-supplier ordering status for the overview panel
  const supplierOrderStatus = useMemo(() => {
    return suppliers
      .filter((s) => s.active)
      .map((supplier) => {
        const supplierProducts = ingredients.filter(
          (p) => p.supplier_id === supplier.id && p.active,
        );
        const nextDelivery = getNextDeliveryDate(supplier);
        const daysUntilDelivery = differenceInDays(nextDelivery, new Date());

        const itemStatuses = supplierProducts.map((product) => {
          const dailyUsage = getDailyUsage(product.id);
          const days = getDaysOfStock(product.current_stock, dailyUsage);
          return {
            product,
            daysOfStock: days,
            urgency: days < 2 ? "critical" : days <= 4 ? "low" : "adequate",
          };
        });

        return {
          supplier,
          nextDelivery,
          daysUntilDelivery,
          criticalItems: itemStatuses.filter((s) => s.urgency === "critical"),
          lowItems: itemStatuses.filter((s) => s.urgency === "low"),
          totalProducts: supplierProducts.length,
        };
      })
      .filter((s) => s.totalProducts > 0)
      .sort((a, b) => {
        if (a.criticalItems.length !== b.criticalItems.length)
          return b.criticalItems.length - a.criticalItems.length;
        if (a.lowItems.length !== b.lowItems.length)
          return b.lowItems.length - a.lowItems.length;
        return a.daysUntilDelivery - b.daysUntilDelivery;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppliers, ingredients, wasteUsageMap, receivedUsageMap]);

  const urgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "low":
        return <Badge className="bg-amber-500">Low Stock</Badge>;
      case "adequate":
        return <Badge variant="default">Adequate</Badge>;
      case "overstocked":
        return <Badge variant="secondary">Overstocked</Badge>;
    }
  };

  const sidebarMetrics = selectedSupplier
    ? [
        { label: "Products", value: orderRecommendations.length },
        { label: "Selected", value: selectedProducts.size },
        ...(totalOrderValue > 0
          ? [
              {
                label: "Order Total",
                value: `$${(totalOrderValue / 100).toFixed(2)}`,
              },
            ]
          : []),
      ]
    : [
        { label: "Suppliers", value: suppliers.filter((s) => s.active).length },
        ...(globalStats.criticalCount > 0
          ? [{ label: "Critical", value: globalStats.criticalCount }]
          : []),
        ...(globalStats.lowCount > 0
          ? [{ label: "Low Stock", value: globalStats.lowCount }]
          : []),
      ];

  const sidebarExtended = selectedSupplier
    ? [
        {
          label: "Next Delivery",
          value: format(getNextDeliveryDate(selectedSupplier), "EEE, dd MMM"),
        },
        ...(salesForecast > 0
          ? [{ label: "Forecast (7d)", value: `$${salesForecast.toFixed(0)}` }]
          : []),
      ]
    : undefined;

  const toolbar = (
    <PageToolbar
      title="Order Guide"
      filters={
        <div className="flex items-center gap-2">
          <Select
            value={selectedSupplierId}
            onValueChange={setSelectedSupplierId}
          >
            <SelectTrigger className="h-8 w-[200px]">
              <SelectValue placeholder="Select supplier..." />
            </SelectTrigger>
            <SelectContent>
              {suppliers
                .filter((s) => s.active)
                .map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {!selectedSupplier &&
            (globalStats.criticalCount > 0 || globalStats.lowCount > 0) && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handleGenerateAllOrders}
              >
                <Zap className="h-3.5 w-3.5 mr-1" />
                Generate All Orders
              </Button>
            )}
        </div>
      }
      primaryAction={
        selectedProducts.size > 0
          ? {
              label: "Create PO",
              icon: ShoppingCart,
              onClick: handleCreateOrder,
              variant: "primary",
            }
          : undefined
      }
    />
  );

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-6 pt-6 pb-2 space-y-3">
        <StatCards stats={sidebarMetrics} columns={3} />
        {sidebarExtended && sidebarExtended.length > 0 && (
          <SecondaryStats stats={sidebarExtended} />
        )}
      </div>
      <div className="px-6 pb-6 space-y-6">
        {/* Products Table */}
        {selectedSupplier && orderRecommendations.length > 0 && (
          <>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Products</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    Select Low/Critical
                  </Button>
                  <Badge variant="outline">
                    {selectedProducts.size} selected
                  </Badge>
                  {totalOrderValue > 0 && (
                    <Badge>Total: ${(totalOrderValue / 100).toFixed(2)}</Badge>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 dark:bg-slate-800/80">
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Product
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Current Stock
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Par Level
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Days of Stock
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Usage/week (30d avg)
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Recommended
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Order Qty
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Cost
                      </TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderRecommendations.map((rec) => {
                      const orderQty = getOrderQuantity(rec);
                      const isSelected = selectedProducts.has(rec.product.id);
                      const isHighlighted =
                        rec.product.id === highlightIngredientId;
                      const dailyUsage = rec.estimated_usage / 7;
                      const daysOfStock = getDaysOfStock(
                        rec.current_stock,
                        dailyUsage,
                      );
                      const daysColor = getDaysOfStockColor(daysOfStock);

                      return (
                        <TableRow
                          key={rec.product.id}
                          className={`${isHighlighted ? "ring-2 ring-inset ring-orange-400 bg-orange-50/60 dark:bg-orange-950/20" : isSelected ? "bg-blue-50 dark:bg-blue-950" : ""} ${
                            !isHighlighted && daysOfStock < 2
                              ? "bg-red-50/30 dark:bg-red-950/20"
                              : ""
                          }`}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() =>
                                handleToggleProduct(rec.product.id)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{rec.product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {rec.product.unit} | $
                                {(rec.product.cost_per_unit / 100).toFixed(2)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                rec.current_stock <
                                (rec.product.reorder_point ||
                                  rec.product.par_level * 0.5)
                                  ? "text-red-600 font-semibold"
                                  : ""
                              }
                            >
                              {rec.current_stock} {rec.product.unit}
                            </span>
                          </TableCell>
                          <TableCell>
                            {rec.par_level} {rec.product.unit}
                          </TableCell>
                          <TableCell>
                            <span className={daysColor}>
                              {daysOfStock >= 999 ? "—" : `${daysOfStock} days`}
                            </span>
                          </TableCell>
                          <TableCell>
                            {rec.estimated_usage.toFixed(1)} {rec.product.unit}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-blue-600">
                              {rec.recommended_quantity} {rec.product.unit}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={orderQty}
                              onChange={(e) =>
                                handleQuantityChange(
                                  rec.product.id,
                                  parseInt(e.target.value) || 0,
                                )
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            $
                            {(
                              (orderQty * rec.product.cost_per_unit) /
                              100
                            ).toFixed(2)}
                          </TableCell>
                          <TableCell>{urgencyBadge(rec.urgency)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {selectedProducts.size > 0 && (
              <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      Order Summary
                    </h3>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="text-muted-foreground">Items:</span>{" "}
                        <span className="font-semibold">
                          {selectedProducts.size}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Subtotal:</span>{" "}
                        <span className="font-semibold">
                          ${(totalOrderValue / 100).toFixed(2)}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">
                          GST (10%):
                        </span>{" "}
                        <span className="font-semibold">
                          $
                          {(calculateGST(totalOrderValue, true) / 100).toFixed(
                            2,
                          )}
                        </span>
                      </p>
                      <p className="text-lg">
                        <span className="text-muted-foreground">Total:</span>{" "}
                        <span className="font-bold">
                          $
                          {(
                            (totalOrderValue +
                              calculateGST(totalOrderValue, true)) /
                            100
                          ).toFixed(2)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <Button size="lg" onClick={handleCreateOrder}>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Create Purchase Order
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}

        {selectedSupplier && orderRecommendations.length === 0 && (
          <Card className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Products Found</h3>
            <p className="text-sm text-muted-foreground">
              This supplier has no active products. Add products to this
              supplier in the Ingredients page.
            </p>
          </Card>
        )}

        {!selectedSupplier && (
          <>
            {suppliers.length === 0 ? (
              <Card className="p-12 text-center">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Suppliers Yet</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Add suppliers to start managing your ordering.
                </p>
                <Button onClick={() => navigate("/suppliers")}>
                  Add Suppliers
                </Button>
              </Card>
            ) : supplierOrderStatus.length === 0 ? (
              <Card className="p-12 text-center">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  Select a Supplier
                </h3>
                <p className="text-sm text-muted-foreground">
                  Choose a supplier above to see their products and ordering
                  recommendations.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Select a supplier to view their order guide, or use{" "}
                  <strong>Generate All Orders</strong> to auto-create POs for
                  all low-stock items.
                </p>
                {supplierOrderStatus.map(
                  ({
                    supplier,
                    nextDelivery,
                    daysUntilDelivery,
                    criticalItems,
                    lowItems,
                    totalProducts,
                  }) => {
                    const hasUrgent =
                      criticalItems.length > 0 || lowItems.length > 0;
                    return (
                      <Card
                        key={supplier.id}
                        className={`cursor-pointer hover:shadow-md transition-shadow ${hasUrgent ? "border-amber-200" : ""}`}
                        onClick={() => setSelectedSupplierId(supplier.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold">{supplier.name}</p>
                                {criticalItems.length > 0 && (
                                  <Badge
                                    variant="destructive"
                                    className="text-xs"
                                  >
                                    {criticalItems.length} critical
                                  </Badge>
                                )}
                                {lowItems.length > 0 && (
                                  <Badge className="bg-amber-500 text-xs">
                                    {lowItems.length} low
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {totalProducts} product
                                {totalProducts !== 1 ? "s" : ""} · Next
                                delivery:{" "}
                                <span
                                  className={
                                    daysUntilDelivery <= 1
                                      ? "text-amber-600 font-medium"
                                      : ""
                                  }
                                >
                                  {format(nextDelivery, "EEE dd MMM")}
                                  {daysUntilDelivery === 0
                                    ? " (today)"
                                    : daysUntilDelivery === 1
                                      ? " (tomorrow)"
                                      : ` (${daysUntilDelivery}d)`}
                                </span>
                              </p>
                              {(criticalItems.length > 0 ||
                                lowItems.length > 0) && (
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {[...criticalItems, ...lowItems]
                                    .slice(0, 4)
                                    .map((s) => s.product.name)
                                    .join(", ")}
                                  {criticalItems.length + lowItems.length > 4 &&
                                    ` +${criticalItems.length + lowItems.length - 4} more`}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                            >
                              View
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  },
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
