import { useState, useMemo } from 'react'
import { format, addDays, subDays, startOfDay, isToday } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useDataStore } from '@/lib/store/dataStore'
import { toast } from 'sonner'
import { PageShell, PageToolbar } from '@/components/shared'
import { StatCards } from '@/components/ui/StatCards'
import { SecondaryStats } from '@/components/ui/SecondaryStats'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Search,
  DollarSign,
  AlertTriangle,
  ClipboardList,
  Wrench,
  Package,
  Users,
  Pencil,
  Trash2,
} from 'lucide-react'

const ENTRY_CATEGORIES = [
  { value: 'operations', label: 'Operations', icon: ClipboardList, color: 'bg-blue-100 text-blue-800' },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench, color: 'bg-orange-100 text-orange-800' },
  { value: 'incident', label: 'Incident', icon: AlertTriangle, color: 'bg-red-100 text-red-800' },
  { value: 'delivery', label: 'Delivery', icon: Package, color: 'bg-green-100 text-green-800' },
  { value: 'staff', label: 'Staff', icon: Users, color: 'bg-purple-100 text-purple-800' },
  { value: 'financial', label: 'Financial', icon: DollarSign, color: 'bg-yellow-100 text-yellow-800' },
] as const

type EntryCategory = typeof ENTRY_CATEGORIES[number]['value']

interface DaybookEntry {
  id: string
  date: string // ISO date
  time: string // HH:mm
  category: EntryCategory
  title: string
  notes: string
  amount?: number // cents
  created_at: Date
  created_by: string
}

