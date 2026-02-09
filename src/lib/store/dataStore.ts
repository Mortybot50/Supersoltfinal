import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import * as Types from '@/types'
import { Organization, Venue, Staff, Order, Ingredient, Supplier, OnboardingInvite, OnboardingStep, OnboardingDocument, StockCountItem, PurchaseOrderItem } from '@/types'

// Type for parsed orders from import
interface ParsedOrder {
  order_number: string
  order_datetime: Date | string
  channel: 'dine-in' | 'takeaway' | 'delivery' | 'online'
  payment_method?: string
  gross_inc_tax: number
  discounts: number
  tax_amount: number
  service_charge: number
  tip_amount: number
  is_void: boolean
  is_refund: boolean
  refund_reason?: string
  staff_member?: string
  customer_name?: string
}

// Type for database order row
interface OrderRow {
  id: string
  order_number: string
  venue_id: string
  order_datetime: string
  channel: string
  payment_method: string
  gross_amount: number
  tax_amount: number
  discount_amount: number
  service_charge: number
  tip_amount: number
  net_amount: number
  is_void: boolean
  is_refund: boolean
  refund_reason?: string
  staff_member?: string
  customer_name?: string
}

// Type for database ingredient row
interface IngredientRow extends Omit<Types.Ingredient, 'last_cost_update'> {
  last_cost_update: string
}

// Type for database supplier row
type SupplierRow = Types.Supplier

// Type for database stock count row
interface StockCountRow extends Omit<Types.StockCount, 'count_date' | 'items'> {
  count_date: string
}

// Type for database waste log row
interface WasteLogRow extends Omit<Types.WasteEntry, 'waste_date'> {
  waste_date: string
}

// Type for database menu item row
interface MenuItemRow extends Omit<Types.MenuItem, 'launch_date' | 'created_at' | 'updated_at'> {
  launch_date?: string
  created_at: string
  updated_at: string
}

// Type for database purchase order row
interface PurchaseOrderRow extends Omit<Types.PurchaseOrder, 'order_date' | 'expected_delivery_date' | 'submitted_at' | 'confirmed_at' | 'delivered_at' | 'cancelled_at' | 'created_at' | 'updated_at' | 'items'> {
  order_date: string
  expected_delivery_date: string
  submitted_at?: string
  confirmed_at?: string
  delivered_at?: string
  cancelled_at?: string
  created_at?: string
  updated_at?: string
}

// Version control for data migrations
const STORE_VERSION = 2

interface DataState {
  // Loading states
  isLoading: boolean
  error: string | null
  
  // Data protection metadata
  _version: number
  _lastImportDate: Date | null
  hasImportedData: boolean
  
  // Organization & Venues
  organization: Types.Organization | null
  venues: Types.Venue[]
  currentVenueId: string | null
  
  // Organization Settings
  branding: Types.OrgBranding | null
  menuDefaults: Types.OrgMenuDefaults | null
  approvals: Types.OrgApprovals | null
  holidays: Types.OrgHolidays | null
  exportMappings: Types.OrgExportMappings | null
  security: Types.OrgSecurity | null
  auditLogs: Types.OrgAuditLog[]
  
  // Workforce
  staff: Types.Staff[]
  rosterShifts: Types.RosterShift[]
  timesheets: Types.Timesheet[]
  
  // Onboarding
  onboardingInvites: Types.OnboardingInvite[]
  onboardingSteps: Types.OnboardingStep[]
  onboardingDocuments: Types.OnboardingDocument[]
  
  // Sales
  orders: Types.Order[]
  orderItems: Types.OrderItem[]
  tenders: Types.Tender[]
  
  // Inventory
  ingredients: Types.Ingredient[]
  suppliers: Types.Supplier[]
  purchaseOrders: Types.PurchaseOrder[]
  purchaseOrderItems: Types.PurchaseOrderItem[]
  stockCounts: Types.StockCount[]
  stockCountItems: Types.StockCountItem[]
  wasteLogs: Types.WasteLog[]
  
  // Menu & Recipes
  menuItems: Types.MenuItem[]
  menuSections: Types.MenuSection[]
  recipes: Types.Recipe[]
  recipeIngredients: Types.RecipeIngredient[]
  
  // Financials
  bankAccounts: Types.BankAccount[]
  obligations: Types.CashFlowObligation[]
  budgetLines: Types.BudgetLine[]
  
  // Operations
  daybookEntries: Types.DaybookEntry[]
  complianceChecks: Types.ComplianceCheck[]
  automationRules: Types.AutomationRule[]
  
  // Forecasts & Targets
  forecasts: Types.Forecast[]
  targets: Types.Target[]
  
  // Actions
  setOrganization: (org: Types.Organization) => void
  setVenues: (venues: Types.Venue[]) => void
  setCurrentVenue: (venueId: string) => void
  
  // Organization Settings Actions
  updateOrganization: (updates: Partial<Types.Organization>) => void
  updateBranding: (updates: Partial<Types.OrgBranding>) => void
  updateMenuDefaults: (updates: Partial<Types.OrgMenuDefaults>) => void
  updateApprovals: (updates: Partial<Types.OrgApprovals>) => void
  updateHolidays: (updates: Partial<Types.OrgHolidays>) => void
  updateExportMappings: (updates: Partial<Types.OrgExportMappings>) => void
  updateSecurity: (updates: Partial<Types.OrgSecurity>) => void
  addAuditLog: (log: Omit<Types.OrgAuditLog, 'id' | 'created_at'>) => void
  initializeOrgDefaults: () => void
  publishToVenues: () => void
  setStaff: (staff: Types.Staff[]) => void
  addStaff: (staff: Types.Staff) => void
  updateStaff: (id: string, updates: Partial<Types.Staff>) => void
  deleteStaff: (id: string) => void
  setRosterShifts: (shifts: Types.RosterShift[]) => void
  addRosterShift: (shift: Types.RosterShift) => void
  updateRosterShift: (id: string, updates: Partial<Types.RosterShift>) => void
  deleteRosterShift: (id: string) => void
  copyPreviousWeekRoster: (targetWeekStart: Date) => void
  setTimesheets: (timesheets: Types.Timesheet[]) => void
  addTimesheet: (timesheet: Types.Timesheet) => void
  updateTimesheet: (id: string, updates: Partial<Types.Timesheet>) => void
  approveTimesheet: (id: string) => void
  rejectTimesheet: (id: string) => void
  setOrders: (orders: Types.Order[]) => void
  loadOrdersFromDB: () => Promise<void>
  setOrderItems: (items: Types.OrderItem[]) => void
  setTenders: (tenders: Types.Tender[]) => void
  setIngredients: (ingredients: Types.Ingredient[]) => void
  addIngredient: (ingredient: Types.Ingredient) => Promise<void>
  updateIngredient: (id: string, updates: Partial<Types.Ingredient>) => Promise<void>
  deleteIngredient: (id: string) => Promise<void>
  setSuppliers: (suppliers: Types.Supplier[]) => void
  addSupplier: (supplier: Types.Supplier) => Promise<void>
  updateSupplier: (id: string, updates: Partial<Types.Supplier>) => Promise<void>
  deleteSupplier: (id: string) => Promise<void>
  loadSuppliersFromDB: () => Promise<void>
  loadIngredientsFromDB: () => Promise<void>
  loadPurchaseOrdersFromDB: () => Promise<void>
  setPurchaseOrders: (pos: Types.PurchaseOrder[]) => Promise<void>
  addPurchaseOrder: (po: Types.PurchaseOrder, items: Types.PurchaseOrderItem[]) => Promise<void>
  updatePurchaseOrder: (id: string, updates: Partial<Types.PurchaseOrder>) => Promise<void>
  deletePurchaseOrder: (id: string) => Promise<void>
  setStockCounts: (counts: Types.StockCount[]) => void
  loadStockCountsFromDB: () => Promise<void>
  addStockCount: (count: Types.StockCount) => Promise<void>
  updateStockCount: (id: string, updates: Partial<Types.StockCount>) => Promise<void>
  completeStockCount: (id: string) => Promise<void>
  deleteStockCount: (id: string) => Promise<void>
  setWasteLogs: (logs: Types.WasteLog[]) => void
  loadWasteLogsFromDB: () => Promise<void>
  addWasteEntry: (waste: Types.WasteEntry) => Promise<void>
  updateWasteEntry: (id: string, updates: Partial<Types.WasteEntry>) => Promise<void>
  deleteWasteEntry: (id: string) => Promise<void>
  setMenuItems: (items: Types.MenuItem[]) => void
  loadMenuItemsFromDB: () => Promise<void>
  addMenuItem: (item: Types.MenuItem) => Promise<void>
  updateMenuItem: (id: string, updates: Partial<Types.MenuItem>) => Promise<void>
  deleteMenuItem: (id: string) => Promise<void>
  addMenuSection: (section: Types.MenuSection) => void
  updateMenuSection: (id: string, updates: Partial<Types.MenuSection>) => void
  deleteMenuSection: (id: string) => void
  reorderSections: (sections: Types.MenuSection[]) => void
  getSectionItems: (sectionId: string) => Types.MenuItem[]
  calculateMenuItemFields: (item: Types.MenuItem) => Types.MenuItem
  calculateSectionTotals: (sectionId: string) => Partial<Types.MenuSection>
  calculateMenuAnalytics: () => Types.MenuAnalytics
  setRecipes: (recipes: Types.Recipe[]) => void
  addRecipe: (recipe: Types.Recipe) => void
  updateRecipe: (id: string, updates: Partial<Types.Recipe>) => void
  deleteRecipe: (id: string) => void
  publishRecipe: (id: string) => void
  archiveRecipe: (id: string) => void
  addRecipeIngredient: (ingredient: Types.RecipeIngredient) => void
  updateRecipeIngredient: (id: string, updates: Partial<Types.RecipeIngredient>) => void
  deleteRecipeIngredient: (id: string) => void
  getRecipeIngredients: (recipeId: string) => Types.RecipeIngredient[]
  recalculateRecipeCosts: (recipeId: string) => void
  setForecasts: (forecasts: Types.Forecast[]) => void
  setTargets: (targets: Types.Target[]) => void
  
