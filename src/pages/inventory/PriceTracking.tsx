import { useState, useMemo, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Search,
  RefreshCw,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { useDataStore } from "@/lib/store/dataStore";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, isAfter } from "date-fns";
import { PageShell, PageToolbar } from "@/components/shared";
import { StatCards } from "@/components/ui/StatCards";
import { SecondaryStats } from "@/components/ui/SecondaryStats";
import { formatCurrency } from "@/lib/utils/formatters";
import { toast } from "sonner";
import type { IngredientPriceHistory } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

type AlertThreshold = 5 | 10 | 15 | 20;

interface PricePoint {
  changed_at: string;
  new_cost_cents: number;
  old_cost_cents: number | null;
  source: string;
  ingredient_id: string;
  ingredient_name: string;
}

interface IngredientPriceSummary {
  id: string;
  name: string;
  category: string;
  supplier_id: string | undefined;
  supplier_name: string | undefined;
  current_cost: number;
  cost_30d_ago: number | null;
  change_pct: number | null;
  change_abs: number | null;
  history_count: number;
  last_updated: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  produce: "Produce",
  meat: "Meat & Protein",
  seafood: "Seafood",
  dairy: "Dairy",
  "dry-goods": "Dry Goods",
  beverages: "Beverages",
  other: "Other",
};

