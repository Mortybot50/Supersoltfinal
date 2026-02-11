import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Search, Package, Pencil, TrendingUp, TrendingDown, AlertTriangle, Loader2 } from "lucide-react"
import { useDataStore } from "@/lib/store/dataStore"
import { useAuth } from "@/contexts/AuthContext"
import { formatCurrency } from "@/lib/utils/formatters"
import { formatBaseUnitCost, calculateCostPerBaseUnit, calculatePackToBaseFactor } from "@/lib/utils/unitConversions"
import { logPriceChange, runCostCascade, applyCascadeToState } from "@/lib/services/costCascade"
import { toast } from "sonner"
import { PageShell, PageToolbar, PageSidebar } from "@/components/shared"
import { COMMON_ALLERGENS } from "@/types"
import { getDefaultOrgSettings } from "@/lib/venueSettings"
import type { Ingredient } from "@/types"

const CATEGORIES = [
  { value: "produce", label: "Produce" },
  { value: "meat", label: "Protein" },
  { value: "seafood", label: "Seafood" },
  { value: "dairy", label: "Dairy" },
  { value: "dry-goods", label: "Dry Goods" },
  { value: "beverages", label: "Beverages" },
  { value: "other", label: "Other" },
] as const

const UNITS = [
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "L", label: "L" },
  { value: "mL", label: "mL" },
  { value: "ea", label: "each" },
] as const

const emptyForm = {
  name: "",
  category: "produce" as string,
  unit: "kg" as string,
  stock: "",
  parLevel: "",
  cost: "",
  packSize: "1",
  unitsPerPack: "1",
  unitSize: "1",
  wastePercent: "0",
  supplierName: "",
  productCode: "",
  gstApplicable: true,
  allergens: [] as string[],
}

