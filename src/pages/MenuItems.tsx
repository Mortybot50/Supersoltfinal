import { useAuth } from '@/contexts/AuthContext'
import { useState, useMemo, useEffect } from 'react'
import { useDebounce } from '@/lib/hooks/useDebounce'
import {
  Plus,
  Search,
  ChefHat,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Download,
  Eye,
  EyeOff,
  Edit,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useDataStore } from '@/lib/store/dataStore'
import { COMMON_MENU_TAGS, MenuItem, MenuSection } from '@/types'
import { toast } from 'sonner'
import { PageShell, PageToolbar } from '@/components/shared'
import { getDefaultOrgSettings } from '@/lib/venueSettings'

export default function MenuItems() {
  const {
    menuSections,
    menuItems,
    recipes,
    loadMenuSectionsFromDB,
    loadMenuItemsFromDB,
    loadRecipesFromDB,
    addMenuSection,
    updateMenuSection,
    deleteMenuSection,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    getSectionItems,
    calculateSectionTotals,
    calculateMenuAnalytics,
  } = useDataStore()
  const { currentOrg, currentVenue } = useAuth()

  useEffect(() => {
    loadMenuSectionsFromDB()
    loadMenuItemsFromDB()
    loadRecipesFromDB()
  }, [loadMenuSectionsFromDB, loadMenuItemsFromDB, loadRecipesFromDB])

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false)
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<MenuSection | null>(null)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  
  const [sectionForm, setSectionForm] = useState({
    name: '',
    is_drinks: false,
    tax_mode: 'FOLLOW_ITEM' as MenuSection['tax_mode'],
  })
  
  const [itemForm, setItemForm] = useState({
    name: '',
    recipe_id: '',
    price_mode: 'AUTO_FROM_RECIPE' as MenuItem['price_mode'],
    price: 0,
    gst_mode: 'INC' as MenuItem['gst_mode'],
    gst_rate_percent: 10,
    plu_code: '',
    show_on_menu: true,
    tags: [] as string[],
    allergens: [] as string[],
    abv_percent: 0,
    volume_ml: 0,
  })
  
  // Auto-select first section
  useEffect(() => {
    if (!selectedSectionId && menuSections.length > 0) {
      setSelectedSectionId(menuSections[0].id)
    }
  }, [menuSections, selectedSectionId])
  
  // Get current section
  const selectedSection = selectedSectionId
    ? menuSections.find((s) => s.id === selectedSectionId)
    : null
  
  // Get items for selected section
  const sectionItems = useMemo(
    () => selectedSectionId ? getSectionItems(selectedSectionId) : [],
    [selectedSectionId, getSectionItems]
  )
  
  // Calculate section totals
  const sectionTotals = selectedSectionId
    ? calculateSectionTotals(selectedSectionId)
    : null
  
  // Calculate menu analytics
  const analytics = calculateMenuAnalytics()
  
  // Published recipes only
  const publishedRecipes = recipes.filter((r) => r.status === 'published')
  
  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return sectionItems
    
    const query = debouncedSearch.toLowerCase()
    return sectionItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.recipe_name?.toLowerCase().includes(query) ||
        item.plu_code?.toLowerCase().includes(query) ||
        item.tags.some((tag) => tag.toLowerCase().includes(query))
    )
  }, [sectionItems, debouncedSearch])
  
  // Section Dialog Handlers
  const handleOpenSectionDialog = (section?: MenuSection) => {
    if (section) {
      setEditingSection(section)
      setSectionForm({
        name: section.name,
        is_drinks: section.is_drinks,
        tax_mode: section.tax_mode,
      })
    } else {
      setEditingSection(null)
      setSectionForm({
        name: '',
        is_drinks: false,
        tax_mode: 'FOLLOW_ITEM',
      })
    }
    setSectionDialogOpen(true)
  }
  
  const handleSaveSection = async () => {
    if (!sectionForm.name.trim()) {
      toast.error('Section name is required')
      return
    }
    
    try {
      if (editingSection) {
        await updateMenuSection(editingSection.id, sectionForm)
        toast.success('Section updated')
      } else {
        const newSection: MenuSection = {
          id: crypto.randomUUID(),
          organization_id: currentOrg?.id || '',
          ...sectionForm,
          display_order: menuSections.length,
          created_at: new Date(),
          updated_at: new Date(),
        }
        await addMenuSection(newSection)
        setSelectedSectionId(newSection.id)
        toast.success('Section added')
      }
      setSectionDialogOpen(false)
    } catch {
      // Error already toasted in store
    }
  }
  
  const handleDeleteSection = async (section: MenuSection) => {
    const items = getSectionItems(section.id)
    
    if (items.length > 0) {
      toast.error(`Cannot delete ${section.name}. It has ${items.length} items.`)
      return
    }
    
    if (confirm(`Delete ${section.name}?`)) {
      try {
        await deleteMenuSection(section.id)
        setSelectedSectionId(null)
        toast.success('Section deleted')
      } catch {
        // Error already toasted in store
      }
    }
  }
  
  // Item Dialog Handlers
  const handleOpenItemDialog = (item?: MenuItem) => {
    if (item) {
      setEditingItem(item)
      setItemForm({
        name: item.name,
        recipe_id: item.recipe_id,
        price_mode: item.price_mode,
        price: item.price / 100, // Convert from cents
        gst_mode: item.gst_mode,
        gst_rate_percent: item.gst_rate_percent,
        plu_code: item.plu_code || '',
        show_on_menu: item.show_on_menu,
        tags: item.tags,
        allergens: item.allergens,
        abv_percent: item.abv_percent || 0,
        volume_ml: item.volume_ml || 0,
      })
    } else {
      setEditingItem(null)
      setItemForm({
        name: '',
        recipe_id: '',
        price_mode: 'AUTO_FROM_RECIPE',
        price: 0,
        gst_mode: selectedSection?.is_drinks ? 'INC' : 'INC',
        gst_rate_percent: 10,
        plu_code: '',
        show_on_menu: true,
        tags: [],
        allergens: [],
        abv_percent: 0,
        volume_ml: 0,
      })
    }
    setItemDialogOpen(true)
  }
  
  const handleRecipeChange = (recipeId: string) => {
    const recipe = recipes.find((r) => r.id === recipeId)
    if (recipe) {
      setItemForm({
        ...itemForm,
        recipe_id: recipeId,
        name: itemForm.name || recipe.name,
        allergens: recipe.allergens,
      })
    }
  }
  
  const handleSaveItem = () => {
    if (!itemForm.name.trim()) {
      toast.error('Item name is required')
      return
    }
    
    if (!itemForm.recipe_id) {
      toast.error('Recipe is required')
      return
    }
    
    if (itemForm.price_mode === 'MANUAL' && itemForm.price <= 0) {
      toast.error('Price must be greater than 0')
      return
    }
    
    const recipe = recipes.find((r) => r.id === itemForm.recipe_id)
    if (!recipe) {
      toast.error('Recipe not found')
      return
    }
    
    const itemData = {
      section_id: selectedSectionId!,
      name: itemForm.name,
      recipe_id: itemForm.recipe_id,
      price_mode: itemForm.price_mode,
      price: Math.round(itemForm.price * 100), // Convert to cents
      gst_mode: itemForm.gst_mode,
      gst_rate_percent: itemForm.gst_rate_percent,
      plu_code: itemForm.plu_code || undefined,
      show_on_menu: itemForm.show_on_menu,
      tags: itemForm.tags,
      allergens: itemForm.allergens,
      cost_per_serve: recipe.cost_per_serve,
      gp_target_percent: recipe.gp_target_percent,
      ...(selectedSection?.is_drinks && {
        abv_percent: itemForm.abv_percent || undefined,
        volume_ml: itemForm.volume_ml || undefined,
      }),
    }
    
    if (editingItem) {
      updateMenuItem(editingItem.id, itemData as Partial<MenuItem>)
      toast.success('Menu item updated')
    } else {
      const newItem = {
        id: crypto.randomUUID(),
        organization_id: currentOrg?.id || '',
        venue_id: currentVenue?.id || '',
        ...itemData,
        display_order: sectionItems.length,
        created_at: new Date(),
        updated_at: new Date(),
      }
      addMenuItem(newItem as MenuItem)
      toast.success('Menu item added')
    }
    
    setItemDialogOpen(false)
  }
  
  const handleDeleteItem = (item: MenuItem) => {
    if (confirm(`Delete ${item.name}?`)) {
      deleteMenuItem(item.id)
      toast.success('Menu item deleted')
    }
  }
  
  const toggleItemVisibility = (item: MenuItem) => {
    updateMenuItem(item.id, { show_on_menu: !item.show_on_menu })
  }
  
  const toggleTag = (tag: string) => {
    setItemForm({
      ...itemForm,
      tags: itemForm.tags.includes(tag)
        ? itemForm.tags.filter((t) => t !== tag)
        : [...itemForm.tags, tag],
    })
  }
  
  // Export Handlers
  const handleExport = (format: 'csv' | 'json') => {
    const exportData = menuItems
      .filter((item) => item.show_on_menu)
      .map((item) => {
        const section = menuSections.find((s) => s.id === item.section_id)
        const priceIncGst =
          item.gst_mode === 'INC'
            ? item.effective_price
            : (item.effective_price || 0) + (item.gst_amount || 0)
        
        return {
          section_name: section?.name || '',
          item_name: item.name,
          plu_code: item.plu_code || '',
          price_inc_gst: ((priceIncGst || 0) / 100).toFixed(2),
          price_ex_gst: ((item.price_ex_gst || 0) / 100).toFixed(2),
          gst_rate_percent: item.gst_rate_percent,
          gst_mode: item.gst_mode,
          recipe_id: item.recipe_id,
          tags: item.tags.join(', '),
          allergens: item.allergens.join(', '),
        }
      })
    
    if (format === 'csv') {
      const headers = Object.keys(exportData[0] || {})
      const csv = [
        headers.join(','),
        ...exportData.map((row) => headers.map((h) => row[h as keyof typeof row]).join(',')),
      ].join('\n')
      
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `menu-export-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      
      toast.success('Menu exported to CSV')
    } else {
      const json = JSON.stringify(exportData, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `menu-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      
      toast.success('Menu exported to JSON')
    }
    
    setExportDialogOpen(false)
  }
  
  // GP% color thresholds: green ≥65%, amber 50-65%, red <50%
  const getGPColor = (gpPercent: number) => {
    if (gpPercent < 50) return 'text-red-600'
    if (gpPercent < 65) return 'text-amber-600'
    return 'text-green-600'
  }

  // GP alerts: count items below the org-level threshold
  const gpThreshold = getDefaultOrgSettings().below_gp_threshold_alert_percent ?? 60
  const belowGPItems = useMemo(() => {
    return menuItems.filter(
      (item) => item.gp_percent !== undefined && item.gp_percent < gpThreshold
    )
  }, [menuItems, gpThreshold])
  
  const toolbar = (
    <PageToolbar
      title="Menu Items"
      filters={
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-[200px] pl-8 text-sm border-border/60"
          />
        </div>
      }
      primaryAction={{ label: "Export", icon: Download, onClick: () => setExportDialogOpen(true), variant: "export" }}
    />
  )

  return (
    <PageShell toolbar={toolbar}>
    <div className="flex flex-1 gap-4 p-4 overflow-hidden">
      {/* LEFT SIDEBAR - Sections */}
      <div className="w-64 flex-shrink-0">
        <Card className="h-full flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Menu Sections</h3>
              <Button size="sm" onClick={() => handleOpenSectionDialog()}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            {menuSections.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  No sections yet
                </p>
                <Button size="sm" onClick={() => handleOpenSectionDialog()}>
                  <Plus className="h-3 w-3 mr-2" />
                  Add Section
                </Button>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {menuSections
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((section) => {
                    const totals = calculateSectionTotals(section.id)
                    const isSelected = selectedSectionId === section.id
                    
                    return (
                      <div
                        key={section.id}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => setSelectedSectionId(section.id)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{section.name}</span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenSectionDialog(section)
                              }}
                              className={isSelected ? 'text-primary-foreground hover:bg-primary/80' : ''}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteSection(section)
                              }}
                              className={isSelected ? 'text-primary-foreground hover:bg-primary/80' : ''}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant={isSelected ? 'secondary' : 'outline'} className="text-xs">
                            {totals.items_count || 0} items
                          </Badge>
                          {totals.section_gp_percent !== undefined && (
                            <span className={isSelected ? '' : 'text-muted-foreground'}>
                              GP {totals.section_gp_percent.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </ScrollArea>
        </Card>
      </div>
      
      {/* MAIN PANEL - Items */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedSection ? (
          <Card className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <ChefHat className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Section Selected</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Select a section from the sidebar or create a new one
              </p>
              <Button onClick={() => handleOpenSectionDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Section
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Section Header */}
            <Card className="p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{selectedSection.name}</h2>
                    {selectedSection.is_drinks && <Badge>Drinks</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {sectionTotals?.items_count || 0} items
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setExportDialogOpen(true)}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button onClick={() => handleOpenItemDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </div>
              
              {/* Section KPIs */}
              {sectionTotals && sectionTotals.items_count! > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Revenue (ex GST)</p>
                      <p className="font-semibold">
                        ${((sectionTotals.section_revenue || 0) / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">COGS</p>
                      <p className="font-semibold">
                        ${((sectionTotals.section_cogs || 0) / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <TrendingUp className={`h-4 w-4 ${getGPColor(sectionTotals.section_gp_percent || 0)}`} />
                    <div>
                      <p className="text-xs text-muted-foreground">GP %</p>
                      <p className={`font-semibold text-lg ${getGPColor(sectionTotals.section_gp_percent || 0)}`}>
                        {sectionTotals.section_gp_percent?.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
            
            {/* GP Alerts Banner */}
            {belowGPItems.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 mb-4 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800">
                <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  {belowGPItems.length} item{belowGPItems.length !== 1 ? 's' : ''} below target GP ({gpThreshold}%) — review pricing
                </p>
                <button
                  className="ml-auto text-xs text-red-600 hover:text-red-800 underline"
                  onClick={() => {
                    // Scroll to first affected item — find its section and select it
                    const firstItem = belowGPItems[0]
                    if (firstItem) {
                      setSelectedSectionId(firstItem.section_id)
                    }
                  }}
                >
                  View items
                </button>
              </div>
            )}

            {/* Items Table */}
            <Card className="flex-1 overflow-auto">
              {filteredItems.length === 0 ? (
                <div className="p-12 text-center">
                  <ChefHat className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {sectionItems.length === 0 ? 'No items in this section yet' : 'No items found'}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    {sectionItems.length === 0
                      ? "Click 'Add Item' to add your first menu item"
                      : 'Try adjusting your search'}
                  </p>
                  {sectionItems.length === 0 && (
                    <Button onClick={() => handleOpenItemDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-sm">
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Name</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Recipe</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Tags</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Price Mode</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Price</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">GST</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">Cost/Serve</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">GP %</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">PLU</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => {
                      const isBelowGP = item.gp_percent !== undefined && item.gp_percent < gpThreshold
                      return (
                      <TableRow
                        key={item.id}
                        className={`${!item.show_on_menu ? 'opacity-50' : ''} ${isBelowGP ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}
                      >
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleItemVisibility(item)}
                          >
                            {item.show_on_menu ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.recipe_name}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {item.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {item.tags.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{item.tags.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.price_mode === 'AUTO_FROM_RECIPE' ? 'default' : 'secondary'}>
                            {item.price_mode === 'AUTO_FROM_RECIPE' ? 'Auto' : 'Manual'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          ${((item.effective_price || 0) / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.gst_mode}</Badge>
                        </TableCell>
                        <TableCell>${(item.cost_per_serve / 100).toFixed(2)}</TableCell>
                        <TableCell>
                          <span
                            className={`font-semibold ${getGPColor(item.gp_percent || 0)}`}
                          >
                            {item.gp_percent?.toFixed(1)}%
                          </span>
                          {isBelowGP && (
                            <AlertTriangle className="h-3 w-3 inline ml-1 text-red-500" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.plu_code || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenItemDialog(item)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteItem(item)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      )
                    })}
                  </TableBody>
                  {sectionTotals && sectionTotals.items_count! > 0 && (
                    <TableFooter className="sticky bottom-0 bg-background">
                      <TableRow>
                        <TableCell colSpan={7} className="text-right font-semibold">
                          Section Totals:
                        </TableCell>
                        <TableCell className="font-bold">
                          ${((sectionTotals.section_cogs || 0) / 100).toFixed(2)}
                        </TableCell>
                        <TableCell className={`font-bold text-lg ${getGPColor(sectionTotals.section_gp_percent || 0)}`}>
                          {sectionTotals.section_gp_percent?.toFixed(1)}%
                        </TableCell>
                        <TableCell colSpan={2}></TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              )}
            </Card>
          </>
        )}
      </div>
      
      {/* RIGHT SIDEBAR - Analytics & Warnings */}
      <div className="w-80 flex-shrink-0 space-y-4">
        {/* Menu Totals */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <ChefHat className="h-4 w-4" />
            Menu Totals
          </h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Items:</span>
              <span className="font-semibold">{analytics.total_items}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Sections:</span>
              <span className="font-semibold">{analytics.total_sections}</span>
            </div>
            
            <Separator />
            
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Revenue (ex GST):</span>
              <span className="font-semibold">
                ${(analytics.menu_revenue / 100).toFixed(2)}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">COGS:</span>
              <span className="font-semibold">
                ${(analytics.menu_cogs / 100).toFixed(2)}
              </span>
            </div>
            
            {belowGPItems.length > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-red-600 font-medium">Below Target GP:</span>
                <span className="font-semibold text-red-600">{belowGPItems.length}</span>
              </div>
            )}

            <Separator />

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Menu GP %:</span>
              <span className={`text-2xl font-bold ${getGPColor(analytics.menu_gp_percent)}`}>
                {analytics.menu_gp_percent.toFixed(1)}%
              </span>
            </div>
          </div>
        </Card>
        
        {/* Warnings */}
        {analytics.warnings.length > 0 && (
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              Warnings ({analytics.warnings.length})
            </h3>
            
            <ScrollArea className="max-h-96">
              <div className="space-y-2">
                {analytics.warnings.map((warning, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg ${
                      warning.severity === 'error' ? 'bg-red-50' : 'bg-orange-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                          warning.severity === 'error' ? 'text-red-600' : 'text-orange-600'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{warning.item_name}</p>
                        <p className="text-xs text-muted-foreground">{warning.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        )}
      </div>
      
      {/* Section Dialog */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSection ? 'Edit Section' : 'Add Section'}
            </DialogTitle>
            <DialogDescription>
              {editingSection ? 'Update the menu section details' : 'Create a new section to organize your menu items'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="section_name">Section Name *</Label>
              <Input
                id="section_name"
                value={sectionForm.name}
                onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                placeholder="e.g., Entrees, Mains, Drinks"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_drinks"
                checked={sectionForm.is_drinks}
                onCheckedChange={(checked) =>
                  setSectionForm({ ...sectionForm, is_drinks: checked as boolean })
                }
              />
              <Label htmlFor="is_drinks">This is a drinks section</Label>
            </div>
            
            <div>
              <Label htmlFor="tax_mode">Tax Mode</Label>
              <Select
                value={sectionForm.tax_mode}
                onValueChange={(value: MenuSection['tax_mode']) => setSectionForm({ ...sectionForm, tax_mode: value })}
              >
                <SelectTrigger id="tax_mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FOLLOW_ITEM">Follow Item Settings</SelectItem>
                  <SelectItem value="GST_INC">All GST Inclusive</SelectItem>
                  <SelectItem value="GST_EX">All GST Exclusive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSection}>
              {editingSection ? 'Update' : 'Add'} Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Menu Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? 'Update menu item details and pricing' : 'Create a new menu item with recipe and pricing'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="item_name">Item Name *</Label>
                <Input
                  id="item_name"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="e.g., Margherita Pizza"
                />
              </div>
              
              <div>
                <Label htmlFor="recipe">Recipe *</Label>
                <Select value={itemForm.recipe_id} onValueChange={handleRecipeChange}>
                  <SelectTrigger id="recipe">
                    <SelectValue placeholder="Select recipe..." />
                  </SelectTrigger>
                  <SelectContent>
                    {publishedRecipes.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No published recipes available
                      </div>
                    ) : (
                      publishedRecipes.map((recipe) => (
                        <SelectItem key={recipe.id} value={recipe.id}>
                          {recipe.name} (${(recipe.suggested_price / 100).toFixed(2)})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="price_mode">Price Mode</Label>
                <Select
                  value={itemForm.price_mode}
                  onValueChange={(value: MenuItem['price_mode']) => setItemForm({ ...itemForm, price_mode: value })}
                >
                  <SelectTrigger id="price_mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO_FROM_RECIPE">Auto from Recipe</SelectItem>
                    <SelectItem value="MANUAL">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="price">
                  Price ($) {itemForm.price_mode === 'MANUAL' && '*'}
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={itemForm.price}
                  onChange={(e) => setItemForm({ ...itemForm, price: parseFloat(e.target.value) || 0 })}
                  disabled={itemForm.price_mode === 'AUTO_FROM_RECIPE'}
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <Label htmlFor="gst_mode">GST Mode</Label>
                <Select
                  value={itemForm.gst_mode}
                  onValueChange={(value: MenuItem['gst_mode']) => setItemForm({ ...itemForm, gst_mode: value })}
                >
                  <SelectTrigger id="gst_mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INC">Inclusive</SelectItem>
                    <SelectItem value="EX">Exclusive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="plu">PLU Code</Label>
              <Input
                id="plu"
                value={itemForm.plu_code}
                onChange={(e) => setItemForm({ ...itemForm, plu_code: e.target.value })}
                placeholder="POS product lookup code"
              />
            </div>
            
            {selectedSection?.is_drinks && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="abv">ABV %</Label>
                  <Input
                    id="abv"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={itemForm.abv_percent}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, abv_percent: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                
                <div>
                  <Label htmlFor="volume">Volume (ml)</Label>
                  <Input
                    id="volume"
                    type="number"
                    min="0"
                    value={itemForm.volume_ml}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, volume_ml: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
            )}
            
            <div>
              <Label className="mb-2 block">Tags</Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_MENU_TAGS.map((tag) => (
                  <Badge
                    key={tag}
                    variant={itemForm.tags.includes(tag) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show_on_menu"
                checked={itemForm.show_on_menu}
                onCheckedChange={(checked) =>
                  setItemForm({ ...itemForm, show_on_menu: checked as boolean })
                }
              />
              <Label htmlFor="show_on_menu">Show on menu</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveItem}>
              {editingItem ? 'Update' : 'Add'} Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Menu for POS</DialogTitle>
            <DialogDescription>
              Export your menu data in CSV or JSON format for POS integration
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose a format to export your menu data for POS integration.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" onClick={() => handleExport('csv')}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              
              <Button variant="outline" onClick={() => handleExport('json')}>
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </Button>
            </div>
            
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-xs font-medium mb-2">Export includes:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Section name</li>
                <li>• Item name</li>
                <li>• PLU code</li>
                <li>• Price (inc & ex GST)</li>
                <li>• GST rate and mode</li>
                <li>• Recipe ID</li>
                <li>• Tags and allergens</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PageShell>
  )
}
