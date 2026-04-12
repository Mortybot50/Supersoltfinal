import { useAuth } from "@/contexts/AuthContext";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Trash2,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Zap,
  Loader2,
  Camera,
  X,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDataStore } from "@/lib/store/dataStore";
import { WasteEntry } from "@/types";
import { toast } from "sonner";
import {
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  subWeeks,
  eachDayOfInterval,
} from "date-fns";
import { PageShell, PageToolbar } from "@/components/shared";
import { StatCards } from "@/components/ui/StatCards";
import { formatCurrency } from "@/lib/utils/formatters";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WASTE_REASONS = [
  { value: "spoilage", label: "Spoilage" },
  { value: "expired", label: "Expired" },
  { value: "overproduction", label: "Overproduction" },
  { value: "breakage", label: "Dropped/Breakage" },
  { value: "staff_meal", label: "Staff Meal" },
  { value: "promo", label: "Promo/Comp" },
  { value: "theft_unknown", label: "Theft/Unknown" },
  { value: "spillage", label: "Spillage" },
  { value: "prep-waste", label: "Prep Waste" },
  { value: "other", label: "Other" },
] as const;

const REASON_LABEL: Record<string, string> = Object.fromEntries(
  WASTE_REASONS.map((r) => [r.value, r.label]),
);

const DAYPARTS = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "late_night", label: "Late Night" },
] as const;

const DAYPART_LABEL: Record<string, string> = Object.fromEntries(
  DAYPARTS.map((d) => [d.value, d.label]),
);

const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Infer current daypart from the hour. */
function inferDaypart(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "late_night";
}

