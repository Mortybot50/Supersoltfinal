import { useState, useMemo, useEffect } from 'react'
import {
  Trash2,
  Plus,
  Search,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useDataStore } from '@/lib/store/dataStore'
import { toast } from 'sonner'
import { format, startOfMonth, subDays } from 'date-fns'

const WASTE_REASONS = [
  { value: 'spoilage', label: 'Spoilage' },
  { value: 'spillage', label: 'Spillage' },
  { value: 'prep-waste', label: 'Prep Waste' },
  { value: 'over-production', label: 'Over Production' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'other', label: 'Other' },
] as const

export default function Waste() {
  const { wasteLogs, ingredients, menuItems, addWasteEntry, deleteWasteEntry, loadWasteLogsFromDB, loadIngredientsFromDB } = useDataStore()
  
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<string>('month')
  
  // Load data on mount
  useEffect(() => {
    loadWasteLogsFromDB()
    loadIngredientsFromDB()
  }, [])
  
  const [wasteForm, setWasteForm] = useState({
    ingredient_id: '',
    quantity: 0,
    reason: 'spoilage' as typeof WASTE_REASONS[number]['value'],
    notes: '',
  })
  
  // Filter by date
  const filteredWaste = useMemo(() => {
    let filtered = wasteLogs
    
    const now = new Date()
    let startDate: Date
    
    switch (dateFilter) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0))
        break
      case 'week':
        startDate = subDays(now, 7)
        break
      case 'month':
        startDate = startOfMonth(now)
        break
      default:
        startDate = new Date(0)
    }
    
    filtered = filtered.filter((we) => new Date(we.waste_date) >= startDate)
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((we) => we.ingredient_name.toLowerCase().includes(query))
    }
    
    return filtered.sort(
      (a, b) => new Date(b.waste_date).getTime() - new Date(a.waste_date).getTime()
    )
  }, [wasteLogs, dateFilter, searchQuery])
  
  // Stats
  const stats = useMemo(() => {
    const totalCost = filteredWaste.reduce((sum, we) => sum + we.value, 0)
    const totalItems = filteredWaste.length
    
    // Group by reason
    const byReason: Record<string, number> = {}
    filteredWaste.forEach((we) => {
      byReason[we.reason] = (byReason[we.reason] || 0) + we.value
    })
    
    const topReason = Object.entries(byReason).sort((a, b) => b[1] - a[1])[0]
    
    return {
      totalCost,
      totalItems,
      topReason: topReason
        ? {
            reason: WASTE_REASONS.find((r) => r.value === topReason[0])?.label || topReason[0],
            cost: topReason[1],
          }
        : null,
    }
  }, [filteredWaste])
  
  const handleOpenDialog = () => {
    setWasteForm({
      ingredient_id: '',
      quantity: 0,
      reason: 'spoilage',
      notes: '',
    })
    setDialogOpen(true)
  }
  
  const handleSave = async () => {
    if (!wasteForm.ingredient_id) {
      toast.error('Please select an ingredient')
      return
    }
    
    if (wasteForm.quantity <= 0) {
      toast.error('Quantity must be greater than 0')
      return
    }
    
    const ingredient = ingredients.find((i) => i.id === wasteForm.ingredient_id)
    if (!ingredient) {
      toast.error('Ingredient not found')
      return
    }
    
    const value = Math.round(wasteForm.quantity * ingredient.cost_per_unit)
    
    // Generate waste number
    const today = format(new Date(), 'yyyyMMdd')
    const todayWaste = wasteLogs.filter((we) => {
      const weDate = format(new Date(we.waste_date), 'yyyyMMdd')
      return weDate === today
    })
    const sequence = todayWaste.length + 1
    
    const wasteEntry: any = {
      id: crypto.randomUUID(),
      venue_id: 'VENUE-001',
      waste_date: new Date(),
      waste_time: format(new Date(), 'HH:mm'),
      ingredient_id: wasteForm.ingredient_id,
      ingredient_name: ingredient.name,
      quantity: wasteForm.quantity,
      unit: ingredient.unit,
      value,
      reason: wasteForm.reason,
      notes: wasteForm.notes || undefined,
      recorded_by_user_id: 'current-user',
      recorded_by_name: 'J Smith',
    }
    
    try {
      await addWasteEntry(wasteEntry)
      toast.success('Waste logged successfully')
      setDialogOpen(false)
    } catch (error) {
      toast.error('Failed to log waste')
      console.error(error)
    }
  }
  
  const handleDelete = async (id: string, itemName: string) => {
    if (confirm(`Delete waste entry for ${itemName}?`)) {
      try {
        await deleteWasteEntry(id)
        toast.success('Waste entry deleted')
      } catch (error) {
        toast.error('Failed to delete waste entry')
        console.error(error)
      }
    }
  }
  
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Waste Tracking</h1>
          <p className="text-muted-foreground">
            Log and analyze ingredient waste
          </p>
        </div>
        <Button onClick={handleOpenDialog} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Log Waste
        </Button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Total Waste Cost</p>
          </div>
          <p className="text-2xl font-bold text-red-600">
            ${(stats.totalCost / 100).toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {dateFilter === 'today' ? 'Today' : dateFilter === 'week' ? 'Last 7 days' : 'This month'}
          </p>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <p className="text-sm text-muted-foreground">Total Items</p>
          </div>
          <p className="text-2xl font-bold">{stats.totalItems}</p>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Top Reason</p>
          </div>
          {stats.topReason ? (
            <>
              <p className="text-lg font-semibold">{stats.topReason.reason}</p>
              <p className="text-sm text-red-600">
                ${(stats.topReason.cost / 100).toFixed(2)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No data</p>
          )}
        </Card>
      </div>
      
      {/* Filters */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>
      
      {/* Waste Table */}
      {filteredWaste.length === 0 ? (
        <Card className="p-12 text-center">
          <Trash2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {wasteLogs.length === 0 ? 'No Waste Logged Yet' : 'No Waste Found'}
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            {wasteLogs.length === 0
              ? 'Start tracking waste to identify patterns and reduce costs'
              : 'Try adjusting your filters'}
          </p>
          {wasteLogs.length === 0 && (
            <Button onClick={handleOpenDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Log First Waste
            </Button>
          )}
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Ingredient</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Recorded By</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWaste.map((waste) => (
                <TableRow key={waste.id}>
                  <TableCell>
                    {format(new Date(waste.waste_date), 'dd MMM yyyy')}
                    <br />
                    <span className="text-xs text-muted-foreground">{waste.waste_time}</span>
                  </TableCell>
                  <TableCell className="font-medium">{waste.ingredient_name}</TableCell>
                  <TableCell>
                    {waste.quantity} {waste.unit}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {WASTE_REASONS.find((r) => r.value === waste.reason)?.label || waste.reason}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-red-600">
                    ${(waste.value / 100).toFixed(2)}
                  </TableCell>
                  <TableCell>{waste.recorded_by_name || waste.recorded_by_user_id}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(waste.id, waste.ingredient_name)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      
      {/* Log Waste Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log Waste</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ingredient">Ingredient</Label>
                <Select
                  value={wasteForm.ingredient_id}
                  onValueChange={(value) => setWasteForm({ ...wasteForm, ingredient_id: value })}
                >
                  <SelectTrigger id="ingredient">
                    <SelectValue placeholder="Select ingredient..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ingredients.filter(i => i.active).map((ingredient) => (
                      <SelectItem key={ingredient.id} value={ingredient.id}>
                        {ingredient.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  step="0.1"
                  value={wasteForm.quantity}
                  onChange={(e) =>
                    setWasteForm({ ...wasteForm, quantity: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Select
                value={wasteForm.reason}
                onValueChange={(value: any) => setWasteForm({ ...wasteForm, reason: value })}
              >
                <SelectTrigger id="reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WASTE_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="waste_notes">Notes</Label>
              <Textarea
                id="waste_notes"
                value={wasteForm.notes}
                onChange={(e) => setWasteForm({ ...wasteForm, notes: e.target.value })}
                placeholder="Any additional notes..."
                rows={2}
              />
            </div>
            
            {wasteForm.ingredient_id && wasteForm.quantity > 0 && (
              <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                <p className="text-sm font-medium">Estimated Cost:</p>
                <p className="text-2xl font-bold text-red-600">
                  $
                  {(
                    (wasteForm.quantity *
                      (ingredients.find((i) => i.id === wasteForm.ingredient_id)?.cost_per_unit || 0)) /
                    100
                  ).toFixed(2)}
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Log Waste</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
