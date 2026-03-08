import { useAuth } from '@/contexts/AuthContext'
import { useState, useMemo, useEffect } from 'react'
import {
  Trash2,
  Plus,
  Search,
  TrendingDown,
  AlertTriangle,
  Zap,
  Loader2,
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
import { Separator } from '@/components/ui/separator'
import { useDataStore } from '@/lib/store/dataStore'
import { WasteEntry } from '@/types'
import { toast } from 'sonner'
import { format, startOfMonth, startOfWeek, subDays, eachDayOfInterval } from 'date-fns'
import { PageShell, PageToolbar } from '@/components/shared'
import { StatCards } from '@/components/ui/StatCards'
import { SecondaryStats } from '@/components/ui/SecondaryStats'
import { formatCurrency } from '@/lib/utils/formatters'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const WASTE_REASONS = [
  { value: 'spoilage', label: 'Spoilage' },
  { value: 'expired', label: 'Expired' },
  { value: 'overproduction', label: 'Overproduction' },
  { value: 'breakage', label: 'Dropped/Breakage' },
  { value: 'staff_meal', label: 'Staff Meal' },
  { value: 'promo', label: 'Promo/Comp' },
  { value: 'theft_unknown', label: 'Theft/Unknown' },
  { value: 'spillage', label: 'Spillage' },
  { value: 'prep-waste', label: 'Prep Waste' },
  { value: 'other', label: 'Other' },
] as const

const REASON_LABEL = Object.fromEntries(WASTE_REASONS.map((r) => [r.value, r.label]))

export default function Waste() {
  const { wasteLogs, ingredients, isLoading, addWasteEntry, deleteWasteEntry, loadWasteLogsFromDB, loadIngredientsFromDB } = useDataStore()
  const { currentVenue, user, profile } = useAuth()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<string>('month')
  const [showDashboard, setShowDashboard] = useState(true)

  useEffect(() => {
    loadWasteLogsFromDB()
    loadIngredientsFromDB()
  }, [loadWasteLogsFromDB, loadIngredientsFromDB])

  const [wasteForm, setWasteForm] = useState({
    ingredient_id: '',
    quantity: 0,
    reason: 'spoilage' as string,
    notes: '',
  })

  // Filter by date
  const filteredWaste = useMemo(() => {
    let filtered = wasteLogs

    const now = new Date()
    let startDate: Date

    switch (dateFilter) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
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

  // Dashboard stats
  const dashboardData = useMemo(() => {
    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const monthStart = startOfMonth(now)

    const weekWaste = wasteLogs.filter((we) => new Date(we.waste_date) >= weekStart)
    const monthWaste = wasteLogs.filter((we) => new Date(we.waste_date) >= monthStart)

    const weekTotal = weekWaste.reduce((sum, we) => sum + we.value, 0)
    const monthTotal = monthWaste.reduce((sum, we) => sum + we.value, 0)

    // Top wasted items (by value, this month)
    const byItem = new Map<string, { name: string; value: number; count: number }>()
    monthWaste.forEach((we) => {
      const existing = byItem.get(we.ingredient_id) || { name: we.ingredient_name, value: 0, count: 0 }
      existing.value += we.value
      existing.count += 1
      byItem.set(we.ingredient_id, existing)
    })
    const topItems = Array.from(byItem.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    // Waste by reason (bar chart data)
    const byReason = new Map<string, number>()
    monthWaste.forEach((we) => {
      byReason.set(we.reason, (byReason.get(we.reason) || 0) + we.value)
    })
    const reasonChartData = Array.from(byReason.entries())
      .map(([reason, value]) => ({
        reason: REASON_LABEL[reason] || reason,
        value: value / 100,
      }))
      .sort((a, b) => b.value - a.value)

    // Daily trend (last 30 days)
    const thirtyDaysAgo = subDays(now, 30)
    const days = eachDayOfInterval({ start: thirtyDaysAgo, end: now })
    const dailyTrend = days.map((day) => {
      const dayStr = format(day, 'yyyy-MM-dd')
      const dayWaste = wasteLogs.filter(
        (we) => format(new Date(we.waste_date), 'yyyy-MM-dd') === dayStr
      )
      return {
        date: format(day, 'dd/MM'),
        value: dayWaste.reduce((sum, we) => sum + we.value, 0) / 100,
      }
    })

    // Frequently wasted items (for quick-add)
    const frequencyMap = new Map<string, number>()
    wasteLogs.forEach((we) => {
      frequencyMap.set(we.ingredient_id, (frequencyMap.get(we.ingredient_id) || 0) + 1)
    })
    const frequentIds = Array.from(frequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id]) => id)

    return { weekTotal, monthTotal, topItems, reasonChartData, dailyTrend, frequentIds }
  }, [wasteLogs])

  const handleOpenDialog = (preselectedIngredientId?: string) => {
    setWasteForm({
      ingredient_id: preselectedIngredientId || '',
      quantity: 0,
      reason: 'spoilage',
      notes: '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!currentVenue?.id || currentVenue.id === 'all') {
      toast.error('Select a specific venue before logging waste')
      return
    }

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

    const today = format(new Date(), 'yyyyMMdd')
    const todayWaste = wasteLogs.filter((we) => {
      const weDate = format(new Date(we.waste_date), 'yyyyMMdd')
      return weDate === today
    })
    const sequence = todayWaste.length + 1

    const wasteEntry: WasteEntry = {
      id: crypto.randomUUID(),
      venue_id: currentVenue?.id || '',
      waste_date: new Date(),
      waste_time: format(new Date(), 'HH:mm'),
      ingredient_id: wasteForm.ingredient_id,
      ingredient_name: ingredient.name,
      quantity: wasteForm.quantity,
      unit: ingredient.unit,
      value,
      reason: wasteForm.reason as WasteEntry['reason'],
      notes: wasteForm.notes || undefined,
      recorded_by_user_id: user?.id || '',
      recorded_by_name: profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Manager' : 'Manager',
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

  // Stats for sidebar
  const stats = useMemo(() => {
    const totalCost = filteredWaste.reduce((sum, we) => sum + we.value, 0)
    const totalItems = filteredWaste.length
    const byReason: Record<string, number> = {}
    filteredWaste.forEach((we) => {
      byReason[we.reason] = (byReason[we.reason] || 0) + we.value
    })
    const topReason = Object.entries(byReason).sort((a, b) => b[1] - a[1])[0]
    return {
      totalCost,
      totalItems,
      topReason: topReason
        ? { reason: REASON_LABEL[topReason[0]] || topReason[0], cost: topReason[1] }
        : null,
    }
  }, [filteredWaste])

  const toolbar = (
    <PageToolbar
      title="Waste Tracking"
      filters={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-[180px] pl-8 text-sm"
            />
          </div>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={showDashboard ? "default" : "outline"}
            size="sm"
            onClick={() => setShowDashboard(!showDashboard)}
            className="h-8 text-xs"
          >
            Dashboard
          </Button>
        </div>
      }
      primaryAction={{ label: "Log Waste", icon: Plus, onClick: () => handleOpenDialog(), variant: "primary" }}
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-4 pt-4 space-y-3">
        <StatCards stats={[
          { label: "Total Cost", value: formatCurrency(stats.totalCost), trend: stats.totalCost > 0 ? 'down' as const : undefined },
          { label: "Entries", value: stats.totalItems },
          { label: "This Week", value: formatCurrency(dashboardData.weekTotal) },
        ]} columns={3} />
        <SecondaryStats stats={[
          ...(stats.topReason ? [{ label: "Top Reason", value: stats.topReason.reason }] : []),
          { label: "This Month", value: formatCurrency(dashboardData.monthTotal) },
        ]} />
      </div>
      <div className="p-4 md:p-6 space-y-6">

      {/* Waste Dashboard */}
      {showDashboard && wasteLogs.length > 0 && (
        <div className="space-y-4">
          {/* Quick-Add Section */}
          {dashboardData.frequentIds.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-sm">Quick Log — Frequently Wasted</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {dashboardData.frequentIds.map((id) => {
                  const ing = ingredients.find((i) => i.id === id)
                  if (!ing) return null
                  return (
                    <Button
                      key={id}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleOpenDialog(id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {ing.name}
                    </Button>
                  )
                })}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Waste by Reason (bar chart) */}
            {dashboardData.reasonChartData.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold text-sm mb-3">Waste by Reason (This Month)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dashboardData.reasonChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                    <YAxis type="category" dataKey="reason" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Value']} />
                    <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Daily Trend (line chart) */}
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3">Daily Waste (Last 30 Days)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dashboardData.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Waste']} />
                  <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Top Wasted Items */}
          {dashboardData.topItems.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3">Top Wasted Items (This Month)</h3>
              <div className="space-y-2">
                {dashboardData.topItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                      <span className="text-sm font-medium">{item.name}</span>
                      <Badge variant="outline" className="text-xs">{item.count}x</Badge>
                    </div>
                    <span className="text-sm font-semibold text-red-600">
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Separator />
        </div>
      )}

      {/* Waste Entries Table */}
      {isLoading && wasteLogs.length === 0 ? (
        <Card className="p-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
          <p className="text-muted-foreground">Loading waste logs...</p>
        </Card>
      ) : filteredWaste.length === 0 ? (
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
            <Button onClick={() => handleOpenDialog()}>
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
                <TableHead>Notes</TableHead>
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
                      {REASON_LABEL[waste.reason] || waste.reason}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-red-600">
                    {formatCurrency(waste.value)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                    {waste.notes || '—'}
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
                <Label htmlFor="ingredient">Ingredient *</Label>
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
                        {ingredient.name} ({ingredient.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="quantity">Quantity *</Label>
                <div className="flex items-center gap-2">
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
                  <span className="text-sm text-muted-foreground">
                    {wasteForm.ingredient_id
                      ? ingredients.find((i) => i.id === wasteForm.ingredient_id)?.unit || ''
                      : ''}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="reason">Reason *</Label>
              <Select
                value={wasteForm.reason}
                onValueChange={(value) => setWasteForm({ ...wasteForm, reason: value })}
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
    </PageShell>
  )
}
