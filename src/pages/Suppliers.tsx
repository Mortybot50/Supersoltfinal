import { useAuth } from '@/contexts/AuthContext'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Building2, Edit, Trash2, ChevronRight, DollarSign, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { useDataStore } from '@/lib/store/dataStore'
import { toast } from 'sonner'
import * as Types from '@/types'
import { PageShell, PageToolbar } from '@/components/shared'
import { StatCards } from '@/components/ui/StatCards'
import { SecondaryStats } from '@/components/ui/SecondaryStats'
import { formatCurrency } from '@/lib/utils/formatters'
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'produce', label: 'Produce' },
  { value: 'meat', label: 'Meat & Seafood' },
  { value: 'dry-goods', label: 'Dry Goods' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' },
]

const CATEGORY_LABELS: Record<string, string> = {
  produce: 'Produce',
  meat: 'Meat',
  'dry-goods': 'Dry Goods',
  beverages: 'Beverages',
  equipment: 'Equipment',
  other: 'Other',
}

function validateABN(abn: string): boolean {
  const cleaned = abn.replace(/\s/g, '')
  if (!/^\d{11}$/.test(cleaned)) return false
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
  const digits = cleaned.split('').map(Number)
  digits[0] -= 1
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0)
  return sum % 89 === 0
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

// ── Sortable Column Types ─────────────────────────────────────
type SortField = 'name' | 'category' | 'contact' | 'phone' | 'abn' | 'status' | 'spend'
type SortDirection = 'asc' | 'desc'

