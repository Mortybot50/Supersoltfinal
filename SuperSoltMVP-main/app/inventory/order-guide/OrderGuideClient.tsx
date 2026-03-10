"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import { buildSupplierText, buildAllSuppliersText } from "@/lib/share/copy";
import {
  Download,
  Copy,
  RefreshCw,
  AlertCircle,
  Mail,
  CheckSquare,
  Square,
  ShoppingCart,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type OrderGuideLine = {
  ingredientId: string;
  ingredientName: string;
  baseUnit: string;
  requiredUnits: number;
  onHandUnits: number;
  shortfallUnits: number;
  supplierId?: string;
  supplierName?: string;
  packSize?: number;
  packUnit?: string;
  unitPrice?: number;
  packsRecommended: number;
  estCost: number;
  notes: string[];
  packSizeLabel?: string;
  unitCost?: number;
};

type OrderGuideGroup = {
  supplierId?: string;
  supplierName: string;
  lines: OrderGuideLine[];
  groupCost: number;
};

type OrderGuideData = {
  window: {
    startISO: string;
    endISO: string;
    days: number;
    safetyDays: number;
  };
  groups: OrderGuideGroup[];
  totals: {
    items: number;
    cost: number;
  };
};

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(cents / 100);
};

const formatCurrencyDollars = (dollars: number) => {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(dollars);
};