const LINE_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function PriceTracking() {
  const { ingredients, suppliers, loadIngredientsFromDB, loadSuppliersFromDB } =
    useDataStore();

  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [alertThreshold, setAlertThreshold] = useState<AlertThreshold>(10);
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<string[]>(
    [],
  );
  const [trendDays, setTrendDays] = useState<30 | 60 | 90>(90);

  useEffect(() => {
    loadIngredientsFromDB();
    loadSuppliersFromDB();
  }, [loadIngredientsFromDB, loadSuppliersFromDB]);

  const fetchPriceHistory = useCallback(async () => {
    if (ingredients.length === 0) return;
    setLoading(true);
    try {
      const ingredientIds = ingredients
        .filter((i) => i.active)
        .map((i) => i.id);
      const { data, error } = await supabase
        .from("ingredient_price_history")
        .select(
          "id, ingredient_id, old_cost_cents, new_cost_cents, changed_at, source",
        )
        .in("ingredient_id", ingredientIds)
        .order("changed_at", { ascending: true });

      if (error) throw error;

      // Join ingredient name
      const points: PricePoint[] = (data || []).map(
        (row: IngredientPriceHistory) => {
          const ing = ingredients.find((i) => i.id === row.ingredient_id);
          return {
            changed_at: row.changed_at,
            new_cost_cents: row.new_cost_cents,
            old_cost_cents: row.old_cost_cents,
            source: row.source,
            ingredient_id: row.ingredient_id,
            ingredient_name: ing?.name ?? row.ingredient_id,
          };
        },
      );
      setPriceHistory(points);
    } catch (err) {
      toast.error("Failed to load price history");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [ingredients]);

  useEffect(() => {
    if (ingredients.length > 0) {
      fetchPriceHistory();
    }
  }, [ingredients.length, fetchPriceHistory]);

  // ─── Ingredient price summaries ─────────────────────────────────────────

  const priceSummaries = useMemo((): IngredientPriceSummary[] => {
    const cutoff30 = subDays(new Date(), 30);
    return ingredients
      .filter((i) => i.active)
      .map((ing) => {
        const hist = priceHistory.filter((p) => p.ingredient_id === ing.id);
        const recent = hist.filter((p) =>
          isAfter(new Date(p.changed_at), cutoff30),
        );
        const oldest30 = hist.find(
          (p) => !isAfter(new Date(p.changed_at), cutoff30),
        );
        const cost30dAgo =
          oldest30?.new_cost_cents ??
          (hist.length > 0 ? hist[0].old_cost_cents : null);

        let changePct: number | null = null;
        let changeAbs: number | null = null;
        if (cost30dAgo && cost30dAgo > 0) {
          changeAbs = ing.cost_per_unit - cost30dAgo;
          changePct = (changeAbs / cost30dAgo) * 100;
        }

        const supplier = ing.supplier_id
          ? suppliers.find((s) => s.id === ing.supplier_id)
          : undefined;

        return {
          id: ing.id,
          name: ing.name,
          category: ing.category,
          supplier_id: ing.supplier_id,
          supplier_name: supplier?.name,
          current_cost: ing.cost_per_unit,
          cost_30d_ago: cost30dAgo,
          change_pct: changePct,
          change_abs: changeAbs,
          history_count: hist.length,
          last_updated:
            recent.length > 0 ? recent[recent.length - 1].changed_at : null,
        };
      });
  }, [ingredients, priceHistory, suppliers]);

  // ─── Filtered list ──────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = priceSummaries;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (categoryFilter !== "all") {
      list = list.filter((i) => i.category === categoryFilter);
    }
    if (supplierFilter !== "all") {
      list = list.filter((i) => i.supplier_id === supplierFilter);
    }
    return list.sort((a, b) => {
      // Sort by change_pct descending (biggest increases first)
      const ap = a.change_pct ?? 0;
      const bp = b.change_pct ?? 0;
      return bp - ap;
    });
  }, [priceSummaries, search, categoryFilter, supplierFilter]);

  // ─── Alerts ─────────────────────────────────────────────────────────────

  const alerts = useMemo(
    () =>
      filtered.filter(
        (i) => i.change_pct !== null && i.change_pct > alertThreshold,
      ),
    [filtered, alertThreshold],
  );

  // ─── Trend chart data ────────────────────────────────────────────────────

  const trendChartData = useMemo(() => {
    if (selectedIngredientIds.length === 0) return [];

    const cutoff = subDays(new Date(), trendDays);
    // Build date → cost map per ingredient
    const dataByDate: Record<string, Record<string, number>> = {};

    for (const id of selectedIngredientIds) {
      const ing = ingredients.find((i) => i.id === id);
      if (!ing) continue;

      const hist = priceHistory
        .filter(
          (p) =>
            p.ingredient_id === id && isAfter(new Date(p.changed_at), cutoff),
        )
        .sort(
          (a, b) =>
            new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
        );

      // Walk through history and build running cost
      let currentCost: number | null = null;
      for (const point of hist) {
        const dateKey = format(new Date(point.changed_at), "yyyy-MM-dd");
        if (!dataByDate[dateKey]) dataByDate[dateKey] = {};
        dataByDate[dateKey][id] = point.new_cost_cents;
        currentCost = point.new_cost_cents;
      }

      // Ensure current cost is shown at today
      const todayKey = format(new Date(), "yyyy-MM-dd");
      if (!dataByDate[todayKey]) dataByDate[todayKey] = {};
      if (currentCost === null) currentCost = ing.cost_per_unit;
      if (!dataByDate[todayKey][id]) dataByDate[todayKey][id] = currentCost;
    }

    // Forward-fill costs for each ingredient across all dates
    const sortedDates = Object.keys(dataByDate).sort();
    const lastKnown: Record<string, number | undefined> = {};

    return sortedDates.map((dateKey) => {
      const row: Record<string, string | number> = {
        date: format(new Date(dateKey), "dd MMM"),
      };
      for (const id of selectedIngredientIds) {
        if (dataByDate[dateKey][id] !== undefined) {
          lastKnown[id] = dataByDate[dateKey][id];
        }
        const ing = ingredients.find((i) => i.id === id);
        const val = lastKnown[id] ?? ing?.cost_per_unit;
        if (val !== undefined) {
          row[id] = Math.round(val) / 100;
        }
      }
      return row;
    });
  }, [selectedIngredientIds, priceHistory, ingredients, trendDays]);

  // ─── Supplier comparison ─────────────────────────────────────────────────

  const supplierComparison = useMemo(() => {
    // For each ingredient, find if multiple suppliers have different costs via price history
    // Simple: group active ingredients by name-similarity is hard; instead show by category
    const bySupplier: Record<
      string,
      {
        supplierId: string;
        supplierName: string;
        avgCost: number;
        ingredientCount: number;
      }
    > = {};

    for (const ing of ingredients.filter((i) => i.active && i.supplier_id)) {
      const sid = ing.supplier_id!;
      const sup = suppliers.find((s) => s.id === sid);
      if (!bySupplier[sid]) {
        bySupplier[sid] = {
          supplierId: sid,
          supplierName: sup?.name ?? sid,
          avgCost: 0,
          ingredientCount: 0,
        };
      }
      bySupplier[sid].avgCost += ing.cost_per_unit;
      bySupplier[sid].ingredientCount++;
    }

    return Object.values(bySupplier)
      .map((s) => ({
        ...s,
        avgCostPerItem:
          s.ingredientCount > 0 ? s.avgCost / s.ingredientCount : 0,
      }))
      .sort((a, b) => a.avgCostPerItem - b.avgCostPerItem);
  }, [ingredients, suppliers]);

  // ─── Category price index ────────────────────────────────────────────────

  const categoryIndex = useMemo(() => {
    const cats: Record<
      string,
      { current: number; prev: number; count: number }
    > = {};
    for (const row of priceSummaries) {
      if (!cats[row.category])
        cats[row.category] = { current: 0, prev: 0, count: 0 };
      cats[row.category].current += row.current_cost;
      cats[row.category].prev += row.cost_30d_ago ?? row.current_cost;
      cats[row.category].count++;
    }
    return Object.entries(cats)
      .map(([cat, data]) => ({
        category: cat,
        label: CATEGORY_LABELS[cat] || cat,
        avgCurrentCost: data.count > 0 ? data.current / data.count : 0,
        avgPrevCost: data.count > 0 ? data.prev / data.count : 0,
        changePct:
          data.prev > 0 ? ((data.current - data.prev) / data.prev) * 100 : 0,
        itemCount: data.count,
      }))
      .sort((a, b) => b.changePct - a.changePct);
  }, [priceSummaries]);

  // ─── Summary stats ───────────────────────────────────────────────────────

  const summaryStats = useMemo(() => {
    const withHistory = priceSummaries.filter((i) => i.history_count > 0);
    const rising = priceSummaries.filter((i) => (i.change_pct ?? 0) > 0);
    const falling = priceSummaries.filter((i) => (i.change_pct ?? 0) < 0);
    const avgChange =
      withHistory.length > 0
        ? withHistory.reduce((s, i) => s + (i.change_pct ?? 0), 0) /
          withHistory.length
        : 0;
    return {
      alerts: alerts.length,
      rising: rising.length,
      falling: falling.length,
      avgChange,
    };
  }, [priceSummaries, alerts]);

  const categories = useMemo(() => {
    return Array.from(new Set(ingredients.map((i) => i.category))).sort();
  }, [ingredients]);

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.active),
    [suppliers],
  );

  // ─── Toolbar ─────────────────────────────────────────────────────────────

  const toolbar = (
    <PageToolbar
      title="Price Tracking"
      filters={
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search ingredient…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 w-48"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c] || c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue placeholder="All Suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {activeSuppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(alertThreshold)}
            onValueChange={(v) =>
              setAlertThreshold(parseInt(v) as AlertThreshold)
            }
          >
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">Alert &gt;5%</SelectItem>
              <SelectItem value="10">Alert &gt;10%</SelectItem>
              <SelectItem value="15">Alert &gt;15%</SelectItem>
              <SelectItem value="20">Alert &gt;20%</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={fetchPriceHistory}
            disabled={loading}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      }
    />
  );

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-4 pt-4 space-y-3">
        <StatCards
          stats={[
            { label: "Price Alerts", value: summaryStats.alerts },
            { label: "Rising Prices", value: summaryStats.rising },
            { label: "Falling Prices", value: summaryStats.falling },
          ]}
          columns={3}
        />
        <SecondaryStats
          stats={[
            {
              label: "Avg 30d Change",
              value: `${summaryStats.avgChange > 0 ? "+" : ""}${summaryStats.avgChange.toFixed(1)}%`,
            },
            {
              label: "Tracked Ingredients",
              value: priceSummaries.filter((i) => i.history_count > 0).length,
            },
          ]}
        />
      </div>
      <div className="p-4 md:p-6 space-y-6">
        {/* Alerts banner */}
        {alerts.length > 0 && (
          <Card className="p-4 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-red-800 dark:text-red-200">
                  {alerts.length} ingredient
                  {alerts.length !== 1 ? "s have" : " has"} increased more than{" "}
                  {alertThreshold}% in 30 days
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {alerts.slice(0, 8).map((a) => (
                    <Badge key={a.id} variant="destructive" className="text-xs">
                      {a.name} +{a.change_pct!.toFixed(1)}%
                    </Badge>
                  ))}
                  {alerts.length > 8 && (
                    <Badge variant="outline" className="text-xs">
                      +{alerts.length - 8} more
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        <Tabs defaultValue="ingredients">
          <TabsList>
            <TabsTrigger value="ingredients">Price List</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="categories">Category Index</TabsTrigger>
            <TabsTrigger value="suppliers">Supplier Comparison</TabsTrigger>
          </TabsList>

          {/* ── Price List ── */}
          <TabsContent value="ingredients">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Current Price</TableHead>
                    <TableHead className="text-right">30d Ago</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="text-right">Changes</TableHead>
                    <TableHead>Last Update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No ingredients found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((row) => {
                      const alerted =
                        row.change_pct !== null &&
                        row.change_pct > alertThreshold;
                      const isSelected = selectedIngredientIds.includes(row.id);
                      return (
                        <TableRow
                          key={row.id}
                          className={
                            alerted ? "bg-red-50/30 dark:bg-red-950/20" : ""
                          }
                        >
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-6 w-6 p-0 ${isSelected ? "text-yellow-500" : "text-muted-foreground"}`}
                              title="Pin to trend chart"
                              onClick={() =>
                                setSelectedIngredientIds(
                                  (prev) =>
                                    isSelected
                                      ? prev.filter((id) => id !== row.id)
                                      : [...prev.slice(-4), row.id], // max 5 lines
                                )
                              }
                            >
                              <Star
                                className="h-3.5 w-3.5"
                                fill={isSelected ? "currentColor" : "none"}
                              />
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {CATEGORY_LABELS[row.category] || row.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.supplier_name ?? "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(row.current_cost)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {row.cost_30d_ago !== null
                              ? formatCurrency(row.cost_30d_ago)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.change_pct !== null ? (
                              <span
                                className={`font-semibold flex items-center justify-end gap-1 ${
                                  row.change_pct > 0
                                    ? "text-red-600"
                                    : row.change_pct < 0
                                      ? "text-green-600"
                                      : "text-muted-foreground"
                                }`}
                              >
                                {row.change_pct > 0 ? (
                                  <TrendingUp className="h-3.5 w-3.5" />
                                ) : row.change_pct < 0 ? (
                                  <TrendingDown className="h-3.5 w-3.5" />
                                ) : null}
                                {row.change_pct > 0 ? "+" : ""}
                                {row.change_pct.toFixed(1)}%
                                {alerted && (
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {row.history_count}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.last_updated
                              ? format(new Date(row.last_updated), "dd MMM yy")
                              : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* ── Trends ── */}
          <TabsContent value="trends" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Star ingredients from the Price List tab to plot them here (up
                to 5).
              </p>
              <Select
                value={String(trendDays)}
                onValueChange={(v) => setTrendDays(parseInt(v) as 30 | 60 | 90)}
              >
                <SelectTrigger className="h-8 w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="60">Last 60 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedIngredientIds.length === 0 ? (
              <Card className="p-12 text-center">
                <Star className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-semibold">No ingredients selected</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Go to the Price List tab and click the star on ingredients you
                  want to compare.
                </p>
              </Card>
            ) : trendChartData.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">
                  No price history for the selected period.
                </p>
              </Card>
            ) : (
              <Card className="p-4">
                <h3 className="font-semibold text-sm mb-4">
                  Price Trend — Last {trendDays} days
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart
                    data={trendChartData}
                    margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `$${v.toFixed(2)}`}
                    />
                    <Tooltip
                      formatter={(v: number) => [`$${v.toFixed(2)}`, ""]}
                    />
                    <Legend />
                    {selectedIngredientIds.map((id, idx) => {
                      const ing = ingredients.find((i) => i.id === id);
                      return (
                        <Line
                          key={id}
                          type="stepAfter"
                          dataKey={id}
                          name={ing?.name ?? id}
                          stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Recent changes list */}
            {priceHistory.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold text-sm mb-3">
                  Recent Price Changes
                </h3>
                <div className="space-y-2">
                  {priceHistory
                    .filter((p) => p.old_cost_cents !== null)
                    .sort(
                      (a, b) =>
                        new Date(b.changed_at).getTime() -
                        new Date(a.changed_at).getTime(),
                    )
                    .slice(0, 20)
                    .map((p, idx) => {
                      const changePct =
                        p.old_cost_cents && p.old_cost_cents > 0
                          ? ((p.new_cost_cents - p.old_cost_cents) /
                              p.old_cost_cents) *
                            100
                          : null;
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                        >
                          <div>
                            <span className="font-medium">
                              {p.ingredient_name}
                            </span>
                            <Badge variant="outline" className="text-xs ml-2">
                              {p.source}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-muted-foreground text-xs">
                              {format(new Date(p.changed_at), "dd MMM yy")}
                            </span>
                            <span className="text-muted-foreground">
                              {p.old_cost_cents !== null
                                ? formatCurrency(p.old_cost_cents)
                                : "—"}
                              {" → "}
                              {formatCurrency(p.new_cost_cents)}
                            </span>
                            {changePct !== null && (
                              <span
                                className={`font-semibold ${
                                  changePct > 0
                                    ? "text-red-600"
                                    : "text-green-600"
                                }`}
                              >
                                {changePct > 0 ? "+" : ""}
                                {changePct.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ── Category Index ── */}
          <TabsContent value="categories">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Avg Cost (now)</TableHead>
                    <TableHead className="text-right">
                      Avg Cost (30d ago)
                    </TableHead>
                    <TableHead className="text-right">30d Change</TableHead>
                    <TableHead>Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryIndex.map((row) => (
                    <TableRow key={row.category}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className="text-right">
                        {row.itemCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.avgCurrentCost)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(row.avgPrevCost)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          row.changePct > alertThreshold
                            ? "text-red-600"
                            : row.changePct < -alertThreshold
                              ? "text-green-600"
                              : "text-muted-foreground"
                        }`}
                      >
                        {row.changePct > 0 ? "+" : ""}
                        {row.changePct.toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        {row.changePct > alertThreshold ? (
                          <Badge variant="destructive">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Rising
                          </Badge>
                        ) : row.changePct < -alertThreshold ? (
                          <Badge className="bg-green-600">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Falling
                          </Badge>
                        ) : (
                          <Badge variant="outline">Stable</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* ── Supplier Comparison ── */}
          <TabsContent value="suppliers">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Average cost per item by supplier. Lower is better — use this to
                identify best-value suppliers.
              </p>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">
                        Items Supplied
                      </TableHead>
                      <TableHead className="text-right">
                        Avg Cost / Item
                      </TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                      <TableHead>Best Value?</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierComparison.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No supplier data available. Assign suppliers to
                          ingredients.
                        </TableCell>
                      </TableRow>
                    ) : (
                      supplierComparison.map((row, idx) => (
                        <TableRow key={row.supplierId}>
                          <TableCell className="text-muted-foreground font-medium">
                            #{idx + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.supplierName}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.ingredientCount}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.avgCostPerItem)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(row.avgCost)}
                          </TableCell>
                          <TableCell>
                            {idx === 0 ? (
                              <Badge className="bg-green-600">
                                <Star
                                  className="h-3 w-3 mr-1"
                                  fill="currentColor"
                                />
                                Best Value
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                +
                                {formatCurrency(
                                  row.avgCostPerItem -
                                    supplierComparison[0].avgCostPerItem,
                                )}{" "}
                                avg
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
