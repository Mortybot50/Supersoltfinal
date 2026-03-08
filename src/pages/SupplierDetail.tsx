import { useAuth } from "@/contexts/AuthContext"
import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from '@/components/ui/breadcrumb'
import {
  ArrowLeft,
  Building2,
  Package,
  Plus,
  Edit,
  Trash2,
  Search,
  ShoppingCart,
} from 'lucide-react'
import { getBaseUnit, calculatePackToBaseFactor, calculateCostPerBaseUnit, formatPackSizeText, formatBaseUnitCost } from '@/lib/utils/unitConversions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useDataStore } from '@/lib/store/dataStore'
import { Ingredient } from '@/types'
import { toast } from 'sonner'
import { PageShell, PageToolbar } from '@/components/shared'
import { StatCards } from '@/components/ui/StatCards'
import { SecondaryStats } from '@/components/ui/SecondaryStats'
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns'

const CATEGORIES = [
  { value: 'produce', label: 'Produce' },
  { value: 'meat', label: 'Meat & Seafood' },
  { value: 'seafood', label: 'Seafood' },
  { value: 'dairy', label: 'Dairy & Eggs' },
  { value: 'dry-goods', label: 'Dry Goods' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'other', label: 'Other' },
]

const UNITS = ['kg', 'g', 'L', 'mL', 'ea', 'case', 'dozen', 'box', 'bag', 'bunch']

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function SupplierDetail() {
  const { currentVenue } = useAuth()
  const { supplierId } = useParams()
  const navigate = useNavigate()
  const { suppliers, ingredients, purchaseOrders, addIngredient, updateIngredient, deleteIngredient, loadSuppliersFromDB, loadIngredientsFromDB, loadPurchaseOrdersFromDB } = useDataStore()
  
  const supplier = suppliers.find((s) => s.id === supplierId)
  
  // Redirect if supplier not found
  useEffect(() => {
    if (suppliers.length > 0 && !supplier) {
      navigate('/suppliers')
      toast.error('Supplier not found')
    }
  }, [supplier, suppliers.length, navigate])
  
  const [activeTab, setActiveTab] = useState('products')
  const [searchQuery, setSearchQuery] = useState('')
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Ingredient | null>(null)
  
  // Load data from Supabase on mount
  useEffect(() => {
    loadSuppliersFromDB()
    loadIngredientsFromDB()
    loadPurchaseOrdersFromDB()
  }, [loadSuppliersFromDB, loadIngredientsFromDB, loadPurchaseOrdersFromDB])
  
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'produce' as Ingredient['category'],
    unit: 'kg',
    units_per_pack: 1,
    unit_size: 1,
    cost_per_unit: '',
    gst_applicable: true,
    current_stock: 0,
    par_level: 0,
    reorder_point: 0,
    product_code: '',
    notes: '',
    active: true,
  })
  
  const supplierProducts = useMemo(() => {
    return ingredients.filter((p) => p.supplier_id === supplierId)
  }, [ingredients, supplierId])
  
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return supplierProducts
    
    const query = searchQuery.toLowerCase()
    return supplierProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        p.product_code?.toLowerCase().includes(query)
    )
  }, [supplierProducts, searchQuery])
  
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, Ingredient[]> = {}
    filteredProducts.forEach((product) => {
      if (!grouped[product.category]) {
        grouped[product.category] = []
      }
      grouped[product.category].push(product)
    })
    return grouped
  }, [filteredProducts])
  
  // Purchase orders for this supplier
  const supplierPOs = useMemo(() => {
    return purchaseOrders
      .filter((po) => po.supplier_id === supplierId)
      .sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime())
  }, [purchaseOrders, supplierId])

  // Monthly spend tracking
  const spendMetrics = useMemo(() => {
    const now = new Date()
    const thisMonthStart = startOfMonth(now)
    const thisMonthEnd = endOfMonth(now)
    const lastMonthStart = startOfMonth(subMonths(now, 1))
    const lastMonthEnd = endOfMonth(subMonths(now, 1))

    let thisMonth = 0
    let lastMonth = 0
    let allTime = 0

    supplierPOs
      .filter((po) => po.status === 'delivered')
      .forEach((po) => {
        const d = new Date(po.order_date)
        allTime += po.total
        if (isWithinInterval(d, { start: thisMonthStart, end: thisMonthEnd })) thisMonth += po.total
        if (isWithinInterval(d, { start: lastMonthStart, end: lastMonthEnd })) lastMonth += po.total
      })

    return { thisMonth, lastMonth, allTime, orderCount: supplierPOs.length }
  }, [supplierPOs])

  const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`

  const PO_STATUS_COLORS: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    submitted: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-yellow-100 text-yellow-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  }

  if (!supplier) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">Supplier not found</p>
        <Button onClick={() => navigate('/suppliers')} className="mt-4">
          Back to Suppliers
        </Button>
      </Card>
    )
  }

  const ORDER_METHOD_LABELS: Record<string, string> = {
    email: 'Email',
    phone: 'Phone',
    online_portal: 'Online Portal',
    rep_visit: 'Rep Visit',
  }
  
  const handleOpenProductDialog = (product?: Ingredient) => {
    if (product) {
      setEditingProduct(product)
      setProductForm({
        name: product.name,
        category: product.category,
        unit: product.unit,
        units_per_pack: product.units_per_pack || 1,
        unit_size: product.unit_size || product.pack_size || 1,
        cost_per_unit: (product.cost_per_unit / 100).toString(),
        gst_applicable: product.gst_applicable ?? true,
        current_stock: product.current_stock,
        par_level: product.par_level,
        reorder_point: product.reorder_point,
        product_code: product.product_code || '',
        notes: product.notes || '',
        active: product.active,
      })
    } else {
      setEditingProduct(null)
      setProductForm({
        name: '',
        category: 'produce',
        unit: 'kg',
        units_per_pack: 1,
        unit_size: 1,
        cost_per_unit: '',
        gst_applicable: true,
        current_stock: 0,
        par_level: 0,
        reorder_point: 0,
        product_code: '',
        notes: '',
        active: true,
      })
    }
    setProductDialogOpen(true)
  }
  
  const handleSaveProduct = async () => {
    if (!productForm.name.trim()) {
      toast.error('Product name is required')
      return
    }
    
    if (!productForm.cost_per_unit || parseFloat(productForm.cost_per_unit) <= 0) {
      toast.error('Valid cost is required')
      return
    }
    
    // Compute derived fields
    const unitsPerPack = productForm.units_per_pack || 1
    const unitSize = productForm.unit_size || 1
    const unit = productForm.unit
    const costCents = Math.round(parseFloat(productForm.cost_per_unit) * 100)

    const baseUnit = getBaseUnit(unit)
    const packToBaseFactor = calculatePackToBaseFactor(unitsPerPack, unitSize, unit)
    const unitCostExBase = calculateCostPerBaseUnit(costCents, packToBaseFactor)
    const packSizeText = formatPackSizeText(unitsPerPack, unitSize, unit)
    
    const productData: Partial<Ingredient> = {
      name: productForm.name.trim(),
      category: productForm.category,
      unit: unit,
      units_per_pack: unitsPerPack,
      unit_size: unitSize,
      base_unit: baseUnit,
      pack_to_base_factor: packToBaseFactor,
      unit_cost_ex_base: unitCostExBase,
      pack_size_text: packSizeText,
      pack_size: unitSize, // Keep for backwards compatibility
      cost_per_unit: costCents,
      gst_applicable: productForm.gst_applicable,
      current_stock: productForm.current_stock,
      par_level: productForm.par_level,
      reorder_point: productForm.reorder_point,
      product_code: productForm.product_code.trim() || undefined,
      notes: productForm.notes.trim() || undefined,
      active: productForm.active,
    }
    
    try {
      if (editingProduct) {
        await updateIngredient(editingProduct.id, productData)
        toast.success('Product updated')
      } else {
        const newIngredient = {
          id: crypto.randomUUID(),
          venue_id: currentVenue?.id || '',
          supplier_id: supplierId!,
          supplier_name: supplier.name,
          ...productData,
          last_cost_update: new Date(),
        } as Ingredient
        await addIngredient(newIngredient)
        toast.success('Product added')
      }
      
      setProductDialogOpen(false)
    } catch (error) {
      toast.error('Failed to save product')
      console.error(error)
    }
  }
  
  const handleDeleteProduct = async (id: string, name: string) => {
    if (confirm(`Delete ${name}? This cannot be undone.`)) {
      try {
        await deleteIngredient(id)
        toast.success('Product deleted')
      } catch (error) {
        toast.error('Failed to delete product')
        console.error(error)
      }
    }
  }
  
  // Computed values for unit conversions
  const baseUnit = getBaseUnit(productForm.unit)
  const packToBaseFactor = calculatePackToBaseFactor(productForm.units_per_pack || 1, productForm.unit_size || 1, productForm.unit)
  const costCents = parseFloat(productForm.cost_per_unit || '0') * 100
  const costPerBaseUnit = calculateCostPerBaseUnit(costCents, packToBaseFactor)
  const baseUnitCostDisplay = formatBaseUnitCost(costPerBaseUnit, baseUnit)
  const packSizeText = formatPackSizeText(productForm.units_per_pack || 1, productForm.unit_size || 1, productForm.unit)
  
  // Don't render if supplier not found
  if (!supplier) {
    return null
  }
  
  const toolbar = (
    <PageToolbar
      title={supplier.name}
      filters={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/suppliers')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Badge variant={supplier.active ? 'default' : 'secondary'}>
            {supplier.active ? 'Active' : 'Inactive'}
          </Badge>
          {supplier.abn && (
            <span className="text-xs text-muted-foreground font-mono">
              ABN {supplier.abn.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')}
            </span>
          )}
        </div>
      }
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-4 pt-4 space-y-3">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink asChild><Link to="/inventory/suppliers">Suppliers</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{supplier.name}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
        <StatCards stats={[
          { label: 'Products', value: supplierProducts.length },
          { label: 'Orders', value: spendMetrics.orderCount },
          { label: 'This Month', value: formatCurrency(spendMetrics.thisMonth) },
        ]} columns={3} />
        <SecondaryStats stats={[
          { label: 'Last Month', value: formatCurrency(spendMetrics.lastMonth) },
          { label: 'All Time', value: formatCurrency(spendMetrics.allTime) },
          { label: 'Lead Time', value: `${supplier.delivery_lead_days}d` },
          { label: 'Payment', value: supplier.payment_terms?.toUpperCase() || '—' },
        ]} />
      </div>
      <div className="p-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="products">
            <Package className="h-4 w-4 mr-2" />
            Products ({supplierProducts.length})
          </TabsTrigger>
          <TabsTrigger value="orders">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Orders ({supplierPOs.length})
          </TabsTrigger>
          <TabsTrigger value="info">
            <Building2 className="h-4 w-4 mr-2" />
            Info
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => handleOpenProductDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </div>

            {supplierProducts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Products Yet</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Add products that {supplier.name} supplies
                </p>
                <Button onClick={() => handleOpenProductDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Product
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(productsByCategory).map(([category, products]) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-3">
                      {CATEGORIES.find((c) => c.value === category)?.label || category}
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product Name</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Pack Size</TableHead>
                          <TableHead>Cost</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead>Par</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-24"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product: Ingredient) => (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell>{product.unit}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs">
                                {formatPackSizeText(product.units_per_pack || 1, product.unit_size || product.pack_size || 1, product.unit)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              ${(product.cost_per_unit / 100).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={
                                  product.current_stock < product.reorder_point
                                    ? 'text-red-600 font-semibold'
                                    : ''
                                }
                              >
                                {product.current_stock}
                              </span>
                            </TableCell>
                            <TableCell>{product.par_level}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {product.product_code || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={product.active ? 'default' : 'secondary'}>
                                {product.active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenProductDialog(product)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteProduct(product.id, product.name)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          {supplierPOs.length === 0 ? (
            <Card className="p-12 text-center">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Orders Yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Order history will appear here once you start placing orders
              </p>
              <Button onClick={() => navigate(`/inventory/purchase-orders/new?supplier=${supplierId}`)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Purchase Order
              </Button>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Expected Delivery</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierPOs.map((po) => (
                    <TableRow
                      key={po.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/inventory/purchase-orders/${po.id}`)}
                    >
                      <TableCell className="font-mono font-medium">{po.po_number}</TableCell>
                      <TableCell>{format(new Date(po.order_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{format(new Date(po.expected_delivery_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell>
                        <Badge className={PO_STATUS_COLORS[po.status] || ''}>
                          {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{po.items?.length || 0}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(po.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="info">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-6">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-4">Contact Details</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Contact Name</Label>
                  <p className="font-medium">{supplier.contact_person || '—'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Email</Label>
                  <p className="font-medium">{supplier.email || '—'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Phone</Label>
                  <p className="font-medium">{supplier.phone || '—'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Order Method</Label>
                  <p className="font-medium">{ORDER_METHOD_LABELS[supplier.order_method || ''] || '—'}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-4">Business Details</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground text-xs">ABN</Label>
                  <p className="font-medium font-mono">
                    {supplier.abn
                      ? supplier.abn.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')
                      : '—'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">GST Registered</Label>
                  <p className="font-medium">{supplier.is_gst_registered ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Account Number</Label>
                  <p className="font-medium">{supplier.account_number || '—'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Payment Terms</Label>
                  <p className="font-medium">{supplier.payment_terms?.toUpperCase() || '—'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Minimum Order</Label>
                  <p className="font-medium">
                    {supplier.minimum_order ? formatCurrency(supplier.minimum_order) : '—'}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-4">Address</h3>
              <div className="space-y-1">
                {supplier.address && <p className="font-medium">{supplier.address}</p>}
                {(supplier.suburb || supplier.state || supplier.postcode) && (
                  <p className="font-medium">
                    {[supplier.suburb, supplier.state, supplier.postcode].filter(Boolean).join(' ')}
                  </p>
                )}
                {!supplier.address && !supplier.suburb && (
                  <p className="text-muted-foreground">No address on file</p>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-4">Delivery</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Delivery Days</Label>
                  <div className="flex gap-1 mt-1">
                    {supplier.delivery_days.map((day) => (
                      <Badge key={day} variant="outline" className="text-xs">
                        {DAYS_OF_WEEK[day]}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Order Cutoff</Label>
                  <p className="font-medium">{supplier.cutoff_time}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Lead Time</Label>
                  <p className="font-medium">{supplier.delivery_lead_days} day{supplier.delivery_lead_days !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </Card>

            {supplier.notes && (
              <Card className="p-6 col-span-full">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-2">Notes</h3>
                <p className="text-sm whitespace-pre-wrap">{supplier.notes}</p>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
      
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Edit Product' : 'Add Product'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="prod_name">Product Name *</Label>
                <Input
                  id="prod_name"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="e.g., Tomatoes - Roma"
                />
              </div>
              
              <div>
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={productForm.category}
                  onValueChange={(value: Ingredient['category']) => setProductForm({ ...productForm, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="unit">Unit *</Label>
                <Select
                  value={productForm.unit}
                  onValueChange={(value) => setProductForm({ ...productForm, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="unit_size">Unit Size *</Label>
                <Input
                  id="unit_size"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={productForm.unit_size}
                  onChange={(e) => setProductForm({ ...productForm, unit_size: parseFloat(e.target.value) || 1 })}
                  placeholder="1.0"
                />
                <p className="text-xs text-muted-foreground mt-1">e.g., 1.5 for 1.5kg tubs</p>
              </div>
              
              <div className="flex items-center pt-6">
                <Badge variant="outline" className="font-mono text-lg px-4 py-2">
                  {packSizeText}
                </Badge>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cost">Cost per Unit ($) *</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={productForm.cost_per_unit}
                  onChange={(e) => setProductForm({ ...productForm, cost_per_unit: e.target.value })}
                  placeholder="0.00"
                />
                {parseFloat(productForm.cost_per_unit || '0') > 0 && (
                  <div className="mt-2 rounded-md bg-muted/50 p-3 text-sm">
                    <span className="text-muted-foreground">≈ Base unit cost: </span>
                    <span className="font-medium">{baseUnitCostDisplay}</span>
                    <span className="text-muted-foreground"> (ex-GST)</span>
                  </div>
                )}
              </div>
              
              <div>
                <Label htmlFor="product_code">Product Code</Label>
                <Input
                  id="product_code"
                  value={productForm.product_code}
                  onChange={(e) => setProductForm({ ...productForm, product_code: e.target.value })}
                  placeholder="Supplier's code"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="current_stock">Current Stock</Label>
                <Input
                  id="current_stock"
                  type="number"
                  min="0"
                  value={productForm.current_stock}
                  onChange={(e) => setProductForm({ ...productForm, current_stock: parseFloat(e.target.value) || 0 })}
                />
              </div>
              
              <div>
                <Label htmlFor="par_level">Par Level *</Label>
                <Input
                  id="par_level"
                  type="number"
                  min="0"
                  value={productForm.par_level}
                  onChange={(e) => setProductForm({ ...productForm, par_level: parseFloat(e.target.value) || 0 })}
                />
              </div>
              
              <div>
                <Label htmlFor="reorder_point">Reorder Point *</Label>
                <Input
                  id="reorder_point"
                  type="number"
                  min="0"
                  value={productForm.reorder_point}
                  onChange={(e) => setProductForm({ ...productForm, reorder_point: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="prod_notes">Notes</Label>
              <Textarea
                id="prod_notes"
                value={productForm.notes}
                onChange={(e) => setProductForm({ ...productForm, notes: e.target.value })}
                placeholder="Any special notes"
                rows={2}
              />
            </div>
            
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="gst"
                  checked={productForm.gst_applicable}
                  onCheckedChange={(checked) =>
                    setProductForm({ ...productForm, gst_applicable: checked as boolean })
                  }
                />
                <Label htmlFor="gst">GST Applicable</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="prod_active"
                  checked={productForm.active}
                  onCheckedChange={(checked) =>
                    setProductForm({ ...productForm, active: checked as boolean })
                  }
                />
                <Label htmlFor="prod_active">Active</Label>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProduct}>
              {editingProduct ? 'Update' : 'Add'} Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </PageShell>
  )
}