export default function Ingredients() {
  const { currentVenue } = useAuth()
  const {
    ingredients, recipes, recipeIngredients, menuItems, isLoading,
    addIngredient, updateIngredient, loadIngredientsFromDB,
    setIngredients: setStoreIngredients, setRecipes, setRecipeIngredients: setStoreRecipeIngredients, setMenuItems,
  } = useDataStore()
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState(emptyForm)

  useEffect(() => {
    loadIngredientsFromDB()
  }, [])

  const gpThreshold = getDefaultOrgSettings().below_gp_threshold_alert_percent ?? 60

  // ─── Edit handler ────────────────────────────────
  const openEdit = useCallback((ing: Ingredient) => {
    setEditingId(ing.id)
    setFormData({
      name: ing.name,
      category: ing.category,
      unit: ing.unit,
      stock: String(ing.current_stock),
      parLevel: String(ing.par_level),
      cost: String(ing.cost_per_unit / 100),
      packSize: String(ing.pack_size ?? 1),
      unitsPerPack: String(ing.units_per_pack ?? 1),
      unitSize: String(ing.unit_size ?? 1),
      wastePercent: String(ing.default_waste_percent ?? 0),
      supplierName: ing.supplier_name ?? "",
      productCode: ing.product_code ?? "",
      gstApplicable: ing.gst_applicable ?? true,
      allergens: ing.allergens ?? [],
    })
    setOpen(true)
  }, [])

  const openAdd = () => {
    setEditingId(null)
    setFormData(emptyForm)
    setOpen(true)
  }

  // ─── Save (add or edit) ──────────────────────────
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Ingredient name is required")
      return
    }
    const costCents = Math.round((parseFloat(formData.cost) || 0) * 100)
    const unitsPerPack = parseFloat(formData.unitsPerPack) || 1
    const unitSize = parseFloat(formData.unitSize) || 1
    const packToBaseFactor = calculatePackToBaseFactor(unitsPerPack, unitSize, formData.unit)
    const unitCostExBase = calculateCostPerBaseUnit(costCents, packToBaseFactor)
    const wastePercent = parseFloat(formData.wastePercent) || 0

    const data: Partial<Ingredient> & { venue_id: string } = {
      venue_id: currentVenue?.id || "venue-1",
      name: formData.name.trim(),
      category: formData.category as Ingredient["category"],
      unit: formData.unit as Ingredient["unit"],
      current_stock: parseFloat(formData.stock) || 0,
      par_level: parseFloat(formData.parLevel) || 0,
      reorder_point: Math.round((parseFloat(formData.parLevel) || 0) * 0.5),
      cost_per_unit: costCents,
      units_per_pack: unitsPerPack,
      unit_size: unitSize,
      pack_to_base_factor: packToBaseFactor,
      unit_cost_ex_base: unitCostExBase,
      supplier_name: formData.supplierName || undefined,
      product_code: formData.productCode || undefined,
      gst_applicable: formData.gstApplicable,
      default_waste_percent: wastePercent,
      allergens: formData.allergens,
      last_cost_update: new Date(),
      active: true,
    }

    try {
      if (editingId) {
        const existing = ingredients.find((i) => i.id === editingId)
        const oldCost = existing?.cost_per_unit ?? null
        await updateIngredient(editingId, data)

        // Cost cascade if price changed
        if (oldCost !== null && oldCost !== costCents) {
          await logPriceChange(editingId, oldCost, costCents, "manual")
          const cascade = runCostCascade(editingId, costCents, unitCostExBase, ingredients, recipes, recipeIngredients, menuItems, gpThreshold)
          if (cascade.affectedRecipes.length > 0) {
            const applied = applyCascadeToState(cascade, ingredients, recipes, recipeIngredients, menuItems, costCents, unitCostExBase)
            setStoreIngredients(applied.ingredients)
            setRecipes(applied.recipes)
            setStoreRecipeIngredients(applied.recipeIngredients)
            setMenuItems(applied.menuItems)
            const alertCount = cascade.gpAlerts.length
            toast.success(
              `Updated ${formData.name}. ${cascade.affectedRecipes.length} recipe(s) recalculated.${alertCount > 0 ? ` ${alertCount} GP alert(s)!` : ""}`
            )
          } else {
            toast.success(`${formData.name} updated`)
          }
        } else {
          toast.success(`${formData.name} updated`)
        }
      } else {
        await addIngredient({ id: crypto.randomUUID(), ...data } as Ingredient)
        toast.success(`${formData.name} added`)
      }
      setOpen(false)
    } catch (err) {
      toast.error("Failed to save ingredient")
    }
  }

  const toggleAllergen = (allergen: string) => {
    setFormData((prev) => ({
      ...prev,
      allergens: prev.allergens.includes(allergen)
        ? prev.allergens.filter((a) => a !== allergen)
        : [...prev.allergens, allergen],
    }))
  }

  // ─── Computed ────────────────────────────────────
  const filtered = useMemo(() => {
    return ingredients
      .filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase())
        const matchesCategory = categoryFilter === "all" || item.category === categoryFilter
        return matchesSearch && matchesCategory && item.active
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [ingredients, search, categoryFilter])

  const lowStockCount = useMemo(() => {
    return ingredients.filter((i) => i.current_stock <= i.reorder_point && i.active).length
  }, [ingredients])

  const totalStockValue = useMemo(() => {
    return ingredients.reduce((sum, i) => {
      if (!i.active) return sum
      return sum + Math.round(i.current_stock * i.cost_per_unit)
    }, 0)
  }, [ingredients])

  // ─── Effective cost (with waste factor) ──────────
  const effectiveCost = (ing: Ingredient) => {
    const waste = ing.default_waste_percent ?? 0
    if (waste <= 0 || waste >= 100) return ing.cost_per_unit
    return Math.round(ing.cost_per_unit / (1 - waste / 100))
  }

  const formatPackInfo = (ing: Ingredient) => {
    const up = ing.units_per_pack ?? 1
    const us = ing.unit_size ?? 1
    if (up === 1 && us === 1) return null
    const sizeStr = us % 1 === 0 ? us.toFixed(0) : String(us)
    const packStr = up === 1 ? `${sizeStr}${ing.unit}` : `${up}×${sizeStr}${ing.unit}`
    return `${packStr} @ ${formatCurrency(ing.cost_per_unit)}`
  }

  // ─── Layout ──────────────────────────────────────
  const sidebar = (
    <PageSidebar
      title="Ingredients"
      metrics={[
        { label: "Total Items", value: ingredients.filter((i) => i.active).length },
        { label: "Low Stock", value: lowStockCount, color: lowStockCount > 0 ? "orange" : "default" },
        { label: "Stock Value", value: formatCurrency(totalStockValue) },
      ]}
      extendedMetrics={[
        { label: "Categories", value: new Set(ingredients.map((i) => i.category)).size },
      ]}
    />
  )

  const toolbar = (
    <PageToolbar
      title="Ingredients"
      filters={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-[200px] pl-8 text-sm" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
      primaryAction={{ label: "Add Ingredient", icon: Plus, onClick: openAdd, variant: "primary" }}
    />
  )

  return (
    <PageShell sidebar={sidebar} toolbar={toolbar}>
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Par</TableHead>
              <TableHead className="text-right">Cost / Unit</TableHead>
              <TableHead className="text-right">Eff. Cost</TableHead>
              <TableHead className="text-right">Waste %</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && ingredients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground h-32">
                  <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
                  <p>Loading ingredients...</p>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground h-32">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{search || categoryFilter !== "all" ? "No ingredients match your filters" : "No ingredients yet. Click 'Add Ingredient' to get started."}</p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => {
                const packInfo = formatPackInfo(item)
                const effCost = effectiveCost(item)
                const hasWaste = (item.default_waste_percent ?? 0) > 0
                const isLow = item.current_stock <= item.reorder_point
                return (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(item)}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{item.name}</span>
                        {packInfo && <span className="block text-xs text-muted-foreground">{packInfo}</span>}
                        {item.allergens && item.allergens.length > 0 && (
                          <span className="block text-xs text-orange-600 mt-0.5">
                            <AlertTriangle className="inline h-3 w-3 mr-0.5" />
                            {item.allergens.length} allergen{item.allergens.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 capitalize">
                        {CATEGORIES.find((c) => c.value === item.category)?.label ?? item.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{item.unit}</TableCell>
                    <TableCell className={`text-right tabular-nums ${isLow ? "text-orange-600 font-medium" : ""}`}>
                      {item.current_stock}
                      {isLow && <TrendingDown className="inline h-3 w-3 ml-1" />}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.par_level}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="font-medium">{formatCurrency(item.cost_per_unit)}</span>
                      {item.unit_cost_ex_base != null && item.unit_cost_ex_base > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          {formatBaseUnitCost(item.unit_cost_ex_base, item.base_unit || item.unit)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${hasWaste ? "text-amber-600" : ""}`}>
                      {hasWaste ? formatCurrency(effCost) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {hasWaste ? `${item.default_waste_percent}%` : "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); openEdit(item) }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Ingredient" : "Add Ingredient"}</DialogTitle>
            <DialogDescription>{editingId ? "Update ingredient details" : "Add a new ingredient to your inventory"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Chicken Breast" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Base Unit</Label>
                <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">PACK & PRICING</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Units / Pack</Label>
                  <Input type="number" min="1" step="1" value={formData.unitsPerPack} onChange={(e) => setFormData({ ...formData, unitsPerPack: e.target.value })} />
                </div>
                <div>
                  <Label>Unit Size</Label>
                  <Input type="number" min="0.01" step="0.01" value={formData.unitSize} onChange={(e) => setFormData({ ...formData, unitSize: e.target.value })} />
                </div>
                <div>
                  <Label>Pack Cost ($)</Label>
                  <Input type="number" step="0.01" value={formData.cost} onChange={(e) => setFormData({ ...formData, cost: e.target.value })} />
                </div>
              </div>
              {parseFloat(formData.cost) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  = {formatBaseUnitCost(
                    calculateCostPerBaseUnit(
                      Math.round(parseFloat(formData.cost) * 100),
                      calculatePackToBaseFactor(parseFloat(formData.unitsPerPack) || 1, parseFloat(formData.unitSize) || 1, formData.unit)
                    ),
                    formData.unit === "kg" || formData.unit === "g" ? "g" : formData.unit === "L" || formData.unit === "mL" ? "mL" : "ea"
                  )}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Current Stock</Label>
                <Input type="number" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} />
              </div>
              <div>
                <Label>Par Level</Label>
                <Input type="number" value={formData.parLevel} onChange={(e) => setFormData({ ...formData, parLevel: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Waste / Trim %</Label>
                <Input type="number" min="0" max="99" step="1" value={formData.wastePercent} onChange={(e) => setFormData({ ...formData, wastePercent: e.target.value })} placeholder="0" />
                {parseFloat(formData.wastePercent) > 0 && parseFloat(formData.cost) > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Effective cost: {formatCurrency(
                      Math.round(Math.round(parseFloat(formData.cost) * 100) / (1 - parseFloat(formData.wastePercent) / 100))
                    )}
                  </p>
                )}
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={formData.gstApplicable} onCheckedChange={(v) => setFormData({ ...formData, gstApplicable: !!v })} />
                  GST applicable
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Supplier</Label>
                <Input value={formData.supplierName} onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <Label>Product Code</Label>
                <Input value={formData.productCode} onChange={(e) => setFormData({ ...formData, productCode: e.target.value })} placeholder="SKU" />
              </div>
            </div>

            {/* Allergens */}
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">ALLERGENS</p>
              <div className="flex flex-wrap gap-2">
                {COMMON_ALLERGENS.map((a) => (
                  <label key={a} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <Checkbox checked={formData.allergens.includes(a)} onCheckedChange={() => toggleAllergen(a)} />
                    <span>{a.split(" (")[0]}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
              {editingId ? "Save Changes" : "Add Ingredient"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
