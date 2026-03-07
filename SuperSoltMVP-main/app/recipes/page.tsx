"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, Save, AlertCircle } from "lucide-react"
import { formatCurrency } from "@/lib/currency"

interface MenuItem {
  id: string
  name: string
  priceCents: number
  isActive: boolean
}

interface Ingredient {
  id: string
  name: string
  unit: string
  isActive: boolean
}

interface RecipeLine {
  id: string
  ingredientId: string | null
  subMenuItemId: string | null
  qty: string
  unit: string
  ingredientName?: string
  subMenuItemName?: string
}

interface Recipe {
  id: string
  menuItemId: string
  yieldQty: string
  yieldUnit: string | null
  wastagePct: string
  lines: RecipeLine[]
}

export default function RecipesPage() {
  const { toast } = useToast()
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>("")
  const [recipeData, setRecipeData] = useState({
    yieldQty: "1",
    yieldUnit: "",
    wastagePct: "0",
  })
  const [newLine, setNewLine] = useState({
    type: "ingredient" as "ingredient" | "menuItem",
    ingredientId: "",
    subMenuItemId: "",
    qty: "",
    unit: "",
  })

  const { data: menuItems = [] } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu-items"],
  })

  const { data: ingredients = [] } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  })

  const { data: recipe, isLoading: isLoadingRecipe } = useQuery<Recipe | null>({
    queryKey: ["/api/recipes", selectedMenuItemId],
    queryFn: async () => {
      if (!selectedMenuItemId) return null
      const res = await fetch(`/api/recipes?menuItemId=${selectedMenuItemId}`)
      if (!res.ok) {
        if (res.status === 404) return null
        throw new Error("Failed to fetch recipe")
      }
      return res.json()
    },
    enabled: !!selectedMenuItemId,
  })

  const { data: costData } = useQuery<{
    costCents: number | null
    foodCostPct: number | null
    lines: number
    warnings: string[]
  }>({
    queryKey: ["/api/recipes/cost", selectedMenuItemId],
    queryFn: async () => {
      if (!selectedMenuItemId) return { costCents: null, foodCostPct: null, lines: 0, warnings: [] }
      const res = await fetch(`/api/recipes/cost?menuItemId=${selectedMenuItemId}`)
      if (!res.ok) {
        const data = await res.json()
        return data
      }
      return res.json()
    },
    enabled: !!selectedMenuItemId,
    refetchInterval: 2000,
  })

  useEffect(() => {
    if (recipe) {
      setRecipeData({
        yieldQty: recipe.yieldQty,
        yieldUnit: recipe.yieldUnit || "",
        wastagePct: recipe.wastagePct,
      })
    } else if (selectedMenuItemId) {
      setRecipeData({
        yieldQty: "1",
        yieldUnit: "",
        wastagePct: "0",
      })
    }
  }, [recipe, selectedMenuItemId])

  const createOrUpdateRecipeMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/recipes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes", selectedMenuItemId] })
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items"] })
      toast({ title: "Recipe saved successfully" })
    },
    onError: (error: any) => {
      toast({ title: "Error saving recipe", description: error.message, variant: "destructive" })
    },
  })

  const addLineMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/recipe-lines", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes", selectedMenuItemId] })
      queryClient.invalidateQueries({ queryKey: ["/api/recipes/cost", selectedMenuItemId] })
      setNewLine({
        type: "ingredient",
        ingredientId: "",
        subMenuItemId: "",
        qty: "",
        unit: "",
      })
      toast({ title: "Line added successfully" })
    },
    onError: (error: any) => {
      toast({ title: "Error adding line", description: error.message, variant: "destructive" })
    },
  })

  const deleteLineMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/recipe-lines/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes", selectedMenuItemId] })
      queryClient.invalidateQueries({ queryKey: ["/api/recipes/cost", selectedMenuItemId] })
      toast({ title: "Line deleted successfully" })
    },
    onError: (error: any) => {
      toast({ title: "Error deleting line", description: error.message, variant: "destructive" })
    },
  })

  const handleSaveRecipe = () => {
    if (!selectedMenuItemId) {
      toast({ title: "Please select a menu item first", variant: "destructive" })
      return
    }
    createOrUpdateRecipeMutation.mutate({
      menuItemId: selectedMenuItemId,
      yieldQty: parseFloat(recipeData.yieldQty),
      yieldUnit: recipeData.yieldUnit || null,
      wastagePct: parseFloat(recipeData.wastagePct),
    })
  }

  const handleAddLine = () => {
    if (!recipe?.id) {
      toast({ title: "Please save recipe first", variant: "destructive" })
      return
    }

    const lineData: any = {
      recipeId: recipe.id,
      qty: parseFloat(newLine.qty),
      unit: newLine.unit,
    }

    if (newLine.type === "ingredient") {
      if (!newLine.ingredientId) {
        toast({ title: "Please select an ingredient", variant: "destructive" })
        return
      }
      lineData.ingredientId = newLine.ingredientId
    } else {
      if (!newLine.subMenuItemId) {
        toast({ title: "Please select a menu item", variant: "destructive" })
        return
      }
      lineData.subMenuItemId = newLine.subMenuItemId
    }

    addLineMutation.mutate(lineData)
  }

  const selectedMenuItem = menuItems.find(m => m.id === selectedMenuItemId)
  const activeMenuItems = menuItems.filter(m => m.isActive)
  const activeIngredients = ingredients.filter(i => i.isActive)

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Recipe Builder</h1>
        <p className="text-muted-foreground">Create and manage recipes with ingredients and nested menu items</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Menu Item</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedMenuItemId} onValueChange={setSelectedMenuItemId}>
                <SelectTrigger data-testid="select-menu-item">
                  <SelectValue placeholder="Select a menu item to build recipe for" />
                </SelectTrigger>
                <SelectContent>
                  {activeMenuItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} — {formatCurrency(item.priceCents, { inCents: true })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedMenuItemId && (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Recipe Settings</CardTitle>
                    <Button onClick={handleSaveRecipe} disabled={createOrUpdateRecipeMutation.isPending} data-testid="button-save-recipe">
                      <Save className="h-4 w-4 mr-2" />
                      {createOrUpdateRecipeMutation.isPending ? "Saving..." : "Save Recipe"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="yieldQty">Yield Quantity</Label>
                      <Input
                        id="yieldQty"
                        type="number"
                        step="0.01"
                        value={recipeData.yieldQty}
                        onChange={(e) => setRecipeData({ ...recipeData, yieldQty: e.target.value })}
                        data-testid="input-yield-qty"
                      />
                    </div>
                    <div>
                      <Label htmlFor="yieldUnit">Yield Unit</Label>
                      <Input
                        id="yieldUnit"
                        value={recipeData.yieldUnit}
                        onChange={(e) => setRecipeData({ ...recipeData, yieldUnit: e.target.value })}
                        placeholder="e.g., serves, portions"
                        data-testid="input-yield-unit"
                      />
                    </div>
                    <div>
                      <Label htmlFor="wastagePct">Wastage %</Label>
                      <Input
                        id="wastagePct"
                        type="number"
                        step="0.1"
                        value={recipeData.wastagePct}
                        onChange={(e) => setRecipeData({ ...recipeData, wastagePct: e.target.value })}
                        data-testid="input-wastage-pct"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recipe Lines ({recipe?.lines?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoadingRecipe ? (
                    <div className="text-center py-8 text-muted-foreground">Loading recipe...</div>
                  ) : recipe?.lines && recipe.lines.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recipe.lines.map((line) => (
                          <TableRow key={line.id} data-testid={`row-recipe-line-${line.id}`}>
                            <TableCell>
                              <Badge variant={line.ingredientId ? "default" : "secondary"}>
                                {line.ingredientId ? "Ingredient" : "Menu Item"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {line.ingredientName || line.subMenuItemName}
                            </TableCell>
                            <TableCell>{parseFloat(line.qty).toFixed(2)}</TableCell>
                            <TableCell>{line.unit}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteLineMutation.mutate(line.id)}
                                data-testid={`button-delete-line-${line.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No recipe lines yet. Add ingredients or menu items below.
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-4">
                    <Label>Add Line</Label>
                    <div className="grid gap-4">
                      <div>
                        <Label>Type</Label>
                        <Select
                          value={newLine.type}
                          onValueChange={(v: "ingredient" | "menuItem") => setNewLine({ ...newLine, type: v })}
                        >
                          <SelectTrigger data-testid="select-line-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ingredient">Ingredient</SelectItem>
                            <SelectItem value="menuItem">Menu Item (Nested)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {newLine.type === "ingredient" ? (
                        <div>
                          <Label>Ingredient</Label>
                          <Select
                            value={newLine.ingredientId}
                            onValueChange={(v) => {
                              const ing = activeIngredients.find(i => i.id === v)
                              setNewLine({ ...newLine, ingredientId: v, unit: ing?.unit || "" })
                            }}
                          >
                            <SelectTrigger data-testid="select-ingredient">
                              <SelectValue placeholder="Select ingredient" />
                            </SelectTrigger>
                            <SelectContent>
                              {activeIngredients.map((ing) => (
                                <SelectItem key={ing.id} value={ing.id}>
                                  {ing.name} ({ing.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div>
                          <Label>Menu Item</Label>
                          <Select
                            value={newLine.subMenuItemId}
                            onValueChange={(v) => setNewLine({ ...newLine, subMenuItemId: v, unit: "unit" })}
                          >
                            <SelectTrigger data-testid="select-sub-menu-item">
                              <SelectValue placeholder="Select menu item" />
                            </SelectTrigger>
                            <SelectContent>
                              {activeMenuItems
                                .filter(m => m.id !== selectedMenuItemId)
                                .map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            step="0.001"
                            placeholder="0"
                            value={newLine.qty}
                            onChange={(e) => setNewLine({ ...newLine, qty: e.target.value })}
                            data-testid="input-line-qty"
                          />
                        </div>
                        <div>
                          <Label>Unit</Label>
                          <Input
                            value={newLine.unit}
                            onChange={(e) => setNewLine({ ...newLine, unit: e.target.value })}
                            placeholder="e.g., kg, L, unit"
                            data-testid="input-line-unit"
                          />
                        </div>
                      </div>

                      <Button
                        onClick={handleAddLine}
                        disabled={!newLine.qty || !newLine.unit || addLineMutation.isPending}
                        data-testid="button-add-line"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {addLineMutation.isPending ? "Adding..." : "Add Line"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {selectedMenuItemId && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cost Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Menu Item</Label>
                  <p className="text-lg font-medium">{selectedMenuItem?.name}</p>
                </div>

                <Separator />

                <div>
                  <Label className="text-muted-foreground">Selling Price</Label>
                  <p className="text-lg font-medium" data-testid="text-selling-price">
                    {selectedMenuItem ? formatCurrency(selectedMenuItem.priceCents, { inCents: true }) : "—"}
                  </p>
                </div>

                <div>
                  <Label className="text-muted-foreground">Theoretical Cost</Label>
                  <p className="text-2xl font-bold" data-testid="text-theoretical-cost">
                    {costData?.costCents !== null && costData?.costCents !== undefined
                      ? formatCurrency(costData.costCents, { inCents: true })
                      : "—"}
                  </p>
                </div>

                <div>
                  <Label className="text-muted-foreground">Food Cost %</Label>
                  <p className="text-2xl font-bold" data-testid="text-food-cost-pct">
                    {costData?.foodCostPct !== null && costData?.foodCostPct !== undefined
                      ? `${costData.foodCostPct.toFixed(1)}%`
                      : "—"}
                  </p>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Yield</Label>
                    <p className="font-medium">
                      {recipeData.yieldQty} {recipeData.yieldUnit || "unit"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Wastage</Label>
                    <p className="font-medium">{recipeData.wastagePct}%</p>
                  </div>
                </div>

                {costData?.warnings && costData.warnings.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Warnings
                      </Label>
                      {costData.warnings.map((warning, idx) => (
                        <p key={idx} className="text-sm text-muted-foreground">{warning}</p>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
