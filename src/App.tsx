import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import Layout from "./components/Layout"
import Dashboard from "./pages/Dashboard"
import NotFound from "./pages/NotFound"

// Insights
import Sales from "./pages/insights/Sales"
import COGS from "./pages/insights/COGS"
import Labour from "./pages/insights/Labour"
import InsightsReports from "./pages/insights/InsightsReports"

// Inventory
import OrderGuide from "./pages/inventory/OrderGuide"
import Ingredients from "./pages/Ingredients"
import Suppliers from "./pages/Suppliers"
import SupplierDetail from "./pages/SupplierDetail"
import PurchaseOrders from "./pages/inventory/PurchaseOrders"
import PurchaseOrderDetail from "./pages/inventory/PurchaseOrderDetail"
import StockCounts from "./pages/inventory/StockCounts"
import NewStockCount from "./pages/inventory/NewStockCount"
import Waste from "./pages/inventory/Waste"

// Menu & Costing
import MenuItems from "./pages/MenuItems"
import Recipes from "./pages/menu/Recipes"
import RecipeEditor from "./pages/menu/RecipeEditor"

// Workforce
import Roster from "./pages/labour/Roster"
import Timesheets from "./pages/labour/Timesheets"
import People from "./pages/People"
import PayrollExport from "./pages/Payroll"

// Onboarding
import StaffDetail from "./pages/onboarding/StaffDetail"
import InvitePortal from "./pages/onboarding/InvitePortal"
import InviteStep from "./pages/onboarding/InviteStep"

// Operations
import Daybook from "./pages/operations/Daybook"
import Imports from "./pages/operations/Imports"
import Compliance from "./pages/operations/Compliance"

// Automation
import Suggestions from "./pages/Automation"
import DemandOverrides from "./pages/automation/DemandOverrides"
import Integrations from "./pages/automation/Integrations"

// Admin
import DataImports from "./pages/admin/DataImports"
import DataManagement from "./pages/admin/DataManagement"
import SystemVerification from "./pages/admin/SystemVerification"
import DiagnosticsPage from "./pages/admin/DiagnosticsPage"
import OrgSettings from "./pages/admin/OrgSettings"
import VenueSettings from "./pages/admin/VenueSettings"
import Locations from "./pages/admin/Locations"
import AccessRoles from "./pages/admin/AccessRoles"

const queryClient = new QueryClient()

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            
            {/* Insights */}
            <Route path="insights/sales" element={<Sales />} />
            <Route path="insights/cogs" element={<COGS />} />
            <Route path="insights/labour" element={<Labour />} />
            <Route path="insights/reports" element={<InsightsReports />} />
            
            {/* Inventory */}
            <Route path="inventory/order-guide" element={<OrderGuide />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="suppliers/:supplierId" element={<SupplierDetail />} />
            <Route path="inventory/purchase-orders" element={<PurchaseOrders />} />
            <Route path="inventory/purchase-orders/:poId" element={<PurchaseOrderDetail />} />
            <Route path="inventory/stock-counts" element={<StockCounts />} />
            <Route path="inventory/stock-counts/new" element={<NewStockCount />} />
            <Route path="inventory/waste" element={<Waste />} />
            
            {/* Menu & Costing */}
            <Route path="menu/items" element={<MenuItems />} />
            <Route path="menu/recipes" element={<Recipes />} />
            <Route path="menu/recipes/:recipeId" element={<RecipeEditor />} />
            
            {/* Workforce */}
            <Route path="workforce/roster" element={<Roster />} />
            <Route path="workforce/timesheets" element={<Timesheets />} />
            <Route path="workforce/people" element={<People />} />
            <Route path="workforce/people/:id" element={<StaffDetail />} />
            <Route path="workforce/payroll-export" element={<PayrollExport />} />
            
            {/* Operations */}
            <Route path="operations/daybook" element={<Daybook />} />
            <Route path="operations/imports" element={<Imports />} />
            <Route path="operations/compliance" element={<Compliance />} />
            
            {/* Automation */}
            <Route path="automation/suggestions" element={<Suggestions />} />
            <Route path="automation/demand-overrides" element={<DemandOverrides />} />
            <Route path="automation/integrations" element={<Integrations />} />
            
            {/* Admin */}
            <Route path="admin/data-imports" element={<DataImports />} />
            <Route path="admin/data-management" element={<DataManagement />} />
            <Route path="admin/system-verification" element={<SystemVerification />} />
            <Route path="admin/diagnostics" element={<DiagnosticsPage />} />
            <Route path="admin/org-settings" element={<OrgSettings />} />
            <Route path="admin/venue-settings" element={<VenueSettings />} />
            <Route path="admin/locations" element={<Locations />} />
            <Route path="admin/access-roles" element={<AccessRoles />} />
            
            <Route path="*" element={<NotFound />} />
          </Route>
          
          {/* Public Onboarding Portal (outside Layout) */}
          <Route path="onboarding/portal/:token" element={<InvitePortal />} />
          <Route path="onboarding/portal/:token/step:stepNumber" element={<InviteStep />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
      <Sonner />
    </TooltipProvider>
  </QueryClientProvider>
)

export default App