/** Upload a photo to Supabase Storage and return the public URL. */
async function uploadWastePhoto(
  file: File,
  orgId: string,
  venueId: string,
): Promise<string | null> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${orgId}/${venueId}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("waste-photos")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error("Photo upload failed:", uploadError);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("waste-photos").getPublicUrl(path);

    return publicUrl;
  } catch (err) {
    console.error("Photo upload error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Waste() {
  const {
    wasteLogs,
    ingredients,
    isLoading,
    addWasteEntry,
    deleteWasteEntry,
    loadWasteLogsFromDB,
    loadIngredientsFromDB,
  } = useDataStore();
  const { currentVenue, currentOrg, user, profile } = useAuth();

  // UI state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("month");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [showDashboard, setShowDashboard] = useState(true);
  const [page, setPage] = useState(1);
  const [ingredientPopoverOpen, setIngredientPopoverOpen] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [wasteForm, setWasteForm] = useState({
    ingredient_id: "",
    quantity: 0,
    reason: "spoilage" as string,
    daypart: inferDaypart(),
    notes: "",
    photo: null as File | null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadWasteLogsFromDB();
    loadIngredientsFromDB();
  }, [loadWasteLogsFromDB, loadIngredientsFromDB]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [dateFilter, searchQuery, reasonFilter]);

  // ---------------------------------------------------------------------------
  // Computed: selected ingredient & cost preview
  // ---------------------------------------------------------------------------

  const selectedIngredient = useMemo(
    () => ingredients.find((i) => i.id === wasteForm.ingredient_id),
    [ingredients, wasteForm.ingredient_id],
  );

  const estimatedCostCents = useMemo(() => {
    if (!selectedIngredient || wasteForm.quantity <= 0) return 0;
    return Math.round(wasteForm.quantity * selectedIngredient.cost_per_unit);
  }, [selectedIngredient, wasteForm.quantity]);

  // ---------------------------------------------------------------------------
  // Filtered + paginated waste log
  // ---------------------------------------------------------------------------

  const filteredWaste = useMemo(() => {
    let filtered = wasteLogs;

    const now = new Date();
    let startDate: Date;

    switch (dateFilter) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = subDays(now, 7);
        break;
      case "month":
        startDate = startOfMonth(now);
        break;
      default:
        startDate = new Date(0);
    }

    filtered = filtered.filter((we) => new Date(we.waste_date) >= startDate);

    if (reasonFilter !== "all") {
      filtered = filtered.filter((we) => we.reason === reasonFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((we) =>
        we.ingredient_name.toLowerCase().includes(query),
      );
    }

    return filtered.sort(
      (a, b) =>
        new Date(b.waste_date).getTime() - new Date(a.waste_date).getTime(),
    );
  }, [wasteLogs, dateFilter, searchQuery, reasonFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredWaste.length / PAGE_SIZE));
  const paginatedWaste = useMemo(
    () => filteredWaste.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredWaste, page],
  );

  // ---------------------------------------------------------------------------
  // Dashboard analytics
  // ---------------------------------------------------------------------------

  const dashboardData = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const lastWeekStart = subWeeks(weekStart, 1);
    const monthStart = startOfMonth(now);

    const weekWaste = wasteLogs.filter(
      (we) => new Date(we.waste_date) >= weekStart,
    );
    const lastWeekWaste = wasteLogs.filter((we) => {
      const d = new Date(we.waste_date);
      return d >= lastWeekStart && d < weekStart;
    });
    const monthWaste = wasteLogs.filter(
      (we) => new Date(we.waste_date) >= monthStart,
    );

    const weekTotal = weekWaste.reduce((sum, we) => sum + we.value, 0);
    const lastWeekTotal = lastWeekWaste.reduce((sum, we) => sum + we.value, 0);
    const monthTotal = monthWaste.reduce((sum, we) => sum + we.value, 0);

    // Week-over-week change %
    const weekChange =
      lastWeekTotal > 0
        ? Math.round(((weekTotal - lastWeekTotal) / lastWeekTotal) * 100)
        : 0;

    // Top wasted items (by value, this month)
    const byItem = new Map<
      string,
      { name: string; value: number; count: number }
    >();
    monthWaste.forEach((we) => {
      const existing = byItem.get(we.ingredient_id) || {
        name: we.ingredient_name,
        value: 0,
        count: 0,
      };
      existing.value += we.value;
      existing.count += 1;
      byItem.set(we.ingredient_id, existing);
    });
    const topItems = Array.from(byItem.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const topWastedItem = topItems.length > 0 ? topItems[0].name : "—";

    // Waste by reason (bar chart data)
    const byReason = new Map<string, number>();
    monthWaste.forEach((we) => {
      byReason.set(we.reason, (byReason.get(we.reason) || 0) + we.value);
    });
    const reasonChartData = Array.from(byReason.entries())
      .map(([reason, value]) => ({
        reason: REASON_LABEL[reason] || reason,
        value: value / 100,
      }))
      .sort((a, b) => b.value - a.value);

    // Daily trend (last 30 days)
    const thirtyDaysAgo = subDays(now, 30);
    const days = eachDayOfInterval({ start: thirtyDaysAgo, end: now });
    const dailyTrend = days.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayWaste = wasteLogs.filter(
        (we) => format(new Date(we.waste_date), "yyyy-MM-dd") === dayStr,
      );
      return {
        date: format(day, "dd/MM"),
        value: dayWaste.reduce((sum, we) => sum + we.value, 0) / 100,
      };
    });

    // Top 10 most frequently wasted items (for quick-add chips)
    const frequencyMap = new Map<string, number>();
    wasteLogs.forEach((we) => {
      frequencyMap.set(
        we.ingredient_id,
        (frequencyMap.get(we.ingredient_id) || 0) + 1,
      );
    });
    const frequentIds = Array.from(frequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);

    return {
      weekTotal,
      lastWeekTotal,
      weekChange,
      monthTotal,
      topItems,
      topWastedItem,
      reasonChartData,
      dailyTrend,
      frequentIds,
    };
  }, [wasteLogs]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleOpenDialog = useCallback((preselectedIngredientId?: string) => {
    setWasteForm({
      ingredient_id: preselectedIngredientId || "",
      quantity: 0,
      reason: "spoilage",
      daypart: inferDaypart(),
      notes: "",
      photo: null,
    });
    setPhotoPreviewUrl(null);
    setDialogOpen(true);
  }, []);

  const handlePhotoChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Photo must be under 5 MB");
        return;
      }
      setWasteForm((prev) => ({ ...prev, photo: file }));
      setPhotoPreviewUrl(URL.createObjectURL(file));
    },
    [],
  );

  const handleRemovePhoto = useCallback(() => {
    setWasteForm((prev) => ({ ...prev, photo: null }));
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [photoPreviewUrl]);

  const handleSave = async () => {
    if (!currentVenue?.id || currentVenue.id === "all") {
      toast.error("Select a specific venue before logging waste");
      return;
    }
    if (!wasteForm.ingredient_id) {
      toast.error("Please select an ingredient");
      return;
    }
    if (wasteForm.quantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    const ingredient = ingredients.find(
      (i) => i.id === wasteForm.ingredient_id,
    );
    if (!ingredient) {
      toast.error("Ingredient not found");
      return;
    }

    setSubmitting(true);

    try {
      // Upload photo if present
      let photoUrl: string | undefined;
      if (wasteForm.photo && currentOrg?.id) {
        const url = await uploadWastePhoto(
          wasteForm.photo,
          currentOrg.id,
          currentVenue.id,
        );
        if (url) photoUrl = url;
      }

      const costAtTime = ingredient.cost_per_unit;
      const value = Math.round(wasteForm.quantity * costAtTime);

      const wasteEntry: WasteEntry = {
        id: crypto.randomUUID(),
        org_id: currentOrg?.id,
        venue_id: currentVenue.id,
        waste_date: new Date(),
        waste_time: format(new Date(), "HH:mm"),
        ingredient_id: wasteForm.ingredient_id,
        ingredient_name: ingredient.name,
        quantity: wasteForm.quantity,
        unit: ingredient.unit,
        value,
        reason: wasteForm.reason as WasteEntry["reason"],
        notes: wasteForm.notes || undefined,
        recorded_by_user_id: user?.id || "",
        recorded_by_name: profile
          ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
            "Manager"
          : "Manager",
      };

      // Attach extended fields for DB (these pass through as extra keys on the insert)
      const extendedEntry = {
        ...wasteEntry,
        reason_code: wasteForm.reason,
        daypart: wasteForm.daypart,
        photo_url: photoUrl,
        cost_at_time: costAtTime,
      };

      // addWasteEntry uses the WasteEntry type; the extra keys will be
      // included in the Supabase insert payload if the columns exist.
      await addWasteEntry(extendedEntry as unknown as WasteEntry);
      toast.success("Waste logged successfully");
      setDialogOpen(false);
    } catch (error) {
      toast.error("Failed to log waste");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, itemName: string) => {
    if (confirm(`Delete waste entry for ${itemName}?`)) {
      try {
        await deleteWasteEntry(id);
        toast.success("Waste entry deleted");
      } catch (error) {
        toast.error("Failed to delete waste entry");
        console.error(error);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const toolbar = (
    <PageToolbar
      title="Waste Tracking"
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ingredient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-[160px] pl-8 text-sm"
            />
          </div>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reasonFilter} onValueChange={setReasonFilter}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue placeholder="Reason" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reasons</SelectItem>
              {WASTE_REASONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={showDashboard ? "default" : "outline"}
            size="sm"
            onClick={() => setShowDashboard(!showDashboard)}
            className="h-8 text-xs"
          >
            Dashboard
          </Button>
        </div>
      }
      primaryAction={{
        label: "Log Waste",
        icon: Plus,
        onClick: () => handleOpenDialog(),
        variant: "primary",
      }}
    />
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <PageShell toolbar={toolbar}>
      {/* Summary cards */}
      <div className="px-6 pt-6 pb-2 space-y-3">
        <StatCards
          stats={[
            {
              label: "This Week",
              value: formatCurrency(dashboardData.weekTotal),
              trend:
                dashboardData.weekChange !== 0
                  ? dashboardData.weekChange > 0
                    ? ("down" as const)
                    : ("up" as const)
                  : undefined,
              subtitle:
                dashboardData.weekChange !== 0
                  ? `${dashboardData.weekChange > 0 ? "+" : ""}${dashboardData.weekChange}% vs last week`
                  : undefined,
            },
            {
              label: "This Month",
              value: formatCurrency(dashboardData.monthTotal),
            },
            {
              label: "Top Wasted Item",
              value: dashboardData.topWastedItem,
            },
            {
              label: "Log Entries",
              value: filteredWaste.length.toString(),
            },
          ]}
          columns={4}
        />
      </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Dashboard Section */}
        {showDashboard && (
          <div className="space-y-4">
            {/* Empty state when no waste logged yet */}
            {wasteLogs.length === 0 && (
              <Card className="p-8 text-center">
                <Trash2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium mb-1">No waste data yet</p>
                <p className="text-sm text-muted-foreground">
                  Log waste entries to see your dashboard analytics here.
                </p>
              </Card>
            )}

            {/* Quick-Add Chips */}
            {wasteLogs.length > 0 && dashboardData.frequentIds.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <h3 className="font-semibold text-sm">
                    Quick Log — Top Wasted Items
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dashboardData.frequentIds.map((id) => {
                    const ing = ingredients.find((i) => i.id === id);
                    if (!ing) return null;
                    return (
                      <Button
                        key={id}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleOpenDialog(id)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {ing.name}
                      </Button>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Charts: stack vertically on mobile, side-by-side on desktop */}
            {wasteLogs.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Waste by Reason (horizontal bar) */}
                {dashboardData.reasonChartData.length > 0 && (
                  <Card className="p-4">
                    <h3 className="font-semibold text-sm mb-3">
                      Waste by Reason (This Month)
                    </h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={dashboardData.reasonChartData}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          tickFormatter={(v: number) => `$${v}`}
                        />
                        <YAxis
                          type="category"
                          dataKey="reason"
                          width={100}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          formatter={(value: number) => [
                            `$${value.toFixed(2)}`,
                            "Value",
                          ]}
                        />
                        <Bar
                          dataKey="value"
                          fill="#ef4444"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                )}

                {/* Daily Trend (line, 30 days) */}
                <Card className="p-4">
                  <h3 className="font-semibold text-sm mb-3">
                    Daily Waste Trend (30 Days)
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={dashboardData.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        interval={4}
                      />
                      <YAxis tickFormatter={(v: number) => `$${v}`} />
                      <Tooltip
                        formatter={(value: number) => [
                          `$${value.toFixed(2)}`,
                          "Waste",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}

            {/* Top Wasted Items */}
            {dashboardData.topItems.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold text-sm mb-3">
                  Top Wasted Items (This Month)
                </h3>
                <div className="space-y-2">
                  {dashboardData.topItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4">
                          {i + 1}.
                        </span>
                        <span className="text-sm font-medium">{item.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {item.count}x
                        </Badge>
                      </div>
                      <span className="text-sm font-semibold text-red-600">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Separator />
          </div>
        )}

        {/* Waste Log History Table */}
        {isLoading && wasteLogs.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card shadow-sm p-12 text-center">
            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Loading waste logs...
            </p>
          </div>
        ) : filteredWaste.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <h3 className="text-base font-semibold tracking-tight mb-2">
              {wasteLogs.length === 0
                ? "No Waste Logged Yet"
                : "No Waste Found"}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              {wasteLogs.length === 0
                ? "Start tracking waste to identify patterns and reduce costs"
                : "Try adjusting your filters"}
            </p>
            {wasteLogs.length === 0 && (
              <Button onClick={() => handleOpenDialog()} className="btn-press">
                <Plus className="h-4 w-4 mr-2" />
                Log First Waste
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 dark:bg-slate-800/80">
                    <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                      Date
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                      Ingredient
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                      Qty
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                      Reason
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                      Cost
                    </TableHead>
                    <TableHead className="hidden md:table-cell text-xs uppercase tracking-wider font-medium text-muted-foreground">
                      Logged By
                    </TableHead>
                    <TableHead className="hidden lg:table-cell text-xs uppercase tracking-wider font-medium text-muted-foreground">
                      Photo
                    </TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedWaste.map((waste) => {
                    const photoUrl = (
                      waste as unknown as Record<string, unknown>
                    ).photo_url as string | undefined;
                    return (
                      <TableRow key={waste.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(waste.waste_date), "dd MMM yyyy")}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {waste.waste_time}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {waste.ingredient_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {waste.quantity} {waste.unit}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {REASON_LABEL[waste.reason] || waste.reason}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-red-600">
                          {formatCurrency(waste.value)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {waste.recorded_by_name || waste.recorded_by_user_id}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {photoUrl ? (
                            <a
                              href={photoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ImageIcon className="h-4 w-4 text-blue-500" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleDelete(waste.id, waste.ingredient_name)
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, filteredWaste.length)} of{" "}
                  {filteredWaste.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs px-2">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Log Waste Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Log Waste</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Ingredient selector (searchable combobox) */}
              <div>
                <Label>Ingredient *</Label>
                <Popover
                  open={ingredientPopoverOpen}
                  onOpenChange={setIngredientPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={ingredientPopoverOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selectedIngredient
                        ? `${selectedIngredient.name} (${selectedIngredient.unit})`
                        : "Select ingredient..."}
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search ingredients..." />
                      <CommandList>
                        <CommandEmpty>No ingredients found.</CommandEmpty>
                        <CommandGroup>
                          {ingredients
                            .filter((i) => i.active)
                            .map((ing) => (
                              <CommandItem
                                key={ing.id}
                                value={ing.name}
                                onSelect={() => {
                                  setWasteForm((prev) => ({
                                    ...prev,
                                    ingredient_id: ing.id,
                                  }));
                                  setIngredientPopoverOpen(false);
                                }}
                              >
                                {ing.name}{" "}
                                <span className="ml-1 text-muted-foreground text-xs">
                                  ({ing.unit})
                                </span>
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Quantity + Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="quantity"
                      type="number"
                      min="0"
                      step="0.1"
                      value={wasteForm.quantity || ""}
                      onChange={(e) =>
                        setWasteForm((prev) => ({
                          ...prev,
                          quantity: parseFloat(e.target.value) || 0,
                        }))
                      }
                      placeholder="0"
                    />
                    <span className="text-sm text-muted-foreground min-w-[2rem]">
                      {selectedIngredient?.unit || ""}
                    </span>
                  </div>
                </div>

                {/* Daypart selector */}
                <div>
                  <Label htmlFor="daypart">Daypart</Label>
                  <Select
                    value={wasteForm.daypart}
                    onValueChange={(value) =>
                      setWasteForm((prev) => ({ ...prev, daypart: value }))
                    }
                  >
                    <SelectTrigger id="daypart">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYPARTS.map((dp) => (
                        <SelectItem key={dp.value} value={dp.value}>
                          {dp.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Reason code */}
              <div>
                <Label htmlFor="reason">Reason *</Label>
                <Select
                  value={wasteForm.reason}
                  onValueChange={(value) =>
                    setWasteForm((prev) => ({ ...prev, reason: value }))
                  }
                >
                  <SelectTrigger id="reason">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WASTE_REASONS.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="waste_notes">Notes (optional)</Label>
                <Textarea
                  id="waste_notes"
                  value={wasteForm.notes}
                  onChange={(e) =>
                    setWasteForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="Any additional details..."
                  rows={2}
                />
              </div>

              {/* Photo upload */}
              <div>
                <Label>Photo (optional)</Label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  {!wasteForm.photo ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Add Photo
                    </Button>
                  ) : (
                    <div className="relative">
                      {photoPreviewUrl && (
                        <img
                          src={photoPreviewUrl}
                          alt="Waste photo preview"
                          className="h-20 w-20 rounded-md object-cover border"
                        />
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                        onClick={handleRemovePhoto}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Auto-calculated cost display */}
              {selectedIngredient && wasteForm.quantity > 0 && (
                <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Estimated Cost</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(selectedIngredient.cost_per_unit)} /{" "}
                        {selectedIngredient.unit} × {wasteForm.quantity}
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(estimatedCostCents)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={submitting}>
                {submitting && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Log Waste
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageShell>
  );
}
