import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Send,
  Eye,
  Trash2,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  GripVertical,
  AlertTriangle,
  BookOpen,
  DollarSign,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDataStore } from "@/lib/store/dataStore";
import { useAuth } from "@/contexts/AuthContext";
import {
  calculateLineCost,
  getCompatibleUnits,
  calculatePackToBaseFactor,
  formatBaseUnitCost,
  calculateCostPerBaseUnit,
} from "@/lib/utils/unitConversions";
import { formatCurrency } from "@/lib/utils/formatters";
import { COMMON_ALLERGENS, Recipe, RecipeIngredient } from "@/types";
import { toast } from "sonner";
import { PageShell, PageToolbar } from "@/components/shared";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

const CATEGORIES = [
  { value: "mains", label: "Mains" },
  { value: "sides", label: "Sides" },
  { value: "drinks", label: "Drinks" },
  { value: "desserts", label: "Desserts" },
  { value: "prep", label: "Prep" },
  { value: "other", label: "Other" },
];

export default function RecipeEditor() {
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const isNew = recipeId === "new";

  const { currentOrg, user } = useAuth();
  const {
    recipes,
    ingredients: products,
    menuItems,
    saveRecipeToDB,
    deleteRecipeFromDB,
    getRecipeIngredients,
    loadRecipesFromDB,
  } = useDataStore();

  useEffect(() => {
    if (recipes.length === 0 && !isNew) {
      loadRecipesFromDB();
    }
  }, [recipes.length, isNew, loadRecipesFromDB]);

  const existingRecipe = !isNew ? recipes.find((r) => r.id === recipeId) : null;

  const [recipeForm, setRecipeForm] = useState({
    name: "",
    category: "mains" as Recipe["category"],
    serves: 1,
    wastage_percent: 0,
    gp_target_percent: 65,
    instructions: "",
    steps: [""] as string[],
    allergens: [] as string[],
  });

  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load existing recipe
  useEffect(() => {
    if (existingRecipe) {
      setRecipeForm({
        name: existingRecipe.name,
        category: existingRecipe.category,
        serves: existingRecipe.serves,
        wastage_percent: existingRecipe.wastage_percent,
        gp_target_percent: existingRecipe.gp_target_percent,
        instructions: existingRecipe.instructions || "",
        steps: existingRecipe.steps.length > 0 ? existingRecipe.steps : [""],
        allergens: existingRecipe.allergens,
      });
      setIngredients(getRecipeIngredients(existingRecipe.id));
    }
  }, [existingRecipe, getRecipeIngredients]);

  // ─── Costing calculations ────────────────────────
  const totalIngredientCost = useMemo(() => {
    return ingredients.reduce((sum, ing) => sum + ing.line_cost, 0);
  }, [ingredients]);

  const wasteCost = useMemo(() => {
    return Math.round(totalIngredientCost * (recipeForm.wastage_percent / 100));
  }, [totalIngredientCost, recipeForm.wastage_percent]);

  const totalBatchCost = totalIngredientCost + wasteCost;

  const costPerServe = useMemo(() => {
    return recipeForm.serves > 0
      ? Math.round(totalBatchCost / recipeForm.serves)
      : 0;
  }, [totalBatchCost, recipeForm.serves]);

  const suggestedPrice = useMemo(() => {
    const gpMultiplier = 1 - recipeForm.gp_target_percent / 100;
    return gpMultiplier > 0 ? Math.round(costPerServe / gpMultiplier) : 0;
  }, [costPerServe, recipeForm.gp_target_percent]);

  // GST: sell price is typically GST-inclusive in AU, ex-GST = price / 1.1
  const suggestedPriceIncGst = useMemo(
    () => Math.round(suggestedPrice * 1.1),
    [suggestedPrice],
  );

  // Find linked menu item for this recipe
  const linkedMenuItem = useMemo(() => {
    if (!recipeId || isNew) return null;
    return menuItems.find((mi) => mi.recipe_id === recipeId);
  }, [menuItems, recipeId, isNew]);

  const actualGpPercent = useMemo(() => {
    if (!linkedMenuItem) return null;
    const priceExGst =
      linkedMenuItem.gst_mode === "INC"
        ? Math.round(linkedMenuItem.price / 1.1)
        : linkedMenuItem.price;
    return priceExGst > 0
      ? ((priceExGst - costPerServe) / priceExGst) * 100
      : 0;
  }, [linkedMenuItem, costPerServe]);

  // ─── Auto-inherit allergens from ingredients ─────
  const inheritedAllergens = useMemo(() => {
    const inherited = new Set<string>();
    for (const line of ingredients) {
      if (line.is_sub_recipe) {
        const subRecipe = recipes.find((r) => r.id === line.sub_recipe_id);
        if (subRecipe) subRecipe.allergens.forEach((a) => inherited.add(a));
      } else {
        const product = products.find((p) => p.id === line.product_id);
        if (product?.allergens)
          product.allergens.forEach((a) => inherited.add(a));
      }
    }
    return inherited;
  }, [ingredients, products, recipes]);

  // ─── Sub-recipe circular reference check ─────────
  const wouldCreateCircularRef = useCallback(
    (subRecipeId: string): boolean => {
      if (!recipeId || isNew) return false;
      if (subRecipeId === recipeId) return true;
      // Check if subRecipe's ingredients contain current recipe
      const subIngredients = getRecipeIngredients(subRecipeId);
      return subIngredients.some(
        (ri) =>
          ri.is_sub_recipe &&
          (ri.sub_recipe_id === recipeId ||
            (ri.sub_recipe_id && wouldCreateCircularRef(ri.sub_recipe_id))),
      );
    },
    [recipeId, isNew, getRecipeIngredients],
  );

  // Published recipes available as sub-recipes
  const availableSubRecipes = useMemo(() => {
    return recipes.filter(
      (r) =>
        r.status === "published" &&
        r.id !== recipeId &&
        !wouldCreateCircularRef(r.id),
    );
  }, [recipes, recipeId, wouldCreateCircularRef]);

  // Validation
  const canPublish = useMemo(() => {
    return (
      recipeForm.name.trim() !== "" &&
      recipeForm.serves > 0 &&
      ingredients.length > 0 &&
      ingredients.every((ing) => ing.product_id || ing.is_sub_recipe) &&
      recipeForm.steps.some((s) => s.trim() !== "")
    );
  }, [recipeForm, ingredients]);

  // ─── Ingredient CRUD ─────────────────────────────
  const handleAddIngredient = () => {
    const newIngredient: RecipeIngredient = {
      id: crypto.randomUUID(),
      recipe_id: recipeId || "temp",
      product_id: "",
      product_name: "",
      quantity: 0,
      unit: "g",
      cost_per_unit: 0,
      line_cost: 0,
      unit_cost_ex_base: 0,
      product_unit: "",
      product_cost: 0,
      sort_order: ingredients.length,
    };
    setIngredients([...ingredients, newIngredient]);
  };

  const handleAddSubRecipe = () => {
    const newLine: RecipeIngredient = {
      id: crypto.randomUUID(),
      recipe_id: recipeId || "temp",
      product_id: "",
      product_name: "",
      quantity: 1,
      unit: "ea",
      cost_per_unit: 0,
      line_cost: 0,
      unit_cost_ex_base: 0,
      product_unit: "ea",
      product_cost: 0,
      is_sub_recipe: true,
      sub_recipe_id: "",
      sort_order: ingredients.length,
    };
    setIngredients([...ingredients, newLine]);
  };

  const handleIngredientChange = (
    index: number,
    field: keyof RecipeIngredient,
    value: RecipeIngredient[keyof RecipeIngredient],
  ) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };

    if (updated[index].is_sub_recipe && field === "sub_recipe_id") {
      const subRecipe = recipes.find((r) => r.id === value);
      if (subRecipe) {
        updated[index].product_name = subRecipe.name;
        updated[index].product_id = subRecipe.id;
        updated[index].line_cost =
          subRecipe.cost_per_serve * updated[index].quantity;
        updated[index].unit_cost_ex_base = subRecipe.cost_per_serve;
        updated[index].product_cost = subRecipe.cost_per_serve;
      }
    } else if (updated[index].is_sub_recipe && field === "quantity") {
      updated[index].line_cost = Math.round(
        (updated[index].unit_cost_ex_base || 0) *
          (updated[index].quantity || 0),
      );
    } else if (field === "product_id" && !updated[index].is_sub_recipe) {
      const product = products.find((p) => p.id === value);
      if (product) {
        updated[index].product_name = product.name;
        updated[index].unit = product.unit as RecipeIngredient["unit"];
        updated[index].product_unit = product.unit;
        updated[index].product_cost = product.cost_per_unit;
        const ingredientCostPerBase =
          product.unit_cost_ex_base ||
          calculateCostPerBaseUnit(
            product.cost_per_unit,
            calculatePackToBaseFactor(
              product.units_per_pack || 1,
              product.unit_size || product.pack_size || 1,
              product.unit,
            ),
          );
        updated[index].unit_cost_ex_base = ingredientCostPerBase;
        updated[index].line_cost = calculateLineCost(
          updated[index].quantity,
          updated[index].unit,
          ingredientCostPerBase,
        );
        updated[index].cost_per_unit = ingredientCostPerBase;
      }
    } else if (
      (field === "quantity" || field === "unit") &&
      !updated[index].is_sub_recipe
    ) {
      const product = products.find((p) => p.id === updated[index].product_id);
      if (product) {
        const ingredientCostPerBase =
          updated[index].unit_cost_ex_base ||
          product.unit_cost_ex_base ||
          calculateCostPerBaseUnit(
            product.cost_per_unit,
            calculatePackToBaseFactor(
              product.units_per_pack || 1,
              product.unit_size || product.pack_size || 1,
              product.unit,
            ),
          );
        updated[index].line_cost = calculateLineCost(
          updated[index].quantity,
          updated[index].unit,
          ingredientCostPerBase,
        );
      }
    }

    setIngredients(updated);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleMoveIngredient = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === ingredients.length - 1)
    )
      return;
    const updated = [...ingredients];
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    [updated[index], updated[swapIdx]] = [updated[swapIdx], updated[index]];
    setIngredients(updated);
  };

  // ─── Steps ───────────────────────────────────────
  const handleAddStep = () => {
    setRecipeForm({ ...recipeForm, steps: [...recipeForm.steps, ""] });
  };
  const handleStepChange = (index: number, value: string) => {
    const updated = [...recipeForm.steps];
    updated[index] = value;
    setRecipeForm({ ...recipeForm, steps: updated });
  };
  const handleRemoveStep = (index: number) => {
    setRecipeForm({
      ...recipeForm,
      steps: recipeForm.steps.filter((_, i) => i !== index),
    });
  };

  // ─── Allergens ───────────────────────────────────
  const toggleAllergen = (allergen: string) => {
    setRecipeForm({
      ...recipeForm,
      allergens: recipeForm.allergens.includes(allergen)
        ? recipeForm.allergens.filter((a) => a !== allergen)
        : [...recipeForm.allergens, allergen],
    });
  };

  // ─── Save ────────────────────────────────────────
  const handleSave = async (status: "draft" | "published") => {
    if (!recipeForm.name.trim()) {
      toast.error("Recipe name is required");
      return;
    }
    if (recipeForm.serves <= 0) {
      toast.error("Servings must be greater than 0");
      return;
    }
    if (status === "published" && !canPublish) {
      toast.error("Recipe must have ingredients and steps to publish");
      return;
    }

    setSaving(true);
    try {
      // Merge inherited allergens
      const allAllergens = [
        ...new Set([...recipeForm.allergens, ...inheritedAllergens]),
      ];

      const recipeData: Recipe = {
        id: isNew ? crypto.randomUUID() : recipeId!,
        organization_id: currentOrg?.id || "",
        name: recipeForm.name,
        category: recipeForm.category,
        serves: recipeForm.serves,
        wastage_percent: recipeForm.wastage_percent,
        gp_target_percent: recipeForm.gp_target_percent,
        instructions: recipeForm.instructions || undefined,
        steps: recipeForm.steps.filter((s) => s.trim() !== ""),
        allergens: allAllergens,
        status,
        total_cost: totalBatchCost,
        cost_per_serve: costPerServe,
        suggested_price: suggestedPrice,
        created_by: isNew ? user?.id || "" : existingRecipe?.created_by || "",
        created_at: isNew
          ? new Date()
          : existingRecipe?.created_at || new Date(),
        updated_at: new Date(),
        ...(status === "published" && { published_at: new Date() }),
      };

      const ingredientsWithSortOrder = ingredients.map((ing, idx) => ({
        ...ing,
        sort_order: idx,
      }));
      await saveRecipeToDB(recipeData, ingredientsWithSortOrder, isNew);
      toast.success(`Recipe ${status === "published" ? "published" : "saved"}`);
      navigate("/menu/recipes");
    } catch (error) {
      console.error("Failed to save recipe:", error);
      toast.error("Failed to save recipe. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Delete ${recipeForm.name}? This cannot be undone.`)) {
      try {
        await deleteRecipeFromDB(recipeId!);
        toast.success("Recipe deleted");
        navigate("/menu/recipes");
      } catch (error) {
        toast.error("Failed to delete recipe");
      }
    }
  };

  // ─── GP color helper ─────────────────────────────
  const getGpColor = (gp: number) => {
    if (gp >= 65) return "text-green-600";
    if (gp >= 50) return "text-amber-600";
    return "text-red-600";
  };

  // ─── Render ──────────────────────────────────────
  const toolbar = (
    <PageToolbar
      title={isNew ? "New Recipe" : recipeForm.name || "Edit Recipe"}
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/menu/recipes")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Recipes
          </Button>
          <Separator orientation="vertical" className="h-5" />
          {!isNew && existingRecipe && (
            <Badge
              variant={
                existingRecipe.status === "published" ? "default" : "secondary"
              }
              className="text-xs"
            >
              {existingRecipe.status}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="h-3.5 w-3.5 mr-1" /> Preview
          </Button>
          {!isNew && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-red-600"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => handleSave("draft")}
            disabled={saving}
          >
            <Save className="h-3.5 w-3.5 mr-1" /> Draft
          </Button>
        </>
      }
      primaryAction={{
        label: "Publish",
        icon: Send,
        onClick: () => handleSave("published"),
        disabled: !canPublish || saving,
        variant: "primary",
      }}
    />
  );

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-6 pt-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/menu/recipes">Recipes</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{recipeForm.name || "New Recipe"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT COLUMN: Editor */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Recipe Details */}
          <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Recipe Name *</Label>
                <Input
                  value={recipeForm.name}
                  onChange={(e) =>
                    setRecipeForm({ ...recipeForm, name: e.target.value })
                  }
                  placeholder="e.g., Margherita Pizza"
                />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select
                  value={recipeForm.category}
                  onValueChange={(v: Recipe["category"]) =>
                    setRecipeForm({ ...recipeForm, category: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Yield (serves)</Label>
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={recipeForm.serves}
                  onChange={(e) =>
                    setRecipeForm({
                      ...recipeForm,
                      serves: parseFloat(e.target.value) || 1,
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Waste %</Label>
                <Input
                  type="number"
                  min="0"
                  max="99"
                  value={recipeForm.wastage_percent}
                  onChange={(e) =>
                    setRecipeForm({
                      ...recipeForm,
                      wastage_percent: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* Ingredients Table */}
          <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Ingredients</h3>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleAddIngredient}
                >
                  <Plus className="h-3 w-3 mr-1" /> Ingredient
                </Button>
                {availableSubRecipes.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleAddSubRecipe}
                  >
                    <BookOpen className="h-3 w-3 mr-1" /> Sub-Recipe
                  </Button>
                )}
              </div>
            </div>

            {ingredients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <p>No ingredients yet.</p>
                <Button variant="link" size="sm" onClick={handleAddIngredient}>
                  Add first ingredient
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead className="min-w-[180px]">Ingredient</TableHead>
                    <TableHead className="w-20">Qty</TableHead>
                    <TableHead className="w-20">Unit</TableHead>
                    <TableHead className="w-24 text-right">Line Cost</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredients.map((ing, index) => (
                    <TableRow
                      key={ing.id}
                      className={
                        ing.is_sub_recipe
                          ? "bg-blue-50/50 dark:bg-blue-950/20"
                          : ""
                      }
                    >
                      <TableCell className="px-1">
                        <div className="flex flex-col gap-0.5">
                          <button
                            className="p-0.5 hover:bg-muted rounded"
                            onClick={() => handleMoveIngredient(index, "up")}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            className="p-0.5 hover:bg-muted rounded"
                            onClick={() => handleMoveIngredient(index, "down")}
                            disabled={index === ingredients.length - 1}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {ing.is_sub_recipe ? (
                          <div>
                            <span className="text-xs text-blue-600 font-medium block mb-0.5">
                              SUB-RECIPE
                            </span>
                            <Select
                              value={ing.sub_recipe_id || ""}
                              onValueChange={(v) =>
                                handleIngredientChange(
                                  index,
                                  "sub_recipe_id",
                                  v,
                                )
                              }
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select recipe..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableSubRecipes.map((r) => (
                                  <SelectItem key={r.id} value={r.id}>
                                    {r.name} ({formatCurrency(r.cost_per_serve)}
                                    /serve)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <Select
                            value={ing.product_id}
                            onValueChange={(v) =>
                              handleIngredientChange(index, "product_id", v)
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select ingredient..." />
                            </SelectTrigger>
                            <SelectContent>
                              {products
                                .filter((p) => p.active)
                                .map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} ({p.unit}) —{" "}
                                    {formatCurrency(p.cost_per_unit)}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step={ing.is_sub_recipe ? "1" : "0.1"}
                          value={ing.quantity || ""}
                          onChange={(e) =>
                            handleIngredientChange(
                              index,
                              "quantity",
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="h-8 w-20"
                        />
                      </TableCell>
                      <TableCell>
                        {ing.is_sub_recipe ? (
                          <span className="text-xs text-muted-foreground">
                            serves
                          </span>
                        ) : (
                          <Select
                            value={ing.unit}
                            onValueChange={(v: RecipeIngredient["unit"]) =>
                              handleIngredientChange(index, "unit", v)
                            }
                            disabled={!ing.product_id}
                          >
                            <SelectTrigger className="h-8 w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getCompatibleUnits(ing.product_unit || "g").map(
                                (u) => (
                                  <SelectItem key={u} value={u}>
                                    {u}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium">
                        {formatCurrency(ing.line_cost)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleRemoveIngredient(index)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Steps */}
          <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Method</h3>
              <Button size="sm" className="h-7 text-xs" onClick={handleAddStep}>
                <Plus className="h-3 w-3 mr-1" /> Step
              </Button>
            </div>
            {recipeForm.instructions !== undefined && (
              <div className="mb-3">
                <Label className="text-xs text-muted-foreground">
                  General notes (optional)
                </Label>
                <Textarea
                  value={recipeForm.instructions}
                  onChange={(e) =>
                    setRecipeForm({
                      ...recipeForm,
                      instructions: e.target.value,
                    })
                  }
                  placeholder="Tips, notes, overview..."
                  rows={2}
                  className="text-sm"
                />
              </div>
            )}
            <div className="space-y-2">
              {recipeForm.steps.map((step, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-teal-500 text-white flex items-center justify-center text-xs font-bold mt-1">
                    {index + 1}
                  </div>
                  <Textarea
                    value={step}
                    onChange={(e) => handleStepChange(index, e.target.value)}
                    placeholder={`Step ${index + 1}...`}
                    rows={2}
                    className="flex-1 text-sm"
                  />
                  {recipeForm.steps.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 mt-1"
                      onClick={() => handleRemoveStep(index)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Allergens */}
          <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">Allergens (FSANZ)</h3>
            {inheritedAllergens.size > 0 && (
              <div className="mb-3 p-2 bg-orange-50 dark:bg-orange-950/30 rounded text-xs text-orange-700 dark:text-orange-300">
                <AlertTriangle className="inline h-3 w-3 mr-1" />
                Auto-inherited from ingredients:{" "}
                {[...inheritedAllergens]
                  .map((a) => a.split(" (")[0])
                  .join(", ")}
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {COMMON_ALLERGENS.map((allergen) => {
                const isInherited = inheritedAllergens.has(allergen);
                const isChecked =
                  recipeForm.allergens.includes(allergen) || isInherited;
                return (
                  <label
                    key={allergen}
                    className={`flex items-center gap-1.5 text-xs cursor-pointer ${isInherited ? "text-orange-700 font-medium" : ""}`}
                  >
                    <Checkbox
                      checked={isChecked}
                      disabled={isInherited}
                      onCheckedChange={() =>
                        !isInherited && toggleAllergen(allergen)
                      }
                    />
                    <span>{allergen.split(" (")[0]}</span>
                    {isInherited && (
                      <span className="text-[10px] text-orange-500">
                        (auto)
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Costing Panel */}
        <div className="w-64 shrink-0 bg-slate-800 text-white p-4 flex flex-col overflow-y-auto">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            Costing
          </h3>

          {/* Cost breakdown */}
          <div className="space-y-3">
            <div>
              <span className="text-xs text-slate-400">Ingredient Cost</span>
              <p className="text-lg font-bold">
                {formatCurrency(totalIngredientCost)}
              </p>
            </div>

            {recipeForm.wastage_percent > 0 && (
              <div>
                <span className="text-xs text-slate-400">
                  + Waste ({recipeForm.wastage_percent}%)
                </span>
                <p className="text-sm font-medium text-amber-400">
                  {formatCurrency(wasteCost)}
                </p>
              </div>
            )}

            <Separator className="bg-slate-600" />

            <div>
              <span className="text-xs text-slate-400">Total Batch Cost</span>
              <p className="text-xl font-bold">
                {formatCurrency(totalBatchCost)}
              </p>
            </div>

            <div className="flex items-center gap-1 text-xs text-slate-400">
              <span>÷ {recipeForm.serves} serves</span>
            </div>

            <div>
              <span className="text-xs text-slate-400">Cost Per Serve</span>
              <p className="text-2xl font-bold text-teal-400">
                {formatCurrency(costPerServe)}
              </p>
            </div>
          </div>

          <Separator className="bg-slate-600 my-4" />

          {/* GP Target */}
          <div className="space-y-3">
            <div>
              <span className="text-xs text-slate-400">GP Target</span>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={recipeForm.gp_target_percent}
                  onChange={(e) =>
                    setRecipeForm({
                      ...recipeForm,
                      gp_target_percent: parseFloat(e.target.value) || 65,
                    })
                  }
                  className="h-7 w-16 text-sm bg-slate-700 border-slate-600 text-white"
                />
                <Percent className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-400">
                Suggested Price (ex GST)
              </span>
              <p className="text-lg font-bold text-green-400">
                {formatCurrency(suggestedPrice)}
              </p>
              <span className="text-xs text-slate-500">
                {formatCurrency(suggestedPriceIncGst)} inc GST
              </span>
            </div>
          </div>

          {/* Linked menu item */}
          {linkedMenuItem && (
            <>
              <Separator className="bg-slate-600 my-4" />
              <div className="space-y-2">
                <span className="text-xs text-slate-400">Linked Menu Item</span>
                <p className="text-sm font-medium">{linkedMenuItem.name}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Sell Price</span>
                  <span className="text-sm font-medium">
                    {formatCurrency(linkedMenuItem.price)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Actual GP%</span>
                  <span
                    className={`text-sm font-bold ${actualGpPercent !== null ? getGpColor(actualGpPercent) : ""}`}
                  >
                    {actualGpPercent !== null
                      ? `${actualGpPercent.toFixed(1)}%`
                      : "—"}
                  </span>
                </div>
              </div>
            </>
          )}

          <Separator className="bg-slate-600 my-4" />

          {/* Summary */}
          <div className="space-y-1 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Ingredients</span>
              <span>{ingredients.filter((i) => !i.is_sub_recipe).length}</span>
            </div>
            <div className="flex justify-between">
              <span>Sub-Recipes</span>
              <span>{ingredients.filter((i) => i.is_sub_recipe).length}</span>
            </div>
            <div className="flex justify-between">
              <span>Steps</span>
              <span>{recipeForm.steps.filter((s) => s.trim()).length}</span>
            </div>
            <div className="flex justify-between">
              <span>Allergens</span>
              <span>
                {new Set([...recipeForm.allergens, ...inheritedAllergens]).size}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recipe Card Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Recipe Card — {recipeForm.name || "Untitled"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 print:text-black">
            <div className="flex items-center gap-2">
              <Badge>
                {CATEGORIES.find((c) => c.value === recipeForm.category)?.label}
              </Badge>
              <Badge variant="outline">Yield: {recipeForm.serves} serves</Badge>
              <Badge variant="outline">
                Cost/Serve: {formatCurrency(costPerServe)}
              </Badge>
            </div>

            {/* Allergens */}
            {(recipeForm.allergens.length > 0 ||
              inheritedAllergens.size > 0) && (
              <div>
                <h3 className="font-semibold text-sm mb-1">Allergens</h3>
                <div className="flex flex-wrap gap-1">
                  {[
                    ...new Set([
                      ...recipeForm.allergens,
                      ...inheritedAllergens,
                    ]),
                  ].map((a) => (
                    <Badge key={a} variant="destructive" className="text-xs">
                      {a.split(" (")[0]}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Ingredients list */}
            <div>
              <h3 className="font-semibold text-sm mb-1">Ingredients</h3>
              <ul className="list-disc list-inside space-y-0.5 text-sm">
                {ingredients
                  .filter((i) => i.product_id || i.is_sub_recipe)
                  .map((ing) => (
                    <li key={ing.id}>
                      <span className="font-medium">
                        {ing.quantity}{" "}
                        {ing.is_sub_recipe ? "serve(s)" : ing.unit}
                      </span>{" "}
                      {ing.product_name}
                      {ing.is_sub_recipe && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (sub-recipe)
                        </span>
                      )}
                    </li>
                  ))}
              </ul>
            </div>

            {/* Method */}
            {recipeForm.steps.filter((s) => s.trim()).length > 0 && (
              <div>
                <h3 className="font-semibold text-sm mb-1">Method</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  {recipeForm.steps
                    .filter((s) => s.trim())
                    .map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                </ol>
              </div>
            )}

            {recipeForm.instructions && (
              <div>
                <h3 className="font-semibold text-sm mb-1">Notes</h3>
                <p className="text-sm text-muted-foreground">
                  {recipeForm.instructions}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
