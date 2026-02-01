import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search } from "lucide-react"
import { useDataStore } from "@/lib/store/dataStore"
import { formatCurrency } from "@/lib/utils/formatters"

export default function Ingredients() {
  const { ingredients, setIngredients, loadIngredientsFromDB } = useDataStore()
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({ 
    name: "", 
    category: "", 
    unit: "", 
    stock: "", 
    parLevel: "",
    cost: ""
  })
  
  // Load ingredients from Supabase on mount
  useEffect(() => {
    loadIngredientsFromDB()
  }, [])

  const handleAdd = () => {
    const newIngredient = {
      id: `ing-${Date.now()}`,
      organization_id: 'org-1',
      venue_id: 'venue-1',
      name: formData.name,
      category: formData.category as any,
      unit: formData.unit as any,
      current_stock: parseFloat(formData.stock) || 0,
      par_level: parseFloat(formData.parLevel) || 0,
      reorder_point: Math.round((parseFloat(formData.parLevel) || 0) * 0.5), // 50% of par level
      cost_per_unit: Math.round((parseFloat(formData.cost) || 0) * 100),
      last_cost_update: new Date(),
      active: true
    }
    
    setIngredients([...ingredients, newIngredient])
    setFormData({ name: "", category: "", unit: "", stock: "", parLevel: "", cost: "" })
    setOpen(false)
  }

  const filtered = ingredients.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Ingredients</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Ingredient</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Ingredient</DialogTitle>
              <DialogDescription>
                Add a new ingredient to your inventory
              </DialogDescription>
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
              <Button onClick={handleAdd} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <CardTitle>Ingredients ({ingredients.length})</CardTitle>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                    {search ? "No ingredients match your search" : "No ingredients yet. Click 'Add Ingredient' to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="capitalize">{item.category}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">{item.current_stock}</TableCell>
                    <TableCell className="text-right">{item.par_level}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.cost_per_unit)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
