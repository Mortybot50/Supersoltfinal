"use client"

import { useState, useEffect } from "react"
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
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Edit, Trash2 } from "lucide-react"
import { formatCurrency } from "@/lib/currency"

interface MenuItem {
  id: string
  orgId: string
  name: string
  priceCents: number
  isComposite: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface CostData {
  costCents: number | null
  foodCostPct: number | null
}

const menuItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.coerce.number().min(0, "Price must be positive"),
  isActive: z.boolean().default(true),
})

type MenuItemForm = z.infer<typeof menuItemSchema>

function MenuItemDialog({ item, costData, onSuccess }: { item?: MenuItem; costData?: CostData; onSuccess: () => void }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)

  const form = useForm<MenuItemForm>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      name: item?.name || "",
      price: item ? item.priceCents / 100 : 0,
      isActive: item?.isActive ?? true,
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: MenuItemForm) => {
      const payload = {
        name: data.name,
        priceCents: Math.round(data.price * 100),
        isActive: data.isActive,
      }
      if (item) {
        return apiRequest("PATCH", `/api/menu-items/${item.id}`, payload)
      } else {
        return apiRequest("POST", "/api/menu-items", payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items"] })
      toast({
        title: "Success",
        description: `Menu item ${item ? "updated" : "created"} successfully`,
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
          <Button data-testid="button-create-menu-item">
            <Plus className="h-4 w-4 mr-2" />
            Add Menu Item
          </Button>
        )}
      </DialogTrigger>
      <DialogContent data-testid="dialog-menu-item">
        <DialogHeader>
          <DialogTitle>{item ? "Edit" : "Create"} Menu Item</DialogTitle>
          <DialogDescription>
            {item ? "Update" : "Add a new"} menu item to your inventory
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
                    <Input {...field} placeholder="e.g., Fish & Chips" data-testid="input-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (A$)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      data-testid="input-price"
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

            {item && costData && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Costing Information</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Theoretical Cost</Label>
                      <p className="text-lg font-medium" data-testid="text-dialog-cost">
                        {costData.costCents !== null ? formatCurrency(costData.costCents, { inCents: true }) : "—"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Food Cost %</Label>
                      <p className="text-lg font-medium" data-testid="text-dialog-food-cost-pct">
                        {costData.foodCostPct !== null ? `${costData.foodCostPct.toFixed(1)}%` : "—"}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Has Recipe</Label>
                    <p className="text-sm">
                      <Badge variant={item.isComposite ? "default" : "secondary"}>
                        {item.isComposite ? "Yes" : "No"}
                      </Badge>
                    </p>
                  </div>
                </div>
              </>
            )}

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

function DeleteMenuItem({ item }: { item: MenuItem }) {
  const { toast } = useToast()

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/menu-items/${item.id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items"] })
      toast({
        title: "Success",
        description: "Menu item deleted successfully",
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

export default function MenuItemsPage() {
  const [costDataMap, setCostDataMap] = useState<Record<string, CostData>>({})

  const { data: menuItems, isLoading } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu-items"],
  })

  // Fetch cost data for all menu items with recipes
  useEffect(() => {
    if (!menuItems) return

    const fetchCosts = async () => {
      const costs: Record<string, CostData> = {}
      
      for (const item of menuItems) {
        if (item.isComposite) {
          try {
            const res = await fetch(`/api/recipes/cost?menuItemId=${item.id}`)
            if (res.ok) {
              const data = await res.json()
              costs[item.id] = {
                costCents: data.costCents,
                foodCostPct: data.foodCostPct,
              }
            }
          } catch (error) {
            console.error(`Failed to fetch cost for ${item.name}:`, error)
          }
        }
      }

      setCostDataMap(costs)
    }

    fetchCosts()
  }, [menuItems])

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Menu Items</h1>
          <p className="text-muted-foreground">
            Manage your menu items and pricing
          </p>
        </div>
        <MenuItemDialog onSuccess={() => {}} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Menu Items</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !menuItems || menuItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No menu items yet. Create your first one!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Food Cost %</TableHead>
                  <TableHead>Recipe</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {menuItems.map((item) => {
                  const costData = costDataMap[item.id]
                  return (
                    <TableRow key={item.id} data-testid={`row-menu-item-${item.id}`}>
                      <TableCell className="font-medium" data-testid={`text-name-${item.id}`}>
                        {item.name}
                      </TableCell>
                      <TableCell data-testid={`text-price-${item.id}`}>
                        {formatCurrency(item.priceCents, { inCents: true })}
                      </TableCell>
                      <TableCell data-testid={`text-cost-${item.id}`}>
                        {costData?.costCents !== null && costData?.costCents !== undefined
                          ? formatCurrency(costData.costCents, { inCents: true })
                          : "—"}
                      </TableCell>
                      <TableCell data-testid={`text-food-cost-pct-${item.id}`}>
                        {costData?.foodCostPct !== null && costData?.foodCostPct !== undefined ? (
                          <Badge variant={costData.foodCostPct > 35 ? "destructive" : "default"}>
                            {costData.foodCostPct.toFixed(1)}%
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-has-recipe-${item.id}`}>
                        <Badge variant={item.isComposite ? "default" : "secondary"}>
                          {item.isComposite ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.isActive ? "default" : "secondary"} data-testid={`badge-status-${item.id}`}>
                          {item.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <MenuItemDialog item={item} costData={costData} onSuccess={() => {}} />
                          <DeleteMenuItem item={item} />
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
