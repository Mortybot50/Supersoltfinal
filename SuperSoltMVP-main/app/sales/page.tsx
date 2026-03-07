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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Trash2 } from "lucide-react"
import { format } from "date-fns"

interface DailySale {
  id: string
  orgId: string
  venueId: string
  saleDate: string
  menuItemId: string
  quantitySold: number
  createdAt: string
  menuItemName: string
  menuItemPrice: number
}

interface MenuItem {
  id: string
  name: string
  priceCents: number
}

const salesSchema = z.object({
  saleDate: z.string().min(1, "Date is required"),
  menuItemId: z.string().min(1, "Menu item is required"),
  quantitySold: z.coerce.number().min(1, "Quantity must be at least 1"),
})

type SalesForm = z.infer<typeof salesSchema>

function SalesDialog({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)

  const { data: menuItems } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu-items"],
  })

  const form = useForm<SalesForm>({
    resolver: zodResolver(salesSchema),
    defaultValues: {
      saleDate: format(new Date(), "yyyy-MM-dd"),
      menuItemId: "",
      quantitySold: 1,
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: SalesForm) => {
      console.log("Submitting sale data:", data)
      return apiRequest("POST", "/api/sales", data)
    },
    onSuccess: () => {
      console.log("Sale recorded successfully")
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] })
      toast({
        title: "Success",
        description: "Sale recorded successfully",
      })
      setOpen(false)
      form.reset()
      onSuccess()
    },
    onError: (error: Error) => {
      console.error("Error recording sale:", error)
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
        <Button data-testid="button-create-sale">
          <Plus className="h-4 w-4 mr-2" />
          Add Sale
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="dialog-sale">
        <DialogHeader>
          <DialogTitle>Record Daily Sale</DialogTitle>
          <DialogDescription>
            Add sales data for a menu item on a specific date
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="saleDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sale Date</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" data-testid="input-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="menuItemId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Menu Item</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-menu-item">
                        <SelectValue placeholder="Select a menu item" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {menuItems?.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({new Intl.NumberFormat("en-AU", {
                            style: "currency",
                            currency: "AUD",
                          }).format(item.priceCents / 100)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantitySold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity Sold</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min="1"
                      placeholder="0"
                      data-testid="input-quantity"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-submit">
                {mutation.isPending ? "Recording..." : "Record"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteSale({ sale }: { sale: DailySale }) {
  const { toast } = useToast()

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/sales/${sale.id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] })
      toast({
        title: "Success",
        description: "Sale deleted successfully",
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
      data-testid={`button-delete-${sale.id}`}
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  )
}

export default function SalesPage() {
  const { data: sales, isLoading } = useQuery<DailySale[]>({
    queryKey: ["/api/sales"],
  })

  const totalRevenue = sales?.reduce((sum, sale) => sum + (sale.quantitySold * sale.menuItemPrice), 0) || 0

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Daily Sales</h1>
          <p className="text-muted-foreground">
            Track sales data for demand forecasting
          </p>
        </div>
        <SalesDialog onSuccess={() => {}} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sales Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-records">
              {sales?.length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-revenue">
              {new Intl.NumberFormat("en-AU", {
                style: "currency",
                currency: "AUD",
              }).format(totalRevenue / 100)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Items Sold
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-items">
              {sales?.reduce((sum, sale) => sum + sale.quantitySold, 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sales History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !sales || sales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sales records yet. Add your first one!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Menu Item</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Qty Sold</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
                    <TableCell data-testid={`text-date-${sale.id}`}>
                      {format(new Date(sale.saleDate), "PPP")}
                    </TableCell>
                    <TableCell className="font-medium" data-testid={`text-menu-item-${sale.id}`}>
                      {sale.menuItemName}
                    </TableCell>
                    <TableCell data-testid={`text-price-${sale.id}`}>
                      {new Intl.NumberFormat("en-AU", {
                        style: "currency",
                        currency: "AUD",
                      }).format(sale.menuItemPrice / 100)}
                    </TableCell>
                    <TableCell data-testid={`text-quantity-${sale.id}`}>
                      {sale.quantitySold}
                    </TableCell>
                    <TableCell data-testid={`text-revenue-${sale.id}`}>
                      {new Intl.NumberFormat("en-AU", {
                        style: "currency",
                        currency: "AUD",
                      }).format((sale.quantitySold * sale.menuItemPrice) / 100)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteSale sale={sale} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
