import { useState, useMemo, useEffect } from "react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ChefHat, Loader2 } from "lucide-react";
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
import { useDataStore } from "@/lib/store/dataStore";
import { PageShell, PageToolbar } from "@/components/shared";
import { StatCards } from "@/components/ui/StatCards";
import { formatCurrency } from "@/lib/utils/formatters";

const CATEGORIES = [
  { value: "mains", label: "Mains" },
  { value: "sides", label: "Sides" },
  { value: "drinks", label: "Drinks" },
  { value: "desserts", label: "Desserts" },
  { value: "prep", label: "Prep" },
  { value: "other", label: "Other" },
];

export default function Recipes() {
  const navigate = useNavigate();
  const { recipes, loadRecipesFromDB } = useDataStore();
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    loadRecipesFromDB().finally(() => setLoading(false));
  }, [loadRecipesFromDB]);

  // Filter recipes
  const filteredRecipes = useMemo(() => {
    let filtered = recipes;

    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter((r) => r.name.toLowerCase().includes(query));
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter((r) => r.category === categoryFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    return filtered.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }, [recipes, debouncedSearch, categoryFilter, statusFilter]);

  const toolbar = (
    <PageToolbar
      title="Recipes"
      filters={
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 w-48 border-border/60"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 w-40 border-border/60">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-36 border-border/60">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
      primaryAction={{
        label: "Add Recipe",
        icon: Plus,
        onClick: () => navigate("/menu/recipes/new"),
        variant: "primary",
      }}
    />
  );

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-6 pt-6 pb-2 space-y-4">
        <StatCards
          stats={[
            { label: "Total Recipes", value: recipes.length },
            {
              label: "Published",
              value: recipes.filter((r) => r.status === "published").length,
            },
            {
              label: "Draft",
              value: recipes.filter((r) => r.status === "draft").length,
            },
          ]}
          columns={3}
        />
      </div>
      <div className="px-6 pb-6 space-y-4">
        {/* Recipes Table */}
        {loading ? (
          <div className="rounded-xl border border-border/60 bg-card shadow-sm p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading recipes...</p>
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <ChefHat className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <h3 className="text-base font-semibold tracking-tight mb-2">
              {recipes.length === 0 ? "No recipes yet" : "No recipes found"}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              {recipes.length === 0
                ? "Create your first recipe to start tracking food costs."
                : "Try adjusting your filters"}
            </p>
            {recipes.length === 0 && (
              <Button
                onClick={() => navigate("/menu/recipes/new")}
                className="btn-press"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Recipe
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 dark:bg-slate-800/80">
                  <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                    Name
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                    Category
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                    Servings
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider font-medium text-muted-foreground">
                    Cost/Serve
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider font-medium text-muted-foreground">
                    Sell Price
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider font-medium text-muted-foreground">
                    GP %
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecipes.map((recipe) => {
                  const gpPct = recipe.gp_target_percent ?? 0;
                  const gpColor =
                    gpPct >= 65
                      ? "text-emerald-600 dark:text-emerald-400"
                      : gpPct >= 55
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-500 dark:text-red-400";
                  return (
                    <TableRow
                      key={recipe.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/menu/recipes/${recipe.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center shrink-0">
                            <ChefHat className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                          </div>
                          <span className="font-medium">{recipe.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground capitalize font-medium">
                          {CATEGORIES.find((c) => c.value === recipe.category)
                            ?.label ?? recipe.category}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {recipe.serves}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(recipe.cost_per_serve)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(recipe.suggested_price)}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums font-semibold ${gpColor}`}
                      >
                        {gpPct}%
                      </TableCell>
                      <TableCell>
                        {recipe.status === "draft" && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{" "}
                            Draft
                          </span>
                        )}
                        {recipe.status === "published" && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                            Published
                          </span>
                        )}
                        {recipe.status === "archived" && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />{" "}
                            Archived
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