export function OrderGuideClient() {
  const { toast } = useToast();
  const router = useRouter();
  
  // Toolbar state
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [days, setDays] = useState(7);
  const [safetyDays, setSafetyDays] = useState(1);
  const [ceilRounding, setCeilRounding] = useState(true);
  
  // Local state for edited packs
  const [editedPacks, setEditedPacks] = useState<
    Record<string, number>
  >({});
  
  // Mark as ordered state (UI only)
  const [markedOrdered, setMarkedOrdered] = useState<Record<string, boolean>>({});

  // Fetch order guide data
  const { data, isLoading, refetch, error } = useQuery<OrderGuideData>({
    queryKey: ["/api/inventory/order-guide", startDate, days, safetyDays],
    queryFn: async ({ queryKey }) => {
      const [, start, daysParam, safetyDaysParam] = queryKey;
      const params = new URLSearchParams({
        start: String(start),
        days: String(daysParam),
        safetyDays: String(safetyDaysParam),
      });
      const res = await fetch(`/api/inventory/order-guide?${params}`);
      if (!res.ok) throw new Error("Failed to fetch order guide");
      return res.json();
    },
  });

  // Track page view
  useMemo(() => {
    if (data) {
      track("order_guide_viewed", {
        start: startDate,
        days,
        safetyDays,
      });
    }
  }, [data, startDate, days, safetyDays]);

  const handleEditPacks = (
    ingredientId: string,
    supplierId: string | undefined,
    value: string
  ) => {
    const key = `${ingredientId}-${supplierId || "none"}`;
    const numValue = parseFloat(value) || 0;
    const roundedValue = ceilRounding ? Math.ceil(numValue) : numValue;
    
    const oldValue = editedPacks[key];
    setEditedPacks((prev) => ({ ...prev, [key]: roundedValue }));
    
    if (oldValue !== roundedValue) {
      track("order_guide_edit_packs", {
        ingredientId,
        from: oldValue || 0,
        to: roundedValue,
      });
    }
  };

  const getEffectivePacks = (line: OrderGuideLine): number => {
    const key = `${line.ingredientId}-${line.supplierId || "none"}`;
    return editedPacks[key] ?? line.packsRecommended;
  };

  const getLineTotal = (line: OrderGuideLine): number => {
    const packs = getEffectivePacks(line);
    return packs * (line.unitPrice || 0);
  };

  const getGroupSubtotal = (group: OrderGuideGroup): number => {
    return group.lines.reduce((sum, line) => sum + getLineTotal(line), 0);
  };

  const getPageTotal = (): number => {
    if (!data) return 0;
    return data.groups.reduce((sum, group) => sum + getGroupSubtotal(group), 0);
  };

  const getPageItemCount = (): number => {
    if (!data) return 0;
    return data.groups.reduce((sum, group) => sum + group.lines.length, 0);
  };

  const handleCopySupplier = (group: OrderGuideGroup) => {
    const lines = group.lines.map((line) => ({
      ingredient: line.ingredientName,
      packSizeLabel: line.packSizeLabel,
      packs: getEffectivePacks(line),
      notes: line.notes.length > 0 ? line.notes.join(", ") : undefined,
    }));
    
    const text = buildSupplierText(group.supplierName, lines);
    navigator.clipboard.writeText(text);
    
    toast({
      title: "Copied to clipboard",
      description: `Order for ${group.supplierName}`,
    });
    
    track("order_guide_copy_supplier", {
      supplier: group.supplierName,
      items: lines.length,
      subtotal: getGroupSubtotal(group),
    });
  };

  const handleCopyAll = () => {
    if (!data) return;
    
    const groups = data.groups.map((group) => ({
      supplier: group.supplierName,
      lines: group.lines.map((line) => ({
        ingredient: line.ingredientName,
        packSizeLabel: line.packSizeLabel,
        packs: getEffectivePacks(line),
        notes: line.notes.length > 0 ? line.notes.join(", ") : undefined,
      })),
    }));
    
    const text = buildAllSuppliersText(groups);
    navigator.clipboard.writeText(text);
    
    toast({
      title: "Copied to clipboard",
      description: `All supplier orders (${groups.length} suppliers)`,
    });
    
    track("order_guide_copy_all", {
      suppliers: groups.length,
      items: getPageItemCount(),
      subtotal: getPageTotal(),
    });
  };

  const handleExportCSV = () => {
    if (!data) return;
    
    try {
      // Generate CSV with client-edited pack values
      const rows: string[] = [];
      rows.push([
        "Supplier",
        "Ingredient",
        "Required (base)",
        "On hand",
        "Shortfall (base)",
        "Pack size",
        "Pack unit",
        "Packs",
        "Unit price",
        "Est. cost",
      ].join(","));
      
      for (const group of data.groups) {
        for (const line of group.lines) {
          const packs = getEffectivePacks(line);
          const cost = getLineTotal(line);
          rows.push([
            group.supplierName,
            line.ingredientName,
            line.requiredUnits,
            line.onHandUnits,
            line.shortfallUnits,
            line.packSize ?? "",
            line.packUnit ?? "",
            packs,
            line.unitPrice ?? "",
            cost.toFixed(2),
          ].join(","));
        }
      }
      
      const csv = rows.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `order-guide-${startDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export complete",
        description: "Order guide CSV downloaded",
      });
      
      track("order_guide_export_csv", {
        items: getPageItemCount(),
        subtotal: getPageTotal(),
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Could not download CSV",
        variant: "destructive",
      });
    }
  };

  const handleEmailSupplier = (group: OrderGuideGroup) => {
    const lines = group.lines.map((line) => ({
      ingredient: line.ingredientName,
      packSizeLabel: line.packSizeLabel,
      packs: getEffectivePacks(line),
      notes: line.notes.length > 0 ? line.notes.join(", ") : undefined,
    }));
    
    const body = buildSupplierText(group.supplierName, lines);
    const subject = `Order Request - ${new Date(startDate).toLocaleDateString()}`;
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  const toggleMarkedOrdered = (supplierId: string | undefined) => {
    const key = supplierId || "none";
    setMarkedOrdered((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Create POs mutation
  const createPosMutation = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error("No data available");

      // Build overrides from current state (edited packs + server data)
      const overrides = data.groups.flatMap((group) =>
        group.lines.map((line) => ({
          ingredientId: line.ingredientId,
          supplierId: group.supplierId || null,
          recommendedPacks: getEffectivePacks(line),
          packCostCents: line.unitCost
            ? Math.round(line.unitCost * (line.packSize || 1))
            : 0,
          packLabel: line.packSizeLabel,
          baseUom: line.baseUnit,
          baseQtyPerPack: line.packSize || 1,
        }))
      );

      const res = await apiRequest("POST", "/api/purchases/create-from-order-guide", {
        start: startDate,
        days,
        safetyDays,
        overrides,
      });
      return res.json();
    },
    onSuccess: (result: any) => {
      const posCount = result.pos?.length || 0;
      const totalCents =
        result.pos?.reduce((sum: number, po: any) => sum + po.totals.totalCents, 0) || 0;

      track("po_created_from_order_guide", {
        count: posCount,
        totalCents,
      });

      // Invalidate purchases list cache
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"], exact: false });

      toast({
        title: `Created ${posCount} purchase order(s)`,
        description: `Total: ${formatCurrency(totalCents / 100)}`,
      });

      // Navigate to purchases list
      router.push("/inventory/purchases");
    },
    onError: () => {
      toast({
        title: "Failed to create purchase orders",
        variant: "destructive",
      });
    },
  });

  const handleCreatePOs = () => {
    if (!data || data.groups.length === 0) {
      toast({
        title: "No items to order",
        description: "The order guide has no items that need ordering.",
        variant: "destructive",
      });
      return;
    }

    createPosMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load order guide. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <Card>
        <CardHeader>
          <CardTitle>Order Guide Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="days">Days</Label>
              <Input
                id="days"
                type="number"
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value) || 7)}
                min={1}
                max={90}
                data-testid="input-days"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="safety-days">Safety Days</Label>
              <Input
                id="safety-days"
                type="number"
                value={safetyDays}
                onChange={(e) => setSafetyDays(parseInt(e.target.value) || 0)}
                min={0}
                max={30}
                data-testid="input-safety-days"
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => refetch()}
                variant="outline"
                data-testid="button-refresh"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <div className="flex items-center gap-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={ceilRounding}
                        onCheckedChange={setCeilRounding}
                        data-testid="switch-ceil-rounding"
                      />
                      <Label>Ceil Rounding</Label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Round pack quantities up to avoid stockouts</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <p className="text-sm text-muted-foreground">
                Safety buffer: {safetyDays} day(s) included
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={handleCreatePOs}
                disabled={createPosMutation.isPending || !data || data.groups.length === 0}
                data-testid="button-create-pos"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Create POs
              </Button>
              <Button
                onClick={handleCopyAll}
                variant="outline"
                data-testid="button-copy-all"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy All
              </Button>
              <Button
                onClick={handleExportCSV}
                variant="outline"
                data-testid="button-export-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supplier Sections */}
      {data.groups.length === 0 ? (
        <Alert>
          <AlertDescription>
            No items needed for this period. Stock levels are sufficient.
          </AlertDescription>
        </Alert>
      ) : (
        data.groups.map((group) => {
          const isMarked = markedOrdered[group.supplierId || "none"];
          
          return (
            <Card key={group.supplierId || "none"} className={isMarked ? "opacity-60" : ""}>
              <CardHeader className="sticky top-0 bg-card z-20 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleMarkedOrdered(group.supplierId)}
                      className="hover-elevate active-elevate-2 rounded p-1"
                      data-testid={`checkbox-mark-ordered-${group.supplierId || "none"}`}
                    >
                      {isMarked ? (
                        <CheckSquare className="h-5 w-5 text-primary" />
                      ) : (
                        <Square className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <div>
                      <CardTitle className="text-lg sm:text-xl">{group.supplierName}</CardTitle>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        {group.lines.length} items • {formatCurrencyDollars(getGroupSubtotal(group))}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-auto sm:ml-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEmailSupplier(group)}
                      data-testid={`button-email-${group.supplierId || "none"}`}
                    >
                      <Mail className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Email</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopySupplier(group)}
                      data-testid={`button-copy-supplier-${group.supplierId || "none"}`}
                    >
                      <Copy className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Copy</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingredient</TableHead>
                        <TableHead>Pack Size</TableHead>
                        <TableHead className="text-right">On Hand</TableHead>
                        <TableHead className="text-right">Required</TableHead>
                        <TableHead className="text-right">Shortfall</TableHead>
                        <TableHead className="text-right">Packs</TableHead>
                        <TableHead className="text-right">Unit $</TableHead>
                        <TableHead className="text-right">Line $</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.lines.map((line) => {
                        const hasWarning =
                          line.notes.some((n) =>
                            n.includes("conversion missing") || n.includes("No supplier")
                          );
                        
                        return (
                          <TableRow key={line.ingredientId}>
                            <TableCell className="font-medium">
                              {line.ingredientName}
                            </TableCell>
                            <TableCell>{line.packSizeLabel}</TableCell>
                            <TableCell className="text-right">
                              {line.onHandUnits.toFixed(2)} {line.baseUnit}
                            </TableCell>
                            <TableCell className="text-right">
                              {line.requiredUnits.toFixed(2)} {line.baseUnit}
                            </TableCell>
                            <TableCell className="text-right">
                              {line.shortfallUnits.toFixed(2)} {line.baseUnit}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                value={getEffectivePacks(line)}
                                onChange={(e) =>
                                  handleEditPacks(
                                    line.ingredientId,
                                    line.supplierId,
                                    e.target.value
                                  )
                                }
                                className="w-20 text-right"
                                step="1"
                                min="0"
                                data-testid={`input-packs-${line.ingredientId}`}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              {line.unitCost ? formatCurrency(line.unitCost) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrencyDollars(getLineTotal(line))}
                            </TableCell>
                            <TableCell>
                              {hasWarning && (
                                <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-500">
                                  <AlertCircle className="h-4 w-4" />
                                  <span className="text-sm">{line.notes.join(", ")}</span>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Page Total Footer */}
      {data.groups.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Period: {new Date(data.window.startISO).toLocaleDateString()} -{" "}
                  {new Date(data.window.endISO).toLocaleDateString()} ({data.window.days} days)
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">
                  {formatCurrencyDollars(getPageTotal())}
                </p>
                <p className="text-sm text-muted-foreground">
                  {getPageItemCount()} items across {data.groups.length} suppliers
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