  importOrders: (orders: Types.Order[], orderItems: Types.OrderItem[], tenders: Types.Tender[]) => Promise<void>
  importParsedOrders: (parsedOrders: ParsedOrder[]) => Promise<void>
  importStaff: (data: Types.Staff[]) => Promise<void>
  importIngredients: (data: Types.Ingredient[]) => Promise<void>
  importSuppliers: (data: Types.Supplier[]) => Promise<void>
  importTimesheets: (data: Types.Timesheet[]) => Promise<void>
  
  // Onboarding actions
  setOnboardingInvites: (invites: Types.OnboardingInvite[]) => void
  addOnboardingInvite: (invite: Types.OnboardingInvite) => void
  setOnboardingSteps: (steps: Types.OnboardingStep[]) => void
  updateOnboardingStep: (stepId: string, updates: Partial<Types.OnboardingStep>) => void
  setOnboardingDocuments: (docs: Types.OnboardingDocument[]) => void
  addOnboardingDocument: (doc: Types.OnboardingDocument) => void
  updateOnboardingDocument: (docId: string, updates: Partial<Types.OnboardingDocument>) => void
  updateStaffOnboarding: (staffId: string, updates: Partial<Types.Staff>) => void
  
  // Clear all data
  clearAllData: () => void
  exportBackup: () => string
  importBackup: (data: string) => void

  // Initialize all data from database
  initializeData: () => Promise<void>

  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Advanced Rostering - Shift Templates
  shiftTemplates: Types.ShiftTemplate[]
  setShiftTemplates: (templates: Types.ShiftTemplate[]) => void
  addShiftTemplate: (template: Types.ShiftTemplate) => void
  updateShiftTemplate: (id: string, updates: Partial<Types.ShiftTemplate>) => void
  deleteShiftTemplate: (id: string) => void

  // Advanced Rostering - Staff Availability
  staffAvailability: Types.StaffAvailability[]
  setStaffAvailability: (availability: Types.StaffAvailability[]) => void
  addStaffAvailability: (availability: Types.StaffAvailability) => void
  updateStaffAvailability: (id: string, updates: Partial<Types.StaffAvailability>) => void
  deleteStaffAvailability: (id: string) => void
  getStaffAvailabilityForWeek: (staffId: string, weekStart: Date) => Types.StaffAvailability[]

  // Advanced Rostering - Shift Swap Requests
  shiftSwapRequests: Types.ShiftSwapRequest[]
  setShiftSwapRequests: (requests: Types.ShiftSwapRequest[]) => void
  createSwapRequest: (shiftId: string, targetStaffId?: string) => void
  approveSwapRequest: (requestId: string) => void
  rejectSwapRequest: (requestId: string, reason?: string) => void
  cancelSwapRequest: (requestId: string) => void

  // Advanced Rostering - Labor Budget
  laborBudgets: Types.LaborBudget[]
  setLaborBudgets: (budgets: Types.LaborBudget[]) => void
  addLaborBudget: (budget: Types.LaborBudget) => void
  updateLaborBudget: (id: string, updates: Partial<Types.LaborBudget>) => void
  deleteLaborBudget: (id: string) => void
  getLaborBudgetForWeek: (weekStart: Date) => Types.LaborBudget | null

  // Advanced Rostering - Open Shifts
  claimOpenShift: (shiftId: string, staffId: string, staffName: string) => void
  createOpenShift: (shift: Omit<Types.RosterShift, 'id' | 'staff_id' | 'staff_name'>) => void
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
  // Initial state - ALL EMPTY
  isLoading: false,
  error: null,
  _version: STORE_VERSION,
  _lastImportDate: null,
  hasImportedData: false,
  organization: null,
  venues: [],
  currentVenueId: null,
  branding: null,
  menuDefaults: null,
  approvals: null,
  holidays: null,
  exportMappings: null,
  security: null,
  auditLogs: [],
  staff: [],
  rosterShifts: [],
  timesheets: [],
  orders: [],
  orderItems: [],
  tenders: [],
  ingredients: [],
  suppliers: [],
  purchaseOrders: [],
  purchaseOrderItems: [],
  stockCounts: [],
  stockCountItems: [],
  wasteLogs: [],
  menuItems: [],
  menuSections: [],
  recipes: [],
  recipeIngredients: [],
  bankAccounts: [],
  obligations: [],
  budgetLines: [],
  daybookEntries: [],
  complianceChecks: [],
  // Advanced Rostering
  shiftTemplates: [],
  staffAvailability: [],
  shiftSwapRequests: [],
  laborBudgets: [],
  automationRules: [],
  forecasts: [],
  targets: [],
  onboardingInvites: [],
  onboardingSteps: [],
  onboardingDocuments: [],
  
  // Setters
  setOrganization: (org) => set({ organization: org }),
  setVenues: (venues) => set({ venues }),
  setCurrentVenue: (venueId) => set({ currentVenueId: venueId }),
  setStaff: (staff) => set({ staff }),
  addStaff: (staff) => set((state) => ({ staff: [...state.staff, staff] })),
  updateStaff: (id, updates) => set((state) => ({
    staff: state.staff.map((s) => s.id === id ? { ...s, ...updates } : s)
  })),
  deleteStaff: (id) => set((state) => ({
    staff: state.staff.filter((s) => s.id !== id),
    // Also remove related shifts
    rosterShifts: state.rosterShifts.filter((shift) => shift.staff_id !== id)
  })),

  setRosterShifts: (rosterShifts) => set({ rosterShifts }),
  addRosterShift: (shift) => set((state) => ({ rosterShifts: [...state.rosterShifts, shift] })),
  updateRosterShift: (id, updates) => set((state) => ({
    rosterShifts: state.rosterShifts.map((s) => s.id === id ? { ...s, ...updates } : s)
  })),
  deleteRosterShift: (id) => set((state) => ({
    rosterShifts: state.rosterShifts.filter((s) => s.id !== id)
  })),
  copyPreviousWeekRoster: (targetWeekStart) => {
    const state = get()
    const prevWeekStart = new Date(targetWeekStart)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)
    const prevWeekEnd = new Date(prevWeekStart)
    prevWeekEnd.setDate(prevWeekEnd.getDate() + 6)

    // Find shifts from previous week
    const prevWeekShifts = state.rosterShifts.filter((s) => {
      const shiftDate = new Date(s.date)
      return shiftDate >= prevWeekStart && shiftDate <= prevWeekEnd && s.status !== 'cancelled'
    })

    // Copy shifts to new week
    const newShifts: Types.RosterShift[] = prevWeekShifts.map((shift) => {
      const newDate = new Date(shift.date)
      newDate.setDate(newDate.getDate() + 7)
      return {
        ...shift,
        id: crypto.randomUUID(),
        date: newDate,
        status: 'scheduled' as const,
      }
    })