export default function Suppliers() {
  const navigate = useNavigate()
  const { suppliers, ingredients, purchaseOrders, isLoading, addSupplier, updateSupplier, deleteSupplier, loadSuppliersFromDB, loadPurchaseOrdersFromDB } = useDataStore()
  const { currentOrg } = useAuth()

  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Types.Supplier | null>(null)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  
  // Load suppliers and POs from Supabase on mount
  useEffect(() => {
    loadSuppliersFromDB()
    loadPurchaseOrdersFromDB()
  }, [loadSuppliersFromDB, loadPurchaseOrdersFromDB])
  
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    suburb: '',
    state: '',
    postcode: '',
    abn: '',
    is_gst_registered: true,
    category: 'other' as Types.Supplier['category'],
    payment_terms: 'net-30',
    account_number: '',
    order_method: 'email' as NonNullable<Types.Supplier['order_method']>,
    delivery_days: [1, 3, 5] as number[],
    cutoff_time: '14:00',
    delivery_lead_days: 1,
    minimum_order: '',
    notes: '',
    active: true,
  })
  
  // Monthly spend per supplier from delivered POs
  const monthlySpend = useMemo(() => {
    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)
    const spendMap: Record<string, number> = {}
    purchaseOrders
      .filter((po) => po.status === 'delivered' && isWithinInterval(new Date(po.order_date), { start: monthStart, end: monthEnd }))
      .forEach((po) => {
        spendMap[po.supplier_id] = (spendMap[po.supplier_id] || 0) + po.total
      })
    return spendMap
  }, [purchaseOrders])

  // Toggle sort
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }, [sortField])

  const filteredSuppliers = useMemo(() => {
    let result = suppliers.filter((supplier) => {
      if (statusFilter === 'active' && !supplier.active) return false
      if (statusFilter === 'inactive' && supplier.active) return false
      if (categoryFilter !== 'all' && supplier.category !== categoryFilter) return false

      const query = debouncedSearch.toLowerCase()
      if (!query) return true
      return (
        supplier.name.toLowerCase().includes(query) ||
        supplier.contact_person?.toLowerCase().includes(query) ||
        supplier.email?.toLowerCase().includes(query) ||
        supplier.phone?.includes(query) ||
        supplier.abn?.includes(query)
      )
    })

    // Sort
    result = [...result].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1
      switch (sortField) {
        case 'name':
          return dir * a.name.localeCompare(b.name)
        case 'category':
          return dir * a.category.localeCompare(b.category)
        case 'contact':
          return dir * (a.contact_person || '').localeCompare(b.contact_person || '')
        case 'phone':
          return dir * (a.phone || '').localeCompare(b.phone || '')
        case 'abn':
          return dir * (a.abn || '').localeCompare(b.abn || '')
        case 'status': {
          const aVal = a.active ? 1 : 0
          const bVal = b.active ? 1 : 0
          return dir * (aVal - bVal)
        }
        case 'spend': {
          const aSpend = monthlySpend[a.id] || 0
          const bSpend = monthlySpend[b.id] || 0
          return dir * (aSpend - bSpend)
        }
        default:
          return 0
      }
    })

    return result
  }, [suppliers, debouncedSearch, categoryFilter, statusFilter, sortField, sortDirection, monthlySpend])
  
  const getProductCount = (supplierId: string) => {
    return ingredients.filter((i) => i.supplier_id === supplierId && i.active).length
  }
  
  const handleOpenDialog = (supplier?: Types.Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier)
      setFormData({
        name: supplier.name,
        contact_person: supplier.contact_person || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        suburb: supplier.suburb || '',
        state: supplier.state || '',
        postcode: supplier.postcode || '',
        abn: supplier.abn || '',
        is_gst_registered: supplier.is_gst_registered ?? true,
        category: supplier.category || 'other',
        payment_terms: supplier.payment_terms || 'net-30',
        account_number: supplier.account_number || '',
        order_method: supplier.order_method || 'email',
        delivery_days: supplier.delivery_days,
        cutoff_time: supplier.cutoff_time,
        delivery_lead_days: supplier.delivery_lead_days,
        minimum_order: supplier.minimum_order ? (supplier.minimum_order / 100).toString() : '',
        notes: supplier.notes || '',
        active: supplier.active,
      })
    } else {
      setEditingSupplier(null)
      setFormData({
        name: '',
        contact_person: '',
        email: '',
        phone: '',
        address: '',
        suburb: '',
        state: '',
        postcode: '',
        abn: '',
        is_gst_registered: true,
        category: 'other',
        payment_terms: 'net-30',
        account_number: '',
        order_method: 'email',
        delivery_days: [1, 3, 5],
        cutoff_time: '14:00',
        delivery_lead_days: 1,
        minimum_order: '',
        notes: '',
        active: true,
      })
    }
    setDialogOpen(true)
  }
  
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Supplier name is required')
      return
    }
    
    if (formData.delivery_days.length === 0) {
      toast.error('Select at least one delivery day')
      return
    }

    // ABN validation (if provided)
    const cleanAbn = formData.abn.replace(/\s/g, '')
    if (cleanAbn && !validateABN(cleanAbn)) {
      toast.error('Invalid ABN. Must be a valid 11-digit Australian Business Number.')
      return
    }

    const supplierData = {
      name: formData.name.trim(),
      contact_person: formData.contact_person.trim() || undefined,
      email: formData.email.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      address: formData.address.trim() || undefined,
      suburb: formData.suburb.trim() || undefined,
      state: formData.state.trim() || undefined,
      postcode: formData.postcode.trim() || undefined,
      abn: cleanAbn || undefined,
      is_gst_registered: formData.is_gst_registered,
      category: formData.category,
      payment_terms: formData.payment_terms as Types.Supplier['payment_terms'],
      account_number: formData.account_number.trim() || undefined,
      order_method: formData.order_method as Types.Supplier['order_method'],
      delivery_days: formData.delivery_days,
      cutoff_time: formData.cutoff_time,
      delivery_lead_days: formData.delivery_lead_days,
      minimum_order: formData.minimum_order
        ? Math.round(parseFloat(formData.minimum_order) * 100)
        : undefined,
      notes: formData.notes.trim() || undefined,
      active: formData.active,
    }
    
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, supplierData)
        toast.success('Supplier updated')
      } else {
        const newSupplier = {
          id: crypto.randomUUID(),
          organization_id: currentOrg?.id || '',
          category: 'other' as const,
          ...supplierData,
        }
        await addSupplier(newSupplier as Types.Supplier)
        toast.success('Supplier added')
      }
      
      setDialogOpen(false)
    } catch (error) {
      toast.error('Failed to save supplier')
      console.error(error)
    }
  }
  
  const handleDelete = async (id: string, name: string) => {
    const productCount = getProductCount(id)
    
    if (productCount > 0) {
      toast.error(`Cannot delete ${name}. It has ${productCount} products. Delete products first.`)
      return
    }
    
    if (confirm(`Delete ${name}? This cannot be undone.`)) {
      try {
        await deleteSupplier(id)
        toast.success('Supplier deleted')
      } catch (error) {
        toast.error('Failed to delete supplier')
        console.error(error)
      }
    }
  }
  
  const toggleDeliveryDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      delivery_days: prev.delivery_days.includes(day)
        ? prev.delivery_days.filter((d) => d !== day)
        : [...prev.delivery_days, day],
    }))
  }
  
  const activeCount = suppliers.filter(s => s.active).length
  const inactiveCount = suppliers.filter(s => !s.active).length
  const totalMonthlySpend = Object.values(monthlySpend).reduce((a, b) => a + b, 0)

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    suppliers.forEach(s => {
      if (s.active) counts[s.category] = (counts[s.category] || 0) + 1
    })
    return counts
  }, [suppliers])

  // Sort icon helper
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />
  }

  const toolbar = (
    <PageToolbar
      title="Suppliers"
      filters={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, ABN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-[180px] pl-8 text-sm"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-[140px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'inactive')}>
            <SelectTrigger className="h-8 w-[110px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
      primaryAction={{ label: "Add Supplier", icon: Plus, onClick: () => handleOpenDialog(), variant: "primary" }}
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-4 pt-4 space-y-3">
        <StatCards stats={[
          { label: "Active", value: activeCount },
          { label: "Inactive", value: inactiveCount },
          { label: "This Month", value: formatCurrency(totalMonthlySpend) },
        ]} columns={3} />
        {Object.keys(categoryCounts).length > 0 && (
          <SecondaryStats stats={Object.entries(categoryCounts).map(([cat, count]) => ({
            label: CATEGORY_LABELS[cat] || cat,
            value: count,
          }))} />
        )}
      </div>
      <div className="p-4">
      {isLoading && suppliers.length === 0 ? (
        <Card className="p-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
          <p className="text-muted-foreground">Loading suppliers...</p>
        </Card>
      ) : filteredSuppliers.length === 0 && !debouncedSearch ? (
        <Card className="p-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Suppliers Yet</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Add your first supplier to start managing products and ordering
          </p>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Supplier
          </Button>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('name')}>
                  <span className="flex items-center">Name <SortIcon field="name" /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('category')}>
                  <span className="flex items-center">Category <SortIcon field="category" /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('contact')}>
                  <span className="flex items-center">Contact <SortIcon field="contact" /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('phone')}>
                  <span className="flex items-center">Phone <SortIcon field="phone" /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('abn')}>
                  <span className="flex items-center">ABN <SortIcon field="abn" /></span>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('status')}>
                  <span className="flex items-center">Status <SortIcon field="status" /></span>
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('spend')}>
                  <span className="flex items-center justify-end">Monthly Spend <SortIcon field="spend" /></span>
                </TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => {
                const spend = monthlySpend[supplier.id] || 0
                return (
                  <TableRow
                    key={supplier.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/suppliers/${supplier.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{supplier.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[supplier.category] || supplier.category}
                      </Badge>
                    </TableCell>
                    <TableCell>{supplier.contact_person || '—'}</TableCell>
                    <TableCell>{supplier.phone || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {supplier.abn ? supplier.abn.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4') : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={supplier.active ? 'default' : 'secondary'}>
                        {supplier.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {spend > 0 ? (
                        <span className="flex items-center justify-end gap-1 text-sm font-medium">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          {(spend / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(supplier)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(supplier.id, supplier.name)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/suppliers/${supplier.id}`)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          
          {filteredSuppliers.length === 0 && searchQuery && (
            <div className="p-12 text-center">
              <p className="text-muted-foreground">
                No suppliers found matching {debouncedSearch}
              </p>
            </div>
          )}
        </Card>
      )}
      
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Supplier Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ABC Food Supplies"
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v as Types.Supplier['category'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.filter(o => o.value !== 'all').map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contact_person">Contact Name</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="John Smith"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0400 000 000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="orders@supplier.com"
                />
              </div>
              <div>
                <Label htmlFor="order_method">Order Method</Label>
                <Select
                  value={formData.order_method}
                  onValueChange={(v) => setFormData({ ...formData, order_method: v as NonNullable<Types.Supplier['order_method']> })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="online_portal">Online Portal</SelectItem>
                    <SelectItem value="rep_visit">Rep Visit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ABN & GST */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="abn">ABN</Label>
                <Input
                  id="abn"
                  value={formData.abn}
                  onChange={(e) => setFormData({ ...formData, abn: e.target.value })}
                  placeholder="12 345 678 901"
                  maxLength={14}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">11-digit Australian Business Number</p>
              </div>
              <div className="flex items-end pb-5">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_gst_registered"
                    checked={formData.is_gst_registered}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_gst_registered: checked as boolean })}
                  />
                  <Label htmlFor="is_gst_registered">GST Registered</Label>
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <Label htmlFor="address">Street Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Supply St"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="suburb">Suburb</Label>
                <Input
                  id="suburb"
                  value={formData.suburb}
                  onChange={(e) => setFormData({ ...formData, suburb: e.target.value })}
                  placeholder="Melbourne"
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Select
                  value={formData.state || '_none'}
                  onValueChange={(v) => setFormData({ ...formData, state: v === '_none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Select</SelectItem>
                    <SelectItem value="VIC">VIC</SelectItem>
                    <SelectItem value="NSW">NSW</SelectItem>
                    <SelectItem value="QLD">QLD</SelectItem>
                    <SelectItem value="WA">WA</SelectItem>
                    <SelectItem value="SA">SA</SelectItem>
                    <SelectItem value="TAS">TAS</SelectItem>
                    <SelectItem value="ACT">ACT</SelectItem>
                    <SelectItem value="NT">NT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  value={formData.postcode}
                  onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                  placeholder="3000"
                  maxLength={4}
                />
              </div>
            </div>

            {/* Payment & Account */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="payment_terms">Payment Terms</Label>
                <Select
                  value={formData.payment_terms}
                  onValueChange={(value) => setFormData({ ...formData, payment_terms: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cod">COD</SelectItem>
                    <SelectItem value="net-7">Net 7</SelectItem>
                    <SelectItem value="net-14">Net 14</SelectItem>
                    <SelectItem value="net-30">Net 30</SelectItem>
                    <SelectItem value="net-60">Net 60</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="account_number">Account Number</Label>
                <Input
                  id="account_number"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  placeholder="ACC123456"
                />
              </div>
            </div>
            
            <div className="border-t pt-4">
              <Label className="mb-2 block">Delivery Days *</Label>
              <div className="grid grid-cols-4 gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`day-${day.value}`}
                      checked={formData.delivery_days.includes(day.value)}
                      onCheckedChange={() => toggleDeliveryDay(day.value)}
                    />
                    <Label htmlFor={`day-${day.value}`} className="text-sm">
                      {day.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="cutoff_time">Order Cutoff *</Label>
                <Input
                  id="cutoff_time"
                  type="time"
                  value={formData.cutoff_time}
                  onChange={(e) => setFormData({ ...formData, cutoff_time: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="delivery_lead_days">Lead Days *</Label>
                <Input
                  id="delivery_lead_days"
                  type="number"
                  min="0"
                  value={formData.delivery_lead_days}
                  onChange={(e) => setFormData({ ...formData, delivery_lead_days: parseInt(e.target.value) || 1 })}
                />
              </div>
              
              <div>
                <Label htmlFor="minimum_order">Min Order ($)</Label>
                <Input
                  id="minimum_order"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.minimum_order}
                  onChange={(e) => setFormData({ ...formData, minimum_order: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any special instructions"
                rows={2}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked as boolean })}
              />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingSupplier ? 'Update' : 'Add'} Supplier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </PageShell>
  )
}
