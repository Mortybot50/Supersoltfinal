import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Package } from "lucide-react"
import { useDataStore } from "@/lib/store/dataStore"
import { formatCurrency } from "@/lib/utils/formatters"
import { PageShell, PageToolbar, PageSidebar, StatusBadge } from "@/components/shared"

export default function Ingredients() {
  const { ingredients, setIngredients, loadIngredientsFromDB } = useDataStore()
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    unit: "",
    stock: "",
    parLevel: "",
    cost: ""
  })

  useEffect(() => {
    loadIngredientsFromDB()
  }, [])

  const handleAdd = () => {
    const newIngredient = {
      id: `ing-${Date.now()}`,
      organization_id: 'org-1',
      venue_id: 'venue-1',
      name: formData.name,
      category: formData.category as 'produce' | 'meat' | 'seafood' | 'dairy' | 'dry-goods' | 'beverages' | 'other',
      unit: formData.unit as 'kg' | 'g' | 'L' | 'mL' | 'ea',
      current_stock: parseFloat(formData.stock) || 0,
      par_level: parseFloat(formData.parLevel) || 0,
      reorder_point: Math.round((parseFloat(formData.parLevel) || 0) * 0.5),
      cost_per_unit: Math.round((parseFloat(formData.cost) || 0) * 100),
      last_cost_update: new Date(),
      active: true
    }

    setIngredients([...ingredients, newIngredient])
    setFormData({ name: "", category: "", unit: "", stock: "", parLevel: "", cost: "" })
    setOpen(false)
  }

  const filtered = useMemo(() => {
    return ingredients.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [ingredients, search, categoryFilter])

  const lowStockCount = useMemo(() => {
    return ingredients.filter(i => i.current_stock <= i.reorder_point && i.active).length
  }, [ingredients])

  const categories = useMemo(() => {
    const cats = new Set(ingredients.map(i => i.category))
    return Array.from(cats).sort()
  }, [ingredients])

  const sidebar = (
    <PageSidebar
      title="Ingredients"
      metrics={[
        { label: "Total Items", value: ingredients.length },
        { label: "Low Stock", value: lowStockCount, color: lowStockCount > 0 ? "orange" : "default" },
        { label: "Categories", value: categories.length },
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
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-[200px] pl-8 text-sm"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="produce">Produce</SelectItem>
              <SelectItem value="meat">Meat</SelectItem>
              <SelectItem value="dairy">Dairy</SelectItem>
              <SelectItem value="dry-goods">Dry Goods</SelectItem>
              <SelectItem value="beverages">Beverages</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
      primaryAction={{ label: "Add Ingredient", icon: Plus, onClick: () => setOpen(true), variant: "teal" }}
    />
  )

  return (
    <PageShell sidebar={sidebar} toolbar={toolbar}>
      <div className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Current Stock</TableHead>
              <TableHead className="text-right">Par Level</TableHead>
              <TableHead className="text-right">Cost/Unit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground h-32">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{search || categoryFilter !== "all" ? "No ingredients match your filters" : "No ingredients yet. Click 'Add Ingredient' to get started."}</p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <StatusBadge status={item.category as any} size="sm" />
                  </TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className={`text-right ${item.current_stock <= item.reorder_point ? 'text-orange-600 font-medium' : ''}`}>
                    {item.current_stock}
                  </TableCell>
                  <TableCell className="text-right">{item.par_level}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.cost_per_unit)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Ingredient</DialogTitle>
            <DialogDescription>Add a new ingredient to your inventory</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="produce">Produce</SelectItem>
                  <SelectItem value="meat">Meat</SelectItem>
                  <SelectItem value="dairy">Dairy</SelectItem>
                  <SelectItem value="dry-goods">Dry Goods</SelectItem>
                  <SelectItem value="beverages">Beverages</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unit</Label>
              <Select value={formData.unit} onValueChange={v => setFormData({...formData, unit: v})}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="L">L</SelectItem>
                  <SelectItem value="ea">ea</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Current Stock</Label>
              <Input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} />
            </div>
            <div>
              <Label>Par Level</Label>
              <Input type="number" value={formData.parLevel} onChange={e => setFormData({...formData, parLevel: e.target.value})} />
            </div>
            <div>
              <Label>Cost per Unit ($)</Label>
              <Input type="number" step="0.01" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} />
            </div>
            <Button onClick={handleAdd} className="w-full bg-teal-500 hover:bg-teal-600">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
