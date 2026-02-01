import { create } from 'zustand'
import type * as Types from '@/types'

interface DataStore {
  // Data
  orders: Types.Order[]
  orderItems: Types.OrderItem[]
  tenders: Types.Tender[]
  ingredients: Types.Ingredient[]
  stockCounts: Types.StockCount[]
  wasteEntries: Types.WasteEntry[]
  purchaseOrders: Types.PurchaseOrder[]
  suppliers: Types.Supplier[]
  menuItems: Types.MenuItem[]
  recipes: Types.Recipe[]
  staff: Types.Staff[]
  shifts: Types.Shift[]
  timesheets: Types.Timesheet[]
  forecasts: Types.Forecast[]
  targets: Types.Target[]
  
  // Loading states
  isLoading: boolean
  error: string | null
  
  // Actions
  setOrders: (orders: Types.Order[]) => void
  setOrderItems: (items: Types.OrderItem[]) => void
  setTenders: (tenders: Types.Tender[]) => void
  setIngredients: (ingredients: Types.Ingredient[]) => void
  setStockCounts: (counts: Types.StockCount[]) => void
  setWasteEntries: (entries: Types.WasteEntry[]) => void
  setPurchaseOrders: (pos: Types.PurchaseOrder[]) => void
  setSuppliers: (suppliers: Types.Supplier[]) => void
  setMenuItems: (items: Types.MenuItem[]) => void
  setRecipes: (recipes: Types.Recipe[]) => void
  setStaff: (staff: Types.Staff[]) => void
  setShifts: (shifts: Types.Shift[]) => void
  setTimesheets: (timesheets: Types.Timesheet[]) => void
  setForecasts: (forecasts: Types.Forecast[]) => void
  setTargets: (targets: Types.Target[]) => void
  
  // Utility
  clearAllData: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useDataStore = create<DataStore>((set) => ({
  // Initial state - ALL EMPTY
  orders: [],
  orderItems: [],
  tenders: [],
  ingredients: [],
  stockCounts: [],
  wasteEntries: [],
  purchaseOrders: [],
  suppliers: [],
  menuItems: [],
  recipes: [],
  staff: [],
  shifts: [],
  timesheets: [],
  forecasts: [],
  targets: [],
  
  isLoading: false,
  error: null,
  
  // Setters
  setOrders: (orders) => set({ orders }),
  setOrderItems: (orderItems) => set({ orderItems }),
  setTenders: (tenders) => set({ tenders }),
  setIngredients: (ingredients) => set({ ingredients }),
  setStockCounts: (stockCounts) => set({ stockCounts }),
  setWasteEntries: (wasteEntries) => set({ wasteEntries }),
  setPurchaseOrders: (purchaseOrders) => set({ purchaseOrders }),
  setSuppliers: (suppliers) => set({ suppliers }),
  setMenuItems: (menuItems) => set({ menuItems }),
  setRecipes: (recipes) => set({ recipes }),
  setStaff: (staff) => set({ staff }),
  setShifts: (shifts) => set({ shifts }),
  setTimesheets: (timesheets) => set({ timesheets }),
  setForecasts: (forecasts) => set({ forecasts }),
  setTargets: (targets) => set({ targets }),
  
  clearAllData: () => set({
    orders: [],
    orderItems: [],
    tenders: [],
    ingredients: [],
    stockCounts: [],
    wasteEntries: [],
    purchaseOrders: [],
    suppliers: [],
    menuItems: [],
    recipes: [],
    staff: [],
    shifts: [],
    timesheets: [],
    forecasts: [],
    targets: [],
    error: null
  }),
  
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error })
}))
