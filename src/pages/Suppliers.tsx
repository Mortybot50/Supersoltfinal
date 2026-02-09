import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Building2, Edit, Trash2, ChevronRight } from 'lucide-react'
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
import { PageShell, PageToolbar, PageSidebar } from '@/components/shared'

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

export default function Suppliers() {
  const navigate = useNavigate()
  const { suppliers, ingredients, addSupplier, updateSupplier, deleteSupplier, loadSuppliersFromDB } = useDataStore()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Types.Supplier | null>(null)
  
  // Load suppliers from Supabase on mount
  useEffect(() => {
    loadSuppliersFromDB()
  }, [])
  
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    suburb: '',
    state: '',
    postcode: '',
    payment_terms: 'net-30',
    account_number: '',
    delivery_days: [1, 3, 5] as number[],
    cutoff_time: '14:00',
    delivery_lead_days: 1,
    minimum_order: '',
    notes: '',
    active: true,
  })
  
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => {
      const query = searchQuery.toLowerCase()
      return (
        supplier.name.toLowerCase().includes(query) ||
        supplier.contact_person?.toLowerCase().includes(query) ||
        supplier.email?.toLowerCase().includes(query) ||
        supplier.phone?.includes(query)
      )
    })
  }, [suppliers, searchQuery])
  
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
        payment_terms: supplier.payment_terms || 'net-30',
        account_number: supplier.account_number || '',
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
        payment_terms: 'net-30',
        account_number: '',
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
    
    const supplierData = {
      name: formData.name.trim(),
      contact_person: formData.contact_person.trim() || undefined,
      email: formData.email.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      address: formData.address.trim() || undefined,
      suburb: formData.suburb.trim() || undefined,
      state: formData.state.trim() || undefined,
      postcode: formData.postcode.trim() || undefined,
      payment_terms: formData.payment_terms as Types.Supplier['payment_terms'],
      account_number: formData.account_number.trim() || undefined,
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
          organization_id: 'org-1',
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

  const sidebar = (
    <PageSidebar
      title="Suppliers"
      metrics={[
        { label: "Active", value: activeCount },
        { label: "Inactive", value: inactiveCount },
        { label: "Total", value: suppliers.length },
      ]}
    />
  )

  const toolbar = (
    <PageToolbar
      title="Suppliers"
      filters={
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-[200px] pl-8 text-sm"
          />
        </div>
      }
      primaryAction={{ label: "Add Supplier", icon: Plus, onClick: () => handleOpenDialog(), variant: "teal" }}
    />
  )

  return (
    <PageShell sidebar={sidebar} toolbar={toolbar}>
      <div className="p-4">
      {filteredSuppliers.length === 0 && !searchQuery ? (
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
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => (
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
                  <TableCell>{supplier.contact_person || '—'}</TableCell>
                  <TableCell>{supplier.email || '—'}</TableCell>
                  <TableCell>{supplier.phone || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getProductCount(supplier.id)} products
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={supplier.active ? 'default' : 'secondary'}>
                      {supplier.active ? 'Active' : 'Inactive'}
                    </Badge>
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
              ))}
            </TableBody>
          </Table>
          
          {filteredSuppliers.length === 0 && searchQuery && (
            <div className="p-12 text-center">
              <p className="text-muted-foreground">
                No suppliers found matching "{searchQuery}"
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
                <Label htmlFor="contact_person">Contact Name</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="John Smith"
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
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0400 000 000"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Supply St, Melbourne VIC 3000"
                rows={2}
              />
            </div>
            
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
