"use client"

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient, apiRequest } from "@/lib/queryClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Edit, Trash2, Package } from "lucide-react"
import { formatCurrency } from "@/lib/currency"

interface Ingredient {
  id: string
  orgId: string
  name: string
  unit: string
  costPerUnitCents: number
  currentStockLevel: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface Supplier {
  id: string
  name: string
  isActive: boolean
}

interface IngredientSupplier {
  id: string
  orgId: string
  ingredientId: string
  supplierId: string
  unitPriceCents: number
  packSizeQty: string
  packSizeUnit: string
  leadTimeDays: number | null
  isPreferred: boolean
  supplierName?: string
  createdAt: string
}

const ingredientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  unit: z.string().min(1, "Unit is required"),
  costPerUnit: z.coerce.number().min(0, "Cost must be positive"),
  currentStockLevel: z.coerce.number().min(0, "Stock level must be positive"),
  isActive: z.boolean().default(true),
})

type IngredientForm = z.infer<typeof ingredientSchema>

function ManageSuppliersDialog({ ingredient }: { ingredient: Ingredient }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    supplierId: "",
    unitPrice: "",
    packSizeQty: "",
    packSizeUnit: ingredient.unit,
    leadTimeDays: "",
    isPreferred: false,
  })

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  })

  const { data: ingredientSuppliers = [], isLoading } = useQuery<IngredientSupplier[]>({
    queryKey: ["/api/ingredient-suppliers", ingredient.id],
    queryFn: async () => {
      const res = await fetch(`/api/ingredient-suppliers?ingredientId=${ingredient.id}`)
      if (!res.ok) throw new Error("Failed to fetch")
      return res.json()
    },
    enabled: open,
  })

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/ingredient-suppliers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredient-suppliers", ingredient.id] })
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] })
      toast({ title: "Supplier link created successfully" })
      resetForm()
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/ingredient-suppliers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredient-suppliers", ingredient.id] })
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] })
      toast({ title: "Supplier link deleted" })
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    },
  })

  const resetForm = () => {
    setFormData({
      supplierId: "",
      unitPrice: "",
      packSizeQty: "",
      packSizeUnit: ingredient.unit,
      leadTimeDays: "",
      isPreferred: false,
    })
  }

  const handleCreate = () => {
    createMutation.mutate({
      ingredientId: ingredient.id,
      supplierId: formData.supplierId,
      unitPriceCents: Math.round(parseFloat(formData.unitPrice) * 100),
      packSizeQty: parseFloat(formData.packSizeQty),
      packSizeUnit: formData.packSizeUnit,
      leadTimeDays: formData.leadTimeDays ? parseInt(formData.leadTimeDays) : null,
      isPreferred: formData.isPreferred,
    })
  }

  const activeSuppliers = suppliers.filter(s => s.isActive)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" data-testid={`button-manage-suppliers-${ingredient.id}`}>
          <Package className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl" data-testid={`dialog-manage-suppliers-${ingredient.id}`}>
        <DialogHeader>
          <DialogTitle>Manage Suppliers for {ingredient.name}</DialogTitle>
          <DialogDescription>
            Link suppliers with pricing and pack information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading suppliers...</div>
          ) : ingredientSuppliers.length > 0 ? (
            <div className="space-y-2">
              <Label>Linked Suppliers</Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Pack Size</TableHead>
                    <TableHead>Lead Time</TableHead>
                    <TableHead>Preferred</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredientSuppliers.map((is) => (
                    <TableRow key={is.id} data-testid={`row-supplier-link-${is.id}`}>
                      <TableCell>{is.supplierName}</TableCell>
                      <TableCell>{formatCurrency(is.unitPriceCents, { inCents: true })}</TableCell>
                      <TableCell>
                        {is.packSizeQty} {is.packSizeUnit}
                      </TableCell>
                      <TableCell>{is.leadTimeDays ? `${is.leadTimeDays} days` : "—"}</TableCell>
                      <TableCell>
                        {is.isPreferred && <Badge variant="default">Preferred</Badge>}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(is.id)}
                          data-testid={`button-delete-supplier-link-${is.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No suppliers linked yet. Add one below.
            </div>
          )}

          <div className="border-t pt-4 space-y-4">
            <Label>Add Supplier</Label>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="supplier">Supplier</Label>
                <Select value={formData.supplierId} onValueChange={(v) => setFormData({ ...formData, supplierId: v })}>
                  <SelectTrigger data-testid="select-supplier">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeSuppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="unitPrice">Unit Price (A$)</Label>
                  <Input
                    id="unitPrice"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.unitPrice}
                    onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                    data-testid="input-unit-price"
                  />
                </div>
                <div>
                  <Label htmlFor="leadTimeDays">Lead Time (days)</Label>
                  <Input
                    id="leadTimeDays"
                    type="number"
                    placeholder="e.g., 3"
                    value={formData.leadTimeDays}
                    onChange={(e) => setFormData({ ...formData, leadTimeDays: e.target.value })}
                    data-testid="input-lead-time"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="packSizeQty">Pack Size Quantity</Label>
                  <Input
                    id="packSizeQty"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 10"
                    value={formData.packSizeQty}
                    onChange={(e) => setFormData({ ...formData, packSizeQty: e.target.value })}
                    data-testid="input-pack-qty"
                  />
                </div>
                <div>
                  <Label htmlFor="packSizeUnit">Pack Size Unit</Label>
                  <Input
                    id="packSizeUnit"
                    placeholder={ingredient.unit}
                    value={formData.packSizeUnit}
                    onChange={(e) => setFormData({ ...formData, packSizeUnit: e.target.value })}
                    data-testid="input-pack-unit"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isPreferred"
                  checked={formData.isPreferred}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPreferred: checked })}
                  data-testid="switch-preferred"
                />
                <Label htmlFor="isPreferred">Mark as preferred supplier</Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!formData.supplierId || !formData.unitPrice || !formData.packSizeQty || createMutation.isPending}
            data-testid="button-add-supplier-link"
          >
            {createMutation.isPending ? "Adding..." : "Add Supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function IngredientDialog({ item, onSuccess }: { item?: Ingredient; onSuccess: () => void }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)

  const form = useForm<IngredientForm>({
    resolver: zodResolver(ingredientSchema),
    defaultValues: {
      name: item?.name || "",
      unit: item?.unit || "",
      costPerUnit: item ? item.costPerUnitCents / 100 : 0,
      currentStockLevel: item ? parseFloat(item.currentStockLevel) : 0,
      isActive: item?.isActive ?? true,
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: IngredientForm) => {
      const payload = {
        name: data.name,
        unit: data.unit,
        costPerUnitCents: Math.round(data.costPerUnit * 100),
        currentStockLevel: data.currentStockLevel.toString(),
        isActive: data.isActive,
      }
      if (item) {
        return apiRequest("PATCH", `/api/ingredients/${item.id}`, payload)
      } else {
        return apiRequest("POST", "/api/ingredients", payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] })
      toast({
        title: "Success",
        description: `Ingredient ${item ? "updated" : "created"} successfully`,
      })
      setOpen(false)
      form.reset()
      onSuccess()
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item ? (
          <Button variant="ghost" size="icon" data-testid={`button-edit-${item.id}`}>
            <Edit className="h-4 w-4" />
          </Button>
        ) : (
          <Button data-testid="button-create-ingredient">
            <Plus className="h-4 w-4 mr-2" />
            Add Ingredient
          </Button>
        )}
      </DialogTrigger>
      <DialogContent data-testid="dialog-ingredient">
        <DialogHeader>
          <DialogTitle>{item ? "Edit" : "Create"} Ingredient</DialogTitle>
          <DialogDescription>
            {item ? "Update" : "Add a new"} ingredient to your inventory
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Chicken Breast" data-testid="input-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., kg, L, unit" data-testid="input-unit" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="costPerUnit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cost per Unit (A$)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      data-testid="input-cost"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currentStockLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Stock Level</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      step="0.01"
                      placeholder="0"
                      data-testid="input-stock"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <FormLabel>Active</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-active"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-submit">
                {mutation.isPending ? "Saving..." : item ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteIngredient({ item }: { item: Ingredient }) {
  const { toast } = useToast()

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/ingredients/${item.id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] })
      toast({
        title: "Success",
        description: "Ingredient deleted successfully",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => deleteMutation.mutate()}
      disabled={deleteMutation.isPending}
      data-testid={`button-delete-${item.id}`}
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  )
}

export default function IngredientsPage() {
  const { data: ingredients, isLoading } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
  })

  // Fetch all ingredient-supplier links to show best prices
  const { data: allIngredientSuppliers = [] } = useQuery<IngredientSupplier[]>({
    queryKey: ["/api/ingredient-suppliers"],
  })

  // Group by ingredientId and find cheapest
  const bestPrices = new Map<string, number>()
  allIngredientSuppliers.forEach((is) => {
    const current = bestPrices.get(is.ingredientId)
    if (!current || is.unitPriceCents < current) {
      bestPrices.set(is.ingredientId, is.unitPriceCents)
    }
  })

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ingredients</h1>
          <p className="text-muted-foreground">
            Manage your ingredients, costs, and stock levels
          </p>
        </div>
        <IngredientDialog onSuccess={() => {}} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Ingredients</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !ingredients || ingredients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No ingredients yet. Create your first one!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Cost/Unit</TableHead>
                  <TableHead>Stock Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((item) => {
                  const bestPrice = bestPrices.get(item.id)
                  return (
                    <TableRow key={item.id} data-testid={`row-ingredient-${item.id}`}>
                      <TableCell className="font-medium" data-testid={`text-name-${item.id}`}>
                        {item.name}
                      </TableCell>
                      <TableCell data-testid={`text-unit-${item.id}`}>{item.unit}</TableCell>
                      <TableCell data-testid={`text-cost-${item.id}`}>
                        <div className="flex items-center gap-2">
                          <span>{formatCurrency(item.costPerUnitCents, { inCents: true })}</span>
                          {bestPrice !== undefined && (
                            <Badge variant="outline" className="text-xs" data-testid={`badge-best-cost-${item.id}`}>
                              Best: {formatCurrency(bestPrice, { inCents: true })}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-stock-${item.id}`}>
                        {parseFloat(item.currentStockLevel).toFixed(2)} {item.unit}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.isActive ? "default" : "secondary"} data-testid={`badge-status-${item.id}`}>
                          {item.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <ManageSuppliersDialog ingredient={item} />
                          <IngredientDialog item={item} onSuccess={() => {}} />
                          <DeleteIngredient item={item} />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
