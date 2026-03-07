"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { getWindow } from "@/lib/date-window";
import { AddWasteModal } from "@/components/waste/AddWasteModal";

interface WasteEvent {
  id: string;
  date: string;
  ingredientId: string;
  ingredientName: string;
  qty: string;
  unit: string;
  reason: string;
  unitCostCents: number | null;
  note: string | null;
}

interface WasteData {
  items: WasteEvent[];
  totals: {
    totalCostCents: number;
    byIngredient: Array<{
      ingredientId: string;
      ingredientName: string;
      costCents: number;
    }>;
  };
}

const reasonLabels: Record<string, string> = {
  prep: "Prep Loss",
  spoilage: "Spoilage",
  overportion: "Overportion",
  transfer: "Transfer",
  theft: "Theft",
  other: "Other",
};

const reasonColors: Record<string, string> = {
  prep: "bg-blue-500",
  spoilage: "bg-red-500",
  overportion: "bg-yellow-500",
  transfer: "bg-purple-500",
  theft: "bg-orange-500",
  other: "bg-gray-500",
};

export default function WastePage() {
  const { toast } = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Date navigation state
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calculate window based on period and date
  const window = getWindow(period, currentDate.toISOString());
  const { start, end } = window;

  // Fetch waste data
  const { data: wasteData, isLoading } = useQuery<WasteData>({
    queryKey: ["/api/waste", format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd")],
    queryFn: async () => {
      const response = await fetch(
        `/api/waste?start=${format(start, "yyyy-MM-dd")}&end=${format(end, "yyyy-MM-dd")}`
      );
      if (!response.ok) throw new Error("Failed to fetch waste data");
      return response.json();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/waste/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete waste event");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waste"] });
      toast({
        title: "Waste event deleted",
        description: "The waste event has been removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete waste event",
        variant: "destructive",
      });
    },
  });

  const items = wasteData?.items ?? [];
  const totals = wasteData?.totals ?? { totalCostCents: 0, byIngredient: [] };
  const topOffenders = totals.byIngredient.slice(0, 5);

  // Navigation helpers
  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => {
    const newDate = new Date(currentDate);
    if (period === "day") newDate.setDate(newDate.getDate() - 1);
    if (period === "week") newDate.setDate(newDate.getDate() - 7);
    if (period === "month") newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };
  const goNext = () => {
    const newDate = new Date(currentDate);
    if (period === "day") newDate.setDate(newDate.getDate() + 1);
    if (period === "week") newDate.setDate(newDate.getDate() + 7);
    if (period === "month") newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Waste</h1>
          <p className="text-muted-foreground">
            Track waste events and their cost impact
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} data-testid="button-add-waste">
          <Plus className="h-4 w-4 mr-2" />
          Add Waste
        </Button>
      </div>

      {/* Date Navigator */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <Button
            variant={period === "day" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("day")}
            data-testid="button-period-day"
          >
            Day
          </Button>
          <Button
            variant={period === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("week")}
            data-testid="button-period-week"
          >
            Week
          </Button>
          <Button
            variant={period === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("month")}
            data-testid="button-period-month"
          >
            Month
          </Button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={goPrev} data-testid="button-prev">
            Prev
          </Button>
          <Button variant="outline" size="sm" onClick={goToday} data-testid="button-today">
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={goNext} data-testid="button-next">
            Next
          </Button>
          <span className="text-sm font-medium ml-2" data-testid="text-date-range">
            {format(start, "MMM dd, yyyy")} - {format(end, "MMM dd, yyyy")}
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Total Wasted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600" data-testid="text-total-waste">
              A${(totals.totalCostCents / 100).toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground">
              for the selected {period}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Offenders</CardTitle>
          </CardHeader>
          <CardContent>
            {topOffenders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No waste recorded</p>
            ) : (
              <div className="space-y-2">
                {topOffenders.map((item, idx) => (
                  <div
                    key={item.ingredientId}
                    className="flex items-center justify-between"
                    data-testid={`top-offender-${idx}`}
                  >
                    <span className="text-sm">{item.ingredientName}</span>
                    <span className="text-sm font-medium text-red-600">
                      A${(item.costCents / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Waste Events Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Waste Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 && !isLoading && (
            <div className="text-sm text-muted-foreground mb-4 p-4 bg-muted/50 rounded-md">
              No ingredients yet. In dev, run{" "}
              <code className="bg-background px-2 py-1 rounded text-xs">
                POST /api/dev/seed/waste-fixtures
              </code>{" "}
              to add fixtures, or import your ingredients via Operations → Imports.
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No waste events recorded for this period
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Ingredient</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((event) => {
                    const qty = parseFloat(event.qty);
                    const baseQty =
                      event.unit === "kg"
                        ? qty * 1000
                        : event.unit === "l"
                        ? qty * 1000
                        : qty;
                    const costCents = event.unitCostCents
                      ? Math.round(event.unitCostCents * baseQty)
                      : null;

                    return (
                      <TableRow key={event.id} data-testid={`row-waste-${event.id}`}>
                        <TableCell>{format(new Date(event.date), "dd MMM yyyy")}</TableCell>
                        <TableCell className="font-medium">{event.ingredientName}</TableCell>
                        <TableCell className="text-right text-red-600 font-medium">
                          {qty.toFixed(2)} {event.unit}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={reasonColors[event.reason] || "bg-gray-500"}
                            data-testid={`badge-reason-${event.id}`}
                          >
                            {reasonLabels[event.reason] || event.reason}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-cost-${event.id}`}>
                          {costCents !== null ? `A$${(costCents / 100).toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {event.note || "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(event.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${event.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Waste Modal */}
      <AddWasteModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ["/api/waste"] });
        }}
      />
    </div>
  );
}