export default function Daybook() {
  const { staff } = useDataStore()
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()))
  const [entries, setEntries] = useState<DaybookEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<DaybookEntry | null>(null)
  const [form, setForm] = useState({
    category: 'operations' as EntryCategory,
    title: '',
    notes: '',
    amount: '',
    time: format(new Date(), 'HH:mm'),
  })

  // Load daybook entries from Supabase
  useEffect(() => {
    async function loadEntries() {
      try {
        const { supabase } = await import('@/integrations/supabase/client')
        const { data, error } = await supabase
          .from('daybook_entries')
          .select('*')
          .order('entry_date', { ascending: false })

        if (error) throw error
        if (data) {
          const mapped: DaybookEntry[] = data.map(row => {
            const totalAmount = (row.pos_sales ?? 0) + (row.cash_counted ?? 0) + (row.card_total ?? 0)
            const createdAt = new Date(row.created_at)
            const notesParts = [row.notes, row.issues].filter(Boolean).join(' | ')
            return {
              id: row.id,
              date: row.entry_date,
              time: format(createdAt, 'HH:mm'),
              category: 'financial' as EntryCategory,
              title: row.status === 'approved' ? 'Daily Reconciliation (Approved)' : 'Daily Reconciliation',
              notes: notesParts,
              amount: totalAmount > 0 ? totalAmount : undefined,
              created_at: createdAt,
              created_by: row.created_by || 'system',
            }
          })
          setEntries(prev => {
            // Merge DB entries with any local-only entries
            const dbIds = new Set(mapped.map(e => e.id))
            const localOnly = prev.filter(e => !dbIds.has(e.id))
            return [...mapped, ...localOnly]
          })
        }
      } catch (err) {
        console.error('Failed to load daybook entries:', err)
      }
    }
    loadEntries()
  }, [])

  const dateKey = format(selectedDate, 'yyyy-MM-dd')

  const filteredEntries = useMemo(() => {
    return entries
      .filter((e) => e.date === dateKey)
      .filter((e) => filterCategory === 'all' || e.category === filterCategory)
      .filter((e) =>
        searchQuery
          ? e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.notes.toLowerCase().includes(searchQuery.toLowerCase())
          : true
      )
      .sort((a, b) => (a.time > b.time ? 1 : -1))
  }, [entries, dateKey, filterCategory, searchQuery])

  const daySummary = useMemo(() => {
    const dayEntries = entries.filter((e) => e.date === dateKey)
    const totalAmount = dayEntries
      .filter((e) => e.amount)
      .reduce((sum, e) => sum + (e.amount || 0), 0)
    const byCat = ENTRY_CATEGORIES.map((cat) => ({
      ...cat,
      count: dayEntries.filter((e) => e.category === cat.value).length,
    }))
    return { total: dayEntries.length, totalAmount, byCat }
  }, [entries, dateKey])

  const handleSubmit = () => {
    if (!form.title.trim()) {
      toast.error('Title is required')
      return
    }

    const entry: DaybookEntry = {
      id: editingEntry?.id || crypto.randomUUID(),
      date: dateKey,
      time: form.time,
      category: form.category,
      title: form.title.trim(),
      notes: form.notes.trim(),
      amount: form.amount ? Math.round(parseFloat(form.amount) * 100) : undefined,
      created_at: editingEntry?.created_at || new Date(),
      created_by: 'current-user',
    }

    if (editingEntry) {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)))
      toast.success('Entry updated')
    } else {
      setEntries((prev) => [...prev, entry])
      toast.success('Entry added')
    }

    setDialogOpen(false)
    setEditingEntry(null)
    setForm({ category: 'operations', title: '', notes: '', amount: '', time: format(new Date(), 'HH:mm') })
  }

  const handleEdit = (entry: DaybookEntry) => {
    setEditingEntry(entry)
    setForm({
      category: entry.category,
      title: entry.title,
      notes: entry.notes,
      amount: entry.amount ? (entry.amount / 100).toFixed(2) : '',
      time: entry.time,
    })
    setDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
    toast.success('Entry deleted')
  }

  const openNewEntry = () => {
    setEditingEntry(null)
    setForm({ category: 'operations', title: '', notes: '', amount: '', time: format(new Date(), 'HH:mm') })
    setDialogOpen(true)
  }

  const getCategoryMeta = (cat: string) => ENTRY_CATEGORIES.find((c) => c.value === cat)!

  const toolbar = (
    <PageToolbar
      title="Daybook"
      dateNavigation={{
        label: format(selectedDate, 'd MMM yyyy'),
        onBack: () => setSelectedDate((d) => subDays(d, 1)),
        onForward: () => setSelectedDate((d) => addDays(d, 1)),
      }}
      filters={
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 w-48"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {ENTRY_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
      primaryAction={{
        label: 'Add Entry',
        icon: Plus,
        onClick: openNewEntry,
        variant: 'primary',
      }}
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-4 pt-4 space-y-3">
        <StatCards stats={[
          { label: 'Entries Today', value: daySummary.total },
          ...(daySummary.totalAmount > 0
            ? [{ label: 'Total Value', value: `$${(daySummary.totalAmount / 100).toFixed(2)}` }]
            : []),
        ]} columns={daySummary.totalAmount > 0 ? 2 : 1} />
        {daySummary.byCat.filter(c => c.count > 0).length > 0 && (
          <SecondaryStats stats={daySummary.byCat
            .filter(c => c.count > 0)
            .map(cat => ({ label: cat.label, value: cat.count }))} />
        )}
      </div>
      <div className="p-6 space-y-6">

      {/* Entries List */}
      {filteredEntries.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No entries for this day</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || filterCategory !== 'all'
                ? 'Try adjusting your filters'
                : 'Add your first entry to start the daybook'}
            </p>
            {!searchQuery && filterCategory === 'all' && (
              <Button onClick={openNewEntry}>
                <Plus className="h-4 w-4 mr-2" />
                Add Entry
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => {
            const catMeta = getCategoryMeta(entry.category)
            const CatIcon = catMeta.icon
            return (
              <Card key={entry.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${catMeta.color}`}>
                    <CatIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{entry.title}</span>
                          <Badge variant="outline" className="text-xs">
                            {catMeta.label}
                          </Badge>
                          {entry.amount && (
                            <Badge variant="secondary" className="text-xs">
                              ${(entry.amount / 100).toFixed(2)}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{entry.time}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(entry)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(entry.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {entry.notes && (
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{entry.notes}</p>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add/Edit Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Edit Entry' : 'New Daybook Entry'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="entry-category">Category</Label>
                <Select value={form.category} onValueChange={(v: EntryCategory) => setForm({ ...form, category: v })}>
                  <SelectTrigger id="entry-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTRY_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="entry-time">Time</Label>
                <Input
                  id="entry-time"
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="entry-title">Title *</Label>
              <Input
                id="entry-title"
                placeholder="Brief description"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entry-notes">Notes</Label>
              <Textarea
                id="entry-notes"
                placeholder="Additional details..."
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entry-amount">Amount ($, optional)</Label>
              <Input
                id="entry-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>{editingEntry ? 'Update' : 'Add Entry'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </PageShell>
  )
}