    set((state) => ({ rosterShifts: [...state.rosterShifts, ...newShifts] }))
  },

  setTimesheets: (timesheets) => set({ timesheets }),
  addTimesheet: (timesheet) => set((state) => ({ timesheets: [...state.timesheets, timesheet] })),
  updateTimesheet: (id, updates) => set((state) => ({
    timesheets: state.timesheets.map((t) => t.id === id ? { ...t, ...updates } : t)
  })),
  approveTimesheet: (id) => set((state) => ({
    timesheets: state.timesheets.map((t) => t.id === id ? { ...t, status: 'approved' as const } : t)
  })),
  rejectTimesheet: (id) => set((state) => ({
    timesheets: state.timesheets.map((t) => t.id === id ? { ...t, status: 'rejected' as const } : t)
  })),

  setOrders: (orders) => set({ orders }),
  loadOrdersFromDB: async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('order_datetime', { ascending: false })
      
      if (error) throw error
      
      if (data) {
        // CRITICAL: Keep dates as ISO strings, not Date objects
        const formattedOrders = data.map(order => ({
          ...order,
          order_datetime: order.order_datetime, // Keep as string
          channel: order.channel as 'dine-in' | 'takeaway' | 'delivery' | 'online',
          payment_method: order.payment_method as 'card' | 'cash' | 'digital_wallet'
        }))
        set({ orders: formattedOrders as Types.Order[] })
        console.log('✅ Loaded orders from DB, dates kept as ISO strings')
      }
    } catch (error) {
      console.error('Failed to load orders:', error)
    }
  },
  setOrderItems: (orderItems) => set({ orderItems }),
  setTenders: (tenders) => set({ tenders }),
  setIngredients: (ingredients) => set({ ingredients }),
  addIngredient: async (ingredient) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      // Convert Date to ISO string for Supabase
      const ingredientData: Omit<Types.Ingredient, 'last_cost_update'> & { last_cost_update: string } = {
        ...ingredient,
        last_cost_update: ingredient.last_cost_update instanceof Date
          ? ingredient.last_cost_update.toISOString()
          : String(ingredient.last_cost_update)
      }
      
      const { data, error } = await supabase
        .from('ingredients')
        .insert([ingredientData])
        .select()
        .single()
      
      if (error) throw error
      
      if (data) {
        set((state) => ({ ingredients: [...state.ingredients, data as Types.Ingredient] }))
      }
    } catch (error) {
      console.error('Failed to add ingredient:', error)
      throw error
    }
  },
  updateIngredient: async (id, updates) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      // Convert Date to ISO string for Supabase
      const updateData: Partial<Types.Ingredient> & { last_cost_update?: string } = { ...updates }
      if (updates.last_cost_update instanceof Date) {
        updateData.last_cost_update = updates.last_cost_update.toISOString()
      }
      
      const { data, error } = await supabase
        .from('ingredients')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      
      if (data) {
        set((state) => ({
          ingredients: state.ingredients.map((i) =>
            i.id === id ? data as Types.Ingredient : i
          ),
        }))
      }
    } catch (error) {
      console.error('Failed to update ingredient:', error)
      throw error
    }
  },
  deleteIngredient: async (id) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      const { error } = await supabase
        .from('ingredients')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      set((state) => ({
        ingredients: state.ingredients.filter((i) => i.id !== id),
      }))
    } catch (error) {
      console.error('Failed to delete ingredient:', error)
      throw error
    }
  },
  setSuppliers: (suppliers) => set({ suppliers }),
  addSupplier: async (supplier) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      const { data, error } = await supabase
        .from('suppliers')
        .insert([supplier])
        .select()
        .single()
      
      if (error) throw error
      
      if (data) {
        set((state) => ({ suppliers: [...state.suppliers, data as Types.Supplier] }))
      }
    } catch (error) {
      console.error('Failed to add supplier:', error)
      throw error
    }
  },
  updateSupplier: async (id, updates) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      const { data, error } = await supabase
        .from('suppliers')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      
      if (data) {
        set((state) => ({
          suppliers: state.suppliers.map((s) =>
            s.id === id ? data as Types.Supplier : s
          ),
        }))
      }
    } catch (error) {
      console.error('Failed to update supplier:', error)
      throw error
    }
  },
  deleteSupplier: async (id) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      set((state) => ({
        suppliers: state.suppliers.filter((s) => s.id !== id),
      }))
    } catch (error) {
      console.error('Failed to delete supplier:', error)
      throw error
    }
  },
  setPurchaseOrders: async (pos) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      // Add the new PO to Supabase
      const latestPO = pos[pos.length - 1]
      if (latestPO) {
        const poData: PurchaseOrderRow = {
          ...latestPO,
          order_date: latestPO.order_date instanceof Date
            ? latestPO.order_date.toISOString()
            : String(latestPO.order_date),
          expected_delivery_date: latestPO.expected_delivery_date instanceof Date
            ? latestPO.expected_delivery_date.toISOString()
            : String(latestPO.expected_delivery_date)
        }
        
        const { error } = await supabase
          .from('purchase_orders')
          .insert([poData])
        
        if (error) throw error
      }
      
      set({ purchaseOrders: pos })
    } catch (error) {
      console.error('Failed to save purchase order:', error)
      throw error
    }
  },
  setStockCounts: (stockCounts) => set({ stockCounts }),
  loadStockCountsFromDB: async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      const { data: countsData, error: countsError } = await supabase
        .from('stock_counts')
        .select('*')
        .order('count_date', { ascending: false })
      
      if (countsError) throw countsError
      
      if (countsData) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('stock_count_items')
          .select('*')
        
        if (itemsError) throw itemsError
        
        const itemsByCount = (itemsData || []).reduce((acc, item) => {
          if (!acc[item.stock_count_id]) acc[item.stock_count_id] = []
          acc[item.stock_count_id].push(item)
          return acc
        }, {} as Record<string, StockCountItem[]>)
        
        const countsWithItems = countsData.map(count => ({
          ...count,
          items: itemsByCount[count.id] || [],
          count_date: new Date(count.count_date),
        }))
        
        set({ stockCounts: countsWithItems as Types.StockCount[] })
      }
    } catch (error) {
      console.error('Failed to load stock counts:', error)
    }
  },
  addStockCount: async (count: Types.StockCount) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      const countData: StockCountRow = {
        id: count.id,
        venue_id: count.venue_id,
        count_number: count.count_number,
        count_date: count.count_date.toISOString(),
        counted_by_user_id: count.counted_by_user_id,
        counted_by_name: count.counted_by_name,
        status: count.status,
        total_variance_value: count.total_variance_value,
        notes: count.notes,
      }
      
      const { error: countError } = await supabase
        .from('stock_counts')
        .insert([countData])
      
      if (countError) throw countError
      
      if (count.items && count.items.length > 0) {
        const itemsData = count.items.map(item => ({
          id: item.id,
          stock_count_id: count.id,
          ingredient_id: item.ingredient_id,
          ingredient_name: item.ingredient_name,
          expected_quantity: item.expected_quantity,
          actual_quantity: item.actual_quantity,
          variance: item.variance,
          variance_value: item.variance_value,
        }))
        
        const { error: itemsError } = await supabase
          .from('stock_count_items')
          .insert(itemsData)
        
        if (itemsError) throw itemsError
      }
      
      set((state) => ({ stockCounts: [...state.stockCounts, count] }))
    } catch (error) {
      console.error('Failed to add stock count:', error)
      throw error
    }
  },
  updateStockCount: async (id: string, updates: Partial<Types.StockCount>) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      const updateData: Partial<StockCountRow> = { ...updates, count_date: undefined }
      if (updates.count_date instanceof Date) {
        updateData.count_date = updates.count_date.toISOString()
      } else if (updates.count_date) {
        updateData.count_date = String(updates.count_date)
      }
      
      const { error } = await supabase
        .from('stock_counts')
        .update(updateData)
        .eq('id', id)
      
      if (error) throw error
      
      set((state) => ({
        stockCounts: state.stockCounts.map((sc) =>
          sc.id === id ? { ...sc, ...updates } : sc
        ),
      }))
    } catch (error) {
      console.error('Failed to update stock count:', error)
      throw error
    }
  },
  completeStockCount: async (id: string) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      const state = get()
      const count = state.stockCounts.find((sc) => sc.id === id)
      if (!count) return
      
      // Update stock count status
      await supabase
        .from('stock_counts')
        .update({ status: 'completed' })
        .eq('id', id)
      
      // Update ingredient stock levels based on counted quantities
      if (count.items) {
        for (const item of count.items) {
          await supabase
            .from('ingredients')
            .update({ current_stock: item.actual_quantity })
            .eq('id', item.ingredient_id)
        }
      }
      
      // Update local state
      set((state) => {
        const updatedIngredients = state.ingredients.map((ingredient) => {
          const countItem = count.items?.find((item: StockCountItem) => item.ingredient_id === ingredient.id)
          if (countItem) {
            return {
              ...ingredient,
              current_stock: countItem.actual_quantity,
            }
          }
          return ingredient
        })
        
        const updatedCounts = state.stockCounts.map((sc) =>
          sc.id === id ? { ...sc, status: 'completed' as const } : sc
        )
        
        return {
          ingredients: updatedIngredients,
          stockCounts: updatedCounts,
        }
      })
    } catch (error) {
      console.error('Failed to complete stock count:', error)
      throw error
    }
  },
  deleteStockCount: async (id: string) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      const { error } = await supabase
        .from('stock_counts')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      set((state) => ({
        stockCounts: state.stockCounts.filter((sc) => sc.id !== id),
      }))
    } catch (error) {
      console.error('Failed to delete stock count:', error)
      throw error
    }
  },
  setWasteLogs: (wasteLogs) => set({ wasteLogs }),
  loadWasteLogsFromDB: async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      const { data, error } = await supabase
        .from('waste_logs')
        .select('*')
        .order('waste_date', { ascending: false })
      
      if (error) throw error
      
      if (data) {
        const formattedWaste = data.map(waste => ({
          ...waste,
          waste_date: new Date(waste.waste_date),
        }))
        set({ wasteLogs: formattedWaste as Types.WasteEntry[] })
      }
    } catch (error) {
      console.error('Failed to load waste logs:', error)
    }
  },
  addWasteEntry: async (waste: Types.WasteEntry) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      const wasteData: WasteLogRow = {
        id: waste.id,
        venue_id: waste.venue_id,
        waste_date: waste.waste_date.toISOString(),
        waste_time: waste.waste_time,
        ingredient_id: waste.ingredient_id,
        ingredient_name: waste.ingredient_name,
        quantity: waste.quantity,
        unit: waste.unit,
        value: waste.value,
        reason: waste.reason,
        notes: waste.notes,
        recorded_by_user_id: waste.recorded_by_user_id,
        recorded_by_name: waste.recorded_by_name,
      }
      
      const { error } = await supabase
        .from('waste_logs')
        .insert([wasteData])
      
      if (error) throw error
      
      // Deduct from ingredient stock
      const ingredient = get().ingredients.find(i => i.id === waste.ingredient_id)
      if (ingredient) {
        await supabase
          .from('ingredients')
          .update({ current_stock: Math.max(0, ingredient.current_stock - waste.quantity) })
          .eq('id', waste.ingredient_id)
      }
      
      set((state) => {
        const updatedIngredients = state.ingredients.map((i) =>
          i.id === waste.ingredient_id
            ? {
                ...i,
                current_stock: Math.max(0, i.current_stock - waste.quantity),
              }
            : i
        )
        
        return {
          wasteLogs: [...state.wasteLogs, waste],
          ingredients: updatedIngredients,
        }
      })
    } catch (error) {
      console.error('Failed to add waste entry:', error)
      throw error
    }
  },
  updateWasteEntry: async (id: string, updates: Partial<Types.WasteEntry>) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      const updateData: Partial<WasteLogRow> = { ...updates, waste_date: undefined }
      if (updates.waste_date instanceof Date) {
        updateData.waste_date = updates.waste_date.toISOString()
      } else if (updates.waste_date) {
        updateData.waste_date = String(updates.waste_date)
      }
      
      const { error } = await supabase
        .from('waste_logs')
        .update(updateData)
        .eq('id', id)
      
      if (error) throw error
      
      set((state) => ({
        wasteLogs: state.wasteLogs.map((we) =>
          we.id === id ? { ...we, ...updates } : we
        ),
      }))
    } catch (error) {
      console.error('Failed to update waste entry:', error)
      throw error
    }
  },
  deleteWasteEntry: async (id: string) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      const { error } = await supabase
        .from('waste_logs')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      set((state) => ({
        wasteLogs: state.wasteLogs.filter((we) => we.id !== id),
      }))
    } catch (error) {
      console.error('Failed to delete waste entry:', error)
      throw error
    }
  },
  setMenuItems: (menuItems) => set({ menuItems }),
  loadMenuItemsFromDB: async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('name')
      
      if (error) throw error
      
      if (data) {
        const formattedItems = data.map(item => ({
          ...item,
          launch_date: item.launch_date ? new Date(item.launch_date) : undefined,
          created_at: new Date(item.created_at),
          updated_at: new Date(item.updated_at),
        }))
        set({ menuItems: formattedItems as Types.MenuItem[] })
      }
    } catch (error) {
      console.error('Failed to load menu items:', error)
    }
  },
  addMenuItem: async (item: Types.MenuItem) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      const itemData: Partial<MenuItemRow> = {
        id: item.id,
        venue_id: item.venue_id || 'VENUE-001',
        name: item.name,
        description: item.description,
        category: item.category,
        menu_group: item.menu_group,
        selling_price: item.selling_price,
        cost_price: item.cost_price || 0,
        margin_percent: item.margin_percent || 0,
        active: item.active,
        launch_date: item.launch_date ? item.launch_date.toISOString() : undefined,
      }
      
      const { error } = await supabase
        .from('menu_items')
        .insert([itemData])
      
      if (error) throw error
      
      set((state) => ({ menuItems: [...state.menuItems, item] }))
    } catch (error) {
      console.error('Failed to add menu item:', error)
      throw error
    }
  },
  updateMenuItem: async (id: string, updates: Partial<Types.MenuItem>) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      const updateData: Partial<MenuItemRow> = { ...updates, launch_date: undefined, created_at: undefined, updated_at: undefined }
      if (updates.launch_date instanceof Date) {
        updateData.launch_date = updates.launch_date.toISOString()
      }
      
      const { error } = await supabase
        .from('menu_items')
        .update(updateData)
        .eq('id', id)
      
      if (error) throw error
      
      set((state) => ({
        menuItems: state.menuItems.map((mi) =>
          mi.id === id ? { ...mi, ...updates } : mi
        ),
      }))
    } catch (error) {
      console.error('Failed to update menu item:', error)
      throw error
    }
  },
  deleteMenuItem: async (id: string) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      set((state) => ({
        menuItems: state.menuItems.filter((mi) => mi.id !== id),
      }))
    } catch (error) {
      console.error('Failed to delete menu item:', error)
      throw error
    }
  },
  
  // Menu Sections
  addMenuSection: (section) => {
    set((state) => ({ menuSections: [...state.menuSections, section] }))
  },
  updateMenuSection: (id, updates) => {
    set((state) => ({
      menuSections: state.menuSections.map((s) =>
        s.id === id ? { ...s, ...updates, updated_at: new Date() } : s
      ),
    }))
  },
  deleteMenuSection: (id) => {
    set((state) => ({
      menuSections: state.menuSections.filter((s) => s.id !== id),
      menuItems: state.menuItems.filter((i) => i.section_id !== id),
    }))
  },
  reorderSections: (sections) => {
    set({ menuSections: sections.map((s, i) => ({ ...s, display_order: i })) })
  },
  getSectionItems: (sectionId) => {
    return get()
      .menuItems.filter((i) => i.section_id === sectionId)
      .sort((a, b) => a.display_order - b.display_order)
  },
  
  // Menu Calculations
  calculateMenuItemFields: (item) => {
    const { recipes } = get()
    const recipe = recipes.find((r) => r.id === item.recipe_id)
    
    if (!recipe) return item
    
    // 1. Effective Price
    const effectivePrice =
      item.price_mode === 'AUTO_FROM_RECIPE' ? recipe.suggested_price : item.price
    
    // 2. GST Calculations
    let gstAmount = 0
    let priceExGst = 0
    
    if (item.gst_mode === 'INC') {
      // Price includes GST: GST = price × (10 / 110)
      gstAmount = Math.round(
        (effectivePrice * item.gst_rate_percent) / (100 + item.gst_rate_percent)
      )
      priceExGst = effectivePrice - gstAmount
    } else {
      // Price excludes GST: GST = price × (10 / 100)
      gstAmount = Math.round((effectivePrice * item.gst_rate_percent) / 100)
      priceExGst = effectivePrice
    }
    
    // 3. GP Calculation: GP% = (Price Ex-GST - Cost) / Price Ex-GST × 100
    let gpPercent = 0
    if (priceExGst > 0) {
      gpPercent = ((priceExGst - item.cost_per_serve) / priceExGst) * 100
    }
    
    // 4. Standard Drinks (for alcohol)
    let stdDrinks = 0
    if (item.abv_percent && item.volume_ml) {
      // std_drinks = (volume_ml × (ABV% / 100) × 0.789) / 10
      stdDrinks = (item.volume_ml * (item.abv_percent / 100) * 0.789) / 10
    }
    
    return {
      ...item,
      recipe_name: recipe.name,
      cost_per_serve: recipe.cost_per_serve,
      gp_target_percent: item.gp_target_percent || recipe.gp_target_percent,
      effective_price: effectivePrice,
      price_ex_gst: priceExGst,
      gst_amount: gstAmount,
      gp_percent: Math.round(gpPercent * 100) / 100,
      std_drinks: stdDrinks > 0 ? Math.round(stdDrinks * 10) / 10 : undefined,
    }
  },
  
  calculateSectionTotals: (sectionId) => {
    const items = get()
      .menuItems.filter((i) => i.section_id === sectionId && i.show_on_menu)
      .map((i) => get().calculateMenuItemFields(i))
    
    const revenue = items.reduce((sum, i) => sum + (i.price_ex_gst || 0), 0)
    const cogs = items.reduce((sum, i) => sum + i.cost_per_serve, 0)
    const gpPercent = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0
    
    return {
      items_count: items.length,
      section_revenue: revenue,
      section_cogs: cogs,
      section_gp_percent: Math.round(gpPercent * 100) / 100,
    }
  },
  
  calculateMenuAnalytics: () => {
    const { menuSections, menuItems, recipes } = get()
    
    const activeItems = menuItems
      .filter((i) => i.show_on_menu)
      .map((i) => get().calculateMenuItemFields(i))
    
    const menuRevenue = activeItems.reduce((sum, i) => sum + (i.price_ex_gst || 0), 0)
    const menuCogs = activeItems.reduce((sum, i) => sum + i.cost_per_serve, 0)
    const menuGpPercent = menuRevenue > 0 ? ((menuRevenue - menuCogs) / menuRevenue) * 100 : 0
    
    // Generate warnings
    const warnings: Types.MenuWarning[] = []
    
    activeItems.forEach((item) => {
      // Low GP warning
      if (item.gp_percent !== undefined && item.gp_percent < item.gp_target_percent - 5) {
        warnings.push({
          type: 'low_gp',
          severity: 'warning',
          item_id: item.id,
          item_name: item.name,
          message: `GP ${item.gp_percent.toFixed(1)}% below target ${item.gp_target_percent}%`,
        })
      }
      
      // Price below cost error
      if (item.price_ex_gst !== undefined && item.price_ex_gst < item.cost_per_serve) {
        warnings.push({
          type: 'price_below_cost',
          severity: 'error',
          item_id: item.id,
          item_name: item.name,
          message: 'Price below cost',
        })
      }
      
      // Missing PLU warning
      if (!item.plu_code) {
        warnings.push({
          type: 'missing_plu',
          severity: 'warning',
          item_id: item.id,
          item_name: item.name,
          message: 'Missing PLU code',
        })
      }
      
      // Unpublished recipe
      const recipe = recipes.find((r) => r.id === item.recipe_id)
      if (recipe && recipe.status !== 'published') {
        warnings.push({
          type: 'unpublished_recipe',
          severity: 'error',
          item_id: item.id,
          item_name: item.name,
          message: 'Linked recipe not published',
        })
      }
    })
    
    return {
      total_items: activeItems.length,
      total_sections: menuSections.length,
      menu_revenue: menuRevenue,
      menu_cogs: menuCogs,
      menu_gp_percent: Math.round(menuGpPercent * 100) / 100,
      warnings,
    }
  },
  
  setRecipes: (recipes) => set({ recipes }),
  addRecipe: (recipe) =>
    set((state) => ({ recipes: [...state.recipes, recipe] })),
  
  updateRecipe: (id, updates) =>
    set((state) => ({
      recipes: state.recipes.map((r) =>
        r.id === id ? { ...r, ...updates, updated_at: new Date() } : r
      ),
    })),
  
  deleteRecipe: (id) =>
    set((state) => ({
      recipes: state.recipes.filter((r) => r.id !== id),
      recipeIngredients: state.recipeIngredients.filter((ri) => ri.recipe_id !== id),
    })),
  
  publishRecipe: (id) =>
    set((state) => ({
      recipes: state.recipes.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'published' as const,
              published_at: new Date(),
              updated_at: new Date(),
            }
          : r
      ),
    })),
  
  archiveRecipe: (id) =>
    set((state) => ({
      recipes: state.recipes.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'archived' as const,
              archived_at: new Date(),
              updated_at: new Date(),
            }
          : r
      ),
    })),
  
  addRecipeIngredient: (ingredient) => {
    set((state) => ({
      recipeIngredients: [...state.recipeIngredients, ingredient],
    }))
    get().recalculateRecipeCosts(ingredient.recipe_id)
  },
  
  updateRecipeIngredient: (id, updates) => {
    const ingredient = get().recipeIngredients.find((ri) => ri.id === id)
    set((state) => ({
      recipeIngredients: state.recipeIngredients.map((ri) =>
        ri.id === id ? { ...ri, ...updates } : ri
      ),
    }))
    if (ingredient) {
      get().recalculateRecipeCosts(ingredient.recipe_id)
    }
  },
  
  deleteRecipeIngredient: (id) => {
    const ingredient = get().recipeIngredients.find((ri) => ri.id === id)
    set((state) => ({
      recipeIngredients: state.recipeIngredients.filter((ri) => ri.id !== id),
    }))
    if (ingredient) {
      get().recalculateRecipeCosts(ingredient.recipe_id)
    }
  },
  
  getRecipeIngredients: (recipeId) => {
    return get().recipeIngredients.filter((ri) => ri.recipe_id === recipeId)
  },
  
  recalculateRecipeCosts: (recipeId) => {
    const recipe = get().recipes.find((r) => r.id === recipeId)
    if (!recipe) return
    
    const ingredients = get().recipeIngredients.filter((ri) => ri.recipe_id === recipeId)
    
    // Calculate total cost
    const totalCost = ingredients.reduce((sum, ing) => sum + ing.line_cost, 0)
    
    // Calculate cost per serve
    const costPerServe = recipe.serves > 0 ? totalCost / recipe.serves : 0
    
    // Calculate suggested price based on GP target
    // Formula: suggested_price = cost_per_serve / (1 - (gp_target / 100))
    const gpMultiplier = 1 - recipe.gp_target_percent / 100
    const suggestedPrice = gpMultiplier > 0 ? Math.round(costPerServe / gpMultiplier) : 0
    
    set((state) => ({
      recipes: state.recipes.map((r) =>
        r.id === recipeId
          ? {
              ...r,
              total_cost: totalCost,
              cost_per_serve: Math.round(costPerServe),
              suggested_price: suggestedPrice,
              updated_at: new Date(),
            }
          : r
      ),
    }))
  },
  setForecasts: (forecasts) => set({ forecasts }),
  setTargets: (targets) => set({ targets }),
  
  // Load data from Supabase
  loadSuppliersFromDB: async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name')
      
      if (error) throw error
      
      if (data) {
        set({ suppliers: data as Types.Supplier[] })
      }
    } catch (error) {
      console.error('Failed to load suppliers:', error)
    }
  },
  
  loadIngredientsFromDB: async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .order('name')
      
      if (error) throw error
      
      if (data) {
        set({ ingredients: data as Types.Ingredient[] })
      }
    } catch (error) {
      console.error('Failed to load ingredients:', error)
    }
  },
  
  loadPurchaseOrdersFromDB: async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      // Load purchase orders with items
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('order_date', { ascending: false })
      
      if (poError) throw poError
      
      if (poData) {
        // Load items for each PO
        const { data: itemsData, error: itemsError } = await supabase
          .from('purchase_order_items')
          .select('*')
        
        if (itemsError) throw itemsError
        
        // Group items by PO
        const itemsByPO = (itemsData || []).reduce((acc, item) => {
          if (!acc[item.purchase_order_id]) acc[item.purchase_order_id] = []
          acc[item.purchase_order_id].push(item)
          return acc
        }, {} as Record<string, PurchaseOrderItem[]>)

        // Combine POs with their items
        const posWithItems = poData.map(po => ({
          ...po,
          items: itemsByPO[po.id] || [],
          order_date: new Date(po.order_date),
          expected_delivery_date: new Date(po.expected_delivery_date),
          submitted_at: po.submitted_at ? new Date(po.submitted_at) : undefined,
          confirmed_at: po.confirmed_at ? new Date(po.confirmed_at) : undefined,
          delivered_at: po.delivered_at ? new Date(po.delivered_at) : undefined,
          cancelled_at: po.cancelled_at ? new Date(po.cancelled_at) : undefined,
          created_at: po.created_at ? new Date(po.created_at) : undefined,
          updated_at: po.updated_at ? new Date(po.updated_at) : undefined,
        }))
        
        set({ purchaseOrders: posWithItems as Types.PurchaseOrder[] })
      }
    } catch (error) {
      console.error('Failed to load purchase orders:', error)
    }
  },
  
  addPurchaseOrder: async (po, items) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      // Insert PO
      const poData: PurchaseOrderRow & { total_amount: number } = {
        id: po.id,
        po_number: po.po_number,
        venue_id: po.venue_id,
        supplier_id: po.supplier_id,
        supplier_name: po.supplier_name,
        order_date: po.order_date.toISOString(),
        expected_delivery_date: po.expected_delivery_date.toISOString(),
        status: po.status,
        subtotal: po.subtotal,
        tax_amount: po.tax_amount,
        total_amount: po.total,
        total: po.total,
        notes: po.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      
      const { error: poError } = await supabase
        .from('purchase_orders')
        .insert([poData])
      
      if (poError) throw poError
      
      // Insert items
      if (items.length > 0) {
        const itemsData = items.map(item => ({
          id: item.id,
          purchase_order_id: po.id,
          ingredient_id: item.ingredient_id,
          ingredient_name: item.ingredient_name,
          quantity_ordered: item.quantity_ordered,
          unit: item.unit,
          unit_cost: item.unit_cost,
          line_total: item.line_total,
        }))
        
        const { error: itemsError } = await supabase
          .from('purchase_order_items')
          .insert(itemsData)
        
        if (itemsError) throw itemsError
      }
      
      // Add to store with items
      const poWithItems = { ...po, items }
      set((state) => ({ 
        purchaseOrders: [...state.purchaseOrders, poWithItems] 
      }))
    } catch (error) {
      console.error('Failed to add purchase order:', error)
      throw error
    }
  },
  
  updatePurchaseOrder: async (id, updates) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      // Prepare update data
      const updateData: Partial<PurchaseOrderRow> = { updated_at: new Date().toISOString() }

      // Convert dates
      if (updates.submitted_at instanceof Date) {
        updateData.submitted_at = updates.submitted_at.toISOString()
      }
      if (updates.confirmed_at instanceof Date) {
        updateData.confirmed_at = updates.confirmed_at.toISOString()
      }
      if (updates.delivered_at instanceof Date) {
        updateData.delivered_at = updates.delivered_at.toISOString()
      }
      if (updates.cancelled_at instanceof Date) {
        updateData.cancelled_at = updates.cancelled_at.toISOString()
      }
      if (updates.status) updateData.status = updates.status
      if (updates.notes !== undefined) updateData.notes = updates.notes
      
      // If updating items, handle separately
      if (updateData.items) {
        const items = updateData.items
        delete updateData.items
        
        // Update items in DB (simplified - in production would be more granular)
        await supabase
          .from('purchase_order_items')
          .delete()
          .eq('purchase_order_id', id)
        
        const itemsData = items.map((item: PurchaseOrderItem) => ({
          id: item.id,
          purchase_order_id: id,
          ingredient_id: item.ingredient_id,
          ingredient_name: item.ingredient_name,
          quantity_ordered: item.quantity_ordered,
          unit: item.unit,
          unit_cost: item.unit_cost,
          line_total: item.line_total,
        }))
        
        await supabase
          .from('purchase_order_items')
          .insert(itemsData)
      }
      
      // Update PO
      const { error } = await supabase
        .from('purchase_orders')
        .update(updateData)
        .eq('id', id)
      
      if (error) throw error
      
      // Update store
      set((state) => ({
        purchaseOrders: state.purchaseOrders.map((po) =>
          po.id === id ? { ...po, ...updates, updated_at: new Date() } : po
        ),
      }))
    } catch (error) {
      console.error('Failed to update purchase order:', error)
      throw error
    }
  },
  
  deletePurchaseOrder: async (id) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      // Delete items first
      await supabase
        .from('purchase_order_items')
        .delete()
        .eq('purchase_order_id', id)
      
      // Delete PO
      const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      set((state) => ({
        purchaseOrders: state.purchaseOrders.filter((po) => po.id !== id),
      }))
    } catch (error) {
      console.error('Failed to delete purchase order:', error)
      throw error
    }
  },
  
  // Import functions
  importOrders: async (orders, orderItems, tenders) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      // Save orders to database
      if (orders.length > 0) {
        const ordersData = orders.map(order => ({
          ...order,
          order_datetime: order.order_datetime instanceof Date 
            ? order.order_datetime.toISOString() 
            : order.order_datetime
        }))
        
        const { error } = await supabase
          .from('orders')
          .upsert(ordersData, { onConflict: 'id' })
        
        if (error) console.error('Failed to save orders:', error)
      }
      
      set({ orders, orderItems, tenders })
    } catch (error) {
      console.error('Failed to import orders:', error)
      set({ orders, orderItems, tenders })
    }
  },
  importParsedOrders: async (parsedOrders) => {
    console.log('🔄 Starting import of', parsedOrders.length, 'parsed orders')
    
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      // CRITICAL: Deduplicate input data first by order_number
      const seenOrderNumbers = new Set<string>()
      const deduplicatedInput = parsedOrders.filter((po) => {
        if (seenOrderNumbers.has(po.order_number)) {
          console.log('⚠️ Duplicate in import file skipped:', po.order_number)
          return false
        }
        seenOrderNumbers.add(po.order_number)
        return true
      })
      
      console.log(`📊 After input deduplication: ${deduplicatedInput.length} unique orders`)
      
      // Convert ParsedOrder to database Order type
      const newOrders = deduplicatedInput.map((po) => {
        // Parse date - handle both Date objects and ISO strings
        let orderDatetime: string
        if (po.order_datetime instanceof Date) {
          orderDatetime = po.order_datetime.toISOString()
        } else if (typeof po.order_datetime === 'string') {
          orderDatetime = po.order_datetime
        } else {
          orderDatetime = new Date().toISOString()
        }
        
        const grossCents = Math.round(po.gross_inc_tax * 100)
        const discountCents = Math.round(po.discounts * 100)
        const netCents = grossCents - discountCents
        
        return {
          order_number: po.order_number,
          venue_id: 'VENUE-001',
          order_datetime: orderDatetime,
          channel: po.channel,
          payment_method: (po.payment_method || 'card') as 'card' | 'cash' | 'digital_wallet',
          gross_amount: grossCents,
          tax_amount: Math.round(po.tax_amount * 100),
          discount_amount: discountCents,
          service_charge: Math.round(po.service_charge * 100),
          tip_amount: Math.round(po.tip_amount * 100),
          net_amount: netCents,
          is_void: po.is_void,
          is_refund: po.is_refund,
          refund_reason: po.refund_reason,
          staff_member: po.staff_member,
          customer_name: po.customer_name,
        }
      })
      
      console.log('✅ Transformed to database format:', newOrders.length, 'orders')
      
      // CRITICAL: Delete ALL existing orders in database to prevent duplicates on re-import
      console.log('🗑️ Clearing ALL existing orders in database...')
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all orders
      
      if (deleteError) {
        console.error('❌ Failed to clear existing orders:', deleteError)
        throw deleteError
      }
      
      // Insert all new orders
      console.log('💾 Inserting', newOrders.length, 'orders to database...')
      const { error: insertError } = await supabase
        .from('orders')
        .insert(newOrders)
      
      if (insertError) {
        console.error('❌ Failed to insert orders:', insertError)
        throw insertError
      }
      
      console.log('✅ Database import complete')
      
      // CRITICAL: REPLACE all orders in store (not append) to prevent duplicates
      set({
        orders: newOrders as Types.Order[],
        hasImportedData: true,
        _lastImportDate: new Date(),
      })
      
      localStorage.setItem('supersolt-has-data', 'true')
      
      console.log(`✅ Store now has ${newOrders.length} orders (replaced, not appended)`)
      
      import('sonner').then(({ toast }) => {
        toast.success(`Imported ${newOrders.length} orders`)
      })
    } catch (error) {
      console.error('Failed to import parsed orders:', error)
      throw error
    }
  },
  importStaff: async (staff) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      // Save staff to database (if you have a staff table)
      // For now, just set in state - you may need to create a staff table
      set({ staff })
      console.log('✅ Imported', staff.length, 'staff members')
    } catch (error) {
      console.error('Failed to import staff:', error)
      set({ staff })
    }
  },
  importIngredients: async (ingredients) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      // Save ingredients to database
      if (ingredients.length > 0) {
        const ingredientsData = ingredients.map(ing => ({
          ...ing,
          last_cost_update: ing.last_cost_update instanceof Date 
            ? ing.last_cost_update.toISOString() 
            : ing.last_cost_update || new Date().toISOString()
        }))
        
        const { error } = await supabase
          .from('ingredients')
          .upsert(ingredientsData, { onConflict: 'id' })
        
        if (error) {
          console.error('Failed to save ingredients:', error)
        } else {
          console.log('✅ Saved', ingredients.length, 'ingredients to database')
        }
      }
      
      set({ ingredients })
    } catch (error) {
      console.error('Failed to import ingredients:', error)
      set({ ingredients })
    }
  },
  importSuppliers: async (suppliers) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      // Save suppliers to database
      if (suppliers.length > 0) {
        const { error } = await supabase
          .from('suppliers')
          .upsert(suppliers, { onConflict: 'id' })
        
        if (error) {
          console.error('Failed to save suppliers:', error)
        } else {
          console.log('✅ Saved', suppliers.length, 'suppliers to database')
        }
      }
      
      set({ suppliers })
    } catch (error) {
      console.error('Failed to import suppliers:', error)
      set({ suppliers })
    }
  },
  importTimesheets: async (timesheets) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client')
      
      // Save timesheets to database (if you have a timesheets table)
      // For now, just set in state - you may need to create a timesheets table
      set({ timesheets })
      console.log('✅ Imported', timesheets.length, 'timesheets')
    } catch (error) {
      console.error('Failed to import timesheets:', error)
      set({ timesheets })
    }
  },
  
  // Onboarding actions
  setOnboardingInvites: (invites) => set({ onboardingInvites: invites }),
  addOnboardingInvite: (invite) => set(state => ({ 
    onboardingInvites: [...state.onboardingInvites, invite] 
  })),
  setOnboardingSteps: (steps) => set({ onboardingSteps: steps }),
  updateOnboardingStep: (stepId, updates) => set(state => ({
    onboardingSteps: state.onboardingSteps.map(step =>
      step.id === stepId ? { ...step, ...updates } : step
    )
  })),
  setOnboardingDocuments: (docs) => set({ onboardingDocuments: docs }),
  addOnboardingDocument: (doc) => set(state => ({
    onboardingDocuments: [...state.onboardingDocuments, doc]
  })),
  updateOnboardingDocument: (docId, updates) => set(state => ({
    onboardingDocuments: state.onboardingDocuments.map(doc =>
      doc.id === docId ? { ...doc, ...updates } : doc
    )
  })),
  updateStaffOnboarding: (staffId, updates) => set(state => ({
    staff: state.staff.map(s => s.id === staffId ? { ...s, ...updates } : s)
  })),
  
  // Initialize all data from database
  initializeData: async () => {
    console.log('🔄 Initializing data from database...')
    const store = get()
    
    try {
      // Load all data in parallel for faster initialization
      await Promise.all([
        store.loadOrdersFromDB(),
        store.loadSuppliersFromDB(),
        store.loadIngredientsFromDB(),
        store.loadPurchaseOrdersFromDB(),
        store.loadStockCountsFromDB(),
        store.loadWasteLogsFromDB(),
        store.loadMenuItemsFromDB(),
      ])
      
      console.log('✅ Data initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize data:', error)
    }
  },
  
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  
  // Organization Settings Actions
  updateOrganization: (updates) => {
    const before = get().organization
    set((state) => ({
      organization: state.organization
        ? { ...state.organization, ...updates, updated_at: new Date() }
        : null,
    }))
    
    get().addAuditLog({
      org_id: get().organization?.id || 'ORG-001',
      actor_user_id: 'current-user',
      actor_name: 'Admin User',
      action: 'organization.update',
      before_snapshot: before,
      after_snapshot: get().organization,
    })
  },
  
  updateBranding: (updates) => {
    const before = get().branding
    set((state) => ({
      branding: state.branding
        ? { ...state.branding, ...updates, updated_at: new Date() }
        : null,
    }))
    
    get().addAuditLog({
      org_id: get().organization?.id || 'ORG-001',
      actor_user_id: 'current-user',
      actor_name: 'Admin User',
      action: 'branding.update',
      before_snapshot: before,
      after_snapshot: get().branding,
    })
  },
  
  updateMenuDefaults: (updates) => {
    const before = get().menuDefaults
    set((state) => ({
      menuDefaults: state.menuDefaults
        ? { ...state.menuDefaults, ...updates, updated_at: new Date() }
        : null,
    }))
    
    get().addAuditLog({
      org_id: get().organization?.id || 'ORG-001',
      actor_user_id: 'current-user',
      actor_name: 'Admin User',
      action: 'menu_defaults.update',
      before_snapshot: before,
      after_snapshot: get().menuDefaults,
    })
  },
  
  updateApprovals: (updates) => {
    const before = get().approvals
    set((state) => ({
      approvals: state.approvals
        ? { ...state.approvals, ...updates, updated_at: new Date() }
        : null,
    }))
    
    get().addAuditLog({
      org_id: get().organization?.id || 'ORG-001',
      actor_user_id: 'current-user',
      actor_name: 'Admin User',
      action: 'approvals.update',
      before_snapshot: before,
      after_snapshot: get().approvals,
    })
  },
  
  updateHolidays: (updates) => {
    set((state) => ({
      holidays: state.holidays
        ? { ...state.holidays, ...updates, updated_at: new Date() }
        : null,
    }))
  },
  
  updateExportMappings: (updates) => {
    set((state) => ({
      exportMappings: state.exportMappings
        ? { ...state.exportMappings, ...updates, updated_at: new Date() }
        : null,
    }))
  },
  
  updateSecurity: (updates) => {
    set((state) => ({
      security: state.security
        ? { ...state.security, ...updates, updated_at: new Date() }
        : null,
    }))
  },
  
  addAuditLog: (log) => {
    const newLog: Types.OrgAuditLog = {
      ...log,
      id: crypto.randomUUID(),
      created_at: new Date(),
    }
    set((state) => ({ auditLogs: [newLog, ...state.auditLogs] }))
  },
  
  initializeOrgDefaults: () => {
    const orgId = get().organization?.id || 'ORG-001'
    const now = new Date()
    
    if (!get().organization) {
      set({
        organization: {
          id: orgId,
          name: 'Rowville Café',
          ...Types.DEFAULT_ORG_SETTINGS,
          created_at: now,
          updated_at: now,
        },
      })
    } else if (get().organization && !get().organization.gst_rate_percent) {
      // Update existing org with new fields
      set((state) => ({
        organization: state.organization
          ? { ...state.organization, ...Types.DEFAULT_ORG_SETTINGS, updated_at: now }
          : null,
      }))
    }
    
    if (!get().branding) {
      set({
        branding: {
          org_id: orgId,
          ...Types.DEFAULT_BRANDING,
          created_at: now,
          updated_at: now,
        },
      })
    }
    
    if (!get().menuDefaults) {
      set({
        menuDefaults: {
          org_id: orgId,
          menu_sections: Types.DEFAULT_MENU_SECTIONS,
          default_allergen_list: Types.FSANZ_ALLERGENS,
          price_endings: '.90',
          rounding_mode: 'NEAREST',
          default_gst_mode_items: 'INC',
          created_at: now,
          updated_at: now,
        },
      })
    }
    
    if (!get().approvals) {
      set({
        approvals: {
          org_id: orgId,
          price_change_max_percent_no_approval: 5,
          roster_over_budget_percent_requires_owner: 10,
          po_amount_over_requires_owner: 1000,
          below_gp_threshold_alert_percent: 60,
          enable_ai_suggestions: true,
          require_reason_on_override: true,
          created_at: now,
          updated_at: now,
        },
      })
    }
    
    if (!get().holidays) {
      set({
        holidays: {
          org_id: orgId,
          state: 'VIC',
          use_au_public_holidays: true,
          custom_closed_dates: [],
          created_at: now,
          updated_at: now,
        },
      })
    }
    
    if (!get().exportMappings) {
      set({
        exportMappings: {
          org_id: orgId,
          pos_provider: 'Square',
          default_tax_code: 'GST',
          csv_columns: Types.DEFAULT_CSV_COLUMNS,
          accounting_price_inc_gst: true,
          created_at: now,
          updated_at: now,
        },
      })
    }
    
    if (!get().security) {
      set({
        security: {
          org_id: orgId,
          pii_redaction_on_exports: true,
          document_retention_months: 36,
          allow_crew_view_costs: false,
          created_at: now,
          updated_at: now,
        },
      })
    }
  },
  
  publishToVenues: () => {
    import('sonner').then(({ toast }) => {
      toast.success('Settings published to all venues')
    })
    
    get().addAuditLog({
      org_id: get().organization?.id || 'ORG-001',
      actor_user_id: 'current-user',
      actor_name: 'Admin User',
      action: 'settings.publish_to_venues',
      before_snapshot: null,
      after_snapshot: { venue_count: get().venues.length },
    })
  },
  
  // PROTECTION: Only clear data when explicitly requested
  clearAllData: () => {
    const confirmed = confirm(
      '⚠️ WARNING: This will permanently delete ALL imported data including:\n\n' +
      '• Sales Orders\n' +
      '• Labour Records\n' +
      '• Ingredients\n' +
      '• Suppliers\n' +
      '• Purchase Orders\n' +
      '• Stock Counts\n' +
      '• Recipes\n' +
      '• Menu Items\n\n' +
      'This action CANNOT be undone.\n\n' +
      'Type "DELETE ALL DATA" in the next prompt to confirm.'
    )
    
    if (!confirmed) return
    
    const confirmation = prompt('Type "DELETE ALL DATA" to confirm:')
    
    if (confirmation === 'DELETE ALL DATA') {
      set({
        orders: [],
        orderItems: [],
        tenders: [],
        ingredients: [],
        suppliers: [],
        purchaseOrders: [],
        stockCounts: [],
        wasteLogs: [],
        recipes: [],
        menuItems: [],
        menuSections: [],
        hasImportedData: false,
        _lastImportDate: null,
      })
      
      localStorage.removeItem('supersolt-has-data')
      
      import('sonner').then(({ toast }) => {
        toast.success('All data cleared')
      })
    } else {
      import('sonner').then(({ toast }) => {
        toast.error('Data clear cancelled - confirmation text did not match')
      })
    }
  },
  
  // BACKUP: Export all data as JSON
  exportBackup: () => {
    const state = get()
    const backup = {
      version: STORE_VERSION,
      timestamp: new Date().toISOString(),
      data: {
        orders: state.orders,
        orderItems: state.orderItems,
        tenders: state.tenders,
        ingredients: state.ingredients,
        suppliers: state.suppliers,
        purchaseOrders: state.purchaseOrders,
        stockCounts: state.stockCounts,
        wasteLogs: state.wasteLogs,
        recipes: state.recipes,
        recipeIngredients: state.recipeIngredients,
        menuItems: state.menuItems,
        menuSections: state.menuSections,
        staff: state.staff,
        timesheets: state.timesheets,
      },
    }
    
    return JSON.stringify(backup, null, 2)
  },
  
  // RESTORE: Import backup JSON
  importBackup: (backupString: string) => {
    try {
      const backup = JSON.parse(backupString)
      
      if (!backup.version || !backup.data) {
        import('sonner').then(({ toast }) => {
          toast.error('Invalid backup file format')
        })
        return
      }
      
      set({
        ...backup.data,
        hasImportedData: true,
        _lastImportDate: new Date(),
      })
      
      localStorage.setItem('supersolt-has-data', 'true')
      
      import('sonner').then(({ toast }) => {
        toast.success('Backup restored successfully')
      })
    } catch (error) {
      import('sonner').then(({ toast }) => {
        toast.error('Failed to restore backup: Invalid JSON')
      })
    }
  },

  // ============================================
  // ADVANCED ROSTERING - SHIFT TEMPLATES
  // ============================================
  setShiftTemplates: (templates) => set({ shiftTemplates: templates }),

  addShiftTemplate: (template) => {
    set((state) => ({
      shiftTemplates: [...state.shiftTemplates, template],
    }))
  },

  updateShiftTemplate: (id, updates) => {
    set((state) => ({
      shiftTemplates: state.shiftTemplates.map((t) =>
        t.id === id ? { ...t, ...updates, updated_at: new Date() } : t
      ),
    }))
  },

  deleteShiftTemplate: (id) => {
    set((state) => ({
      shiftTemplates: state.shiftTemplates.filter((t) => t.id !== id),
    }))
  },

  // ============================================
  // ADVANCED ROSTERING - STAFF AVAILABILITY
  // ============================================
  setStaffAvailability: (availability) => set({ staffAvailability: availability }),

  addStaffAvailability: (availability) => {
    set((state) => ({
      staffAvailability: [...state.staffAvailability, availability],
    }))
  },

  updateStaffAvailability: (id, updates) => {
    set((state) => ({
      staffAvailability: state.staffAvailability.map((a) =>
        a.id === id ? { ...a, ...updates, updated_at: new Date() } : a
      ),
    }))
  },

  deleteStaffAvailability: (id) => {
    set((state) => ({
      staffAvailability: state.staffAvailability.filter((a) => a.id !== id),
    }))
  },

  getStaffAvailabilityForWeek: (staffId, weekStart) => {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    return get().staffAvailability.filter((a) => {
      if (a.staff_id !== staffId) return false

      if (a.is_recurring) {
        // Recurring availability applies to all weeks
        return true
      }

      if (a.specific_date) {
        const date = new Date(a.specific_date)
        return date >= weekStart && date <= weekEnd
      }

      return false
    })
  },

  // ============================================
  // ADVANCED ROSTERING - SHIFT SWAP REQUESTS
  // ============================================
  setShiftSwapRequests: (requests) => set({ shiftSwapRequests: requests }),

  createSwapRequest: (shiftId, targetStaffId) => {
    const shift = get().rosterShifts.find((s) => s.id === shiftId)
    if (!shift) return

    const targetStaff = targetStaffId
      ? get().staff.find((s) => s.id === targetStaffId)
      : null

    const request: Types.ShiftSwapRequest = {
      id: `swap-${Date.now()}`,
      venue_id: shift.venue_id,
      original_shift_id: shiftId,
      original_staff_id: shift.staff_id,
      original_staff_name: shift.staff_name,
      target_staff_id: targetStaffId,
      target_staff_name: targetStaff?.name,
      status: 'pending',
      requested_at: new Date(),
    }

    set((state) => ({
      shiftSwapRequests: [...state.shiftSwapRequests, request],
    }))
  },

  approveSwapRequest: (requestId) => {
    const request = get().shiftSwapRequests.find((r) => r.id === requestId)
    if (!request || !request.target_staff_id) return

    // Update the shift to the new staff member
    set((state) => ({
      shiftSwapRequests: state.shiftSwapRequests.map((r) =>
        r.id === requestId
          ? { ...r, status: 'approved' as const, responded_at: new Date() }
          : r
      ),
      rosterShifts: state.rosterShifts.map((s) =>
        s.id === request.original_shift_id
          ? {
              ...s,
              staff_id: request.target_staff_id!,
              staff_name: request.target_staff_name || s.staff_name,
            }
          : s
      ),
    }))
  },

  rejectSwapRequest: (requestId, reason) => {
    set((state) => ({
      shiftSwapRequests: state.shiftSwapRequests.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'rejected' as const,
              responded_at: new Date(),
              rejection_reason: reason,
            }
          : r
      ),
    }))
  },

  cancelSwapRequest: (requestId) => {
    set((state) => ({
      shiftSwapRequests: state.shiftSwapRequests.map((r) =>
        r.id === requestId
          ? { ...r, status: 'cancelled' as const }
          : r
      ),
    }))
  },

  // ============================================
  // ADVANCED ROSTERING - LABOR BUDGET
  // ============================================
  setLaborBudgets: (budgets) => set({ laborBudgets: budgets }),

  addLaborBudget: (budget) => {
    set((state) => ({
      laborBudgets: [...state.laborBudgets, budget],
    }))
  },

  updateLaborBudget: (id, updates) => {
    set((state) => ({
      laborBudgets: state.laborBudgets.map((b) =>
        b.id === id ? { ...b, ...updates, updated_at: new Date() } : b
      ),
    }))
  },

  deleteLaborBudget: (id) => {
    set((state) => ({
      laborBudgets: state.laborBudgets.filter((b) => b.id !== id),
    }))
  },

  getLaborBudgetForWeek: (weekStart) => {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    return (
      get().laborBudgets.find((b) => {
        const start = new Date(b.period_start)
        const end = new Date(b.period_end)
        return weekStart >= start && weekStart <= end
      }) || null
    )
  },

  // ============================================
  // ADVANCED ROSTERING - OPEN SHIFTS
  // ============================================
  claimOpenShift: (shiftId, staffId, staffName) => {
    const staffMember = get().staff.find((s) => s.id === staffId)
    if (!staffMember) return

    set((state) => ({
      rosterShifts: state.rosterShifts.map((s) =>
        s.id === shiftId && s.is_open_shift
          ? {
              ...s,
              staff_id: staffId,
              staff_name: staffName,
              is_open_shift: false,
              status: 'scheduled' as const,
            }
          : s
      ),
    }))
  },

  createOpenShift: (shiftData) => {
    const openShift: Types.RosterShift = {
      ...shiftData,
      id: `shift-open-${Date.now()}`,
      staff_id: '',
      staff_name: 'Open Shift',
      is_open_shift: true,
      status: 'scheduled',
    }

    set((state) => ({
      rosterShifts: [...state.rosterShifts, openShift],
    }))
  },
}),
{
  name: 'data-store',
  version: STORE_VERSION,
  
  // CRITICAL: Use localStorage instead of sessionStorage
  storage: createJSONStorage(() => localStorage),
  
  // IMPORTANT: Don't clear data on version mismatch, migrate it instead
  migrate: (persistedState: unknown, version: number) => {
    // If old version, preserve all data and just update version
    if (version < STORE_VERSION) {
      return {
        ...(persistedState as Partial<DataState>),
        _version: STORE_VERSION,
      }
    }
    return persistedState as Partial<DataState>
  },
  
  // Only persist these specific fields
  partialize: (state) => ({
    // Persist ALL data fields
    orders: state.orders,
    orderItems: state.orderItems,
    tenders: state.tenders,
    ingredients: state.ingredients,
    suppliers: state.suppliers,
    purchaseOrders: state.purchaseOrders,
    stockCounts: state.stockCounts,
    wasteLogs: state.wasteLogs,
    recipes: state.recipes,
    recipeIngredients: state.recipeIngredients,
    menuItems: state.menuItems,
    menuSections: state.menuSections,
    staff: state.staff,
    timesheets: state.timesheets,
    rosterShifts: state.rosterShifts,
    organization: state.organization,
    branding: state.branding,
    menuDefaults: state.menuDefaults,
    approvals: state.approvals,
    holidays: state.holidays,
    exportMappings: state.exportMappings,
    security: state.security,
    auditLogs: state.auditLogs,

    // Advanced Rostering
    shiftTemplates: state.shiftTemplates,
    staffAvailability: state.staffAvailability,
    shiftSwapRequests: state.shiftSwapRequests,
    laborBudgets: state.laborBudgets,

    // Persist metadata
    _version: state._version,
    _lastImportDate: state._lastImportDate,
    hasImportedData: state.hasImportedData,
  }),
}
)
)
