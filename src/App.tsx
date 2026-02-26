import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "@/contexts/AuthContext"
import ProtectedRoute from "@/components/ProtectedRoute"
import { ErrorBoundary, PageErrorBoundary } from "@/components/ErrorBoundary"
import Layout from "./components/Layout"
import Dashboard from "./pages/Dashboard"
import NotFound from "./pages/NotFound"

// Auth
import Login from "./pages/auth/Login"
import Signup from "./pages/auth/Signup"
import ForgotPassword from "./pages/auth/ForgotPassword"
import ResetPassword from "./pages/auth/ResetPassword"

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
import InventoryReports from "./pages/inventory/InventoryReports"

// Menu & Costing
import MenuItems from "./pages/MenuItems"
import Recipes from "./pages/menu/Recipes"
import RecipeEditor from "./pages/menu/RecipeEditor"

// Sales
import Sales from "./pages/Sales"

// Workforce
import Roster from "./pages/labour/Roster"
import Timesheets from "./pages/labour/Timesheets"
import LabourReports from "./pages/labour/Reports"
import People from "./pages/People"
import PayrollExport from "./pages/Payroll"

// Onboarding
import StaffDetail from "./pages/onboarding/StaffDetail"
import InvitePortal from "./pages/onboarding/InvitePortal"
import InviteStep from "./pages/onboarding/InviteStep"

// Setup Wizard
import SetupWizard from "./pages/setup/SetupWizard"

// Operations
import Daybook from "./pages/operations/Daybook"
import Imports from "./pages/operations/Imports"
import Compliance from "./pages/operations/Compliance"

// Integrations
import AdminIntegrations from "./pages/admin/Integrations"

// Admin
import DataImports from "./pages/admin/DataImports"
import OrgSettings from "./pages/admin/OrgSettings"
import VenueSettings from "./pages/admin/VenueSettings"
import Locations from "./pages/admin/Locations"
import AccessRoles from "./pages/admin/AccessRoles"

const queryClient = new QueryClient()

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
    <TooltipProvider>
      <BrowserRouter>
        <PageErrorBoundary>
        <AuthProvider>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Dashboard />} />

              {/* Sales */}
              <Route path="sales" element={<Sales />} />

              {/* Inventory */}
              <Route path="inventory/order-guide" element={<OrderGuide />} />
              <Route path="inventory/ingredients" element={<Ingredients />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="suppliers/:supplierId" element={<SupplierDetail />} />
              <Route path="inventory/purchase-orders" element={<PurchaseOrders />} />
              <Route path="inventory/purchase-orders/:poId" element={<PurchaseOrderDetail />} />
              <Route path="inventory/stock-counts" element={<StockCounts />} />
              <Route path="inventory/stock-counts/new" element={<NewStockCount />} />
              <Route path="inventory/waste" element={<Waste />} />
              <Route path="inventory/reports" element={<InventoryReports />} />

              {/* Menu & Costing */}
              <Route path="menu/items" element={<MenuItems />} />
              <Route path="menu/recipes" element={<Recipes />} />
              <Route path="menu/recipes/:recipeId" element={<RecipeEditor />} />

              {/* Workforce */}
              <Route path="workforce/roster" element={<Roster />} />
              <Route path="workforce/timesheets" element={<Timesheets />} />
              <Route path="workforce/reports" element={<LabourReports />} />
              <Route path="labour-reports" element={<Navigate to="/workforce/reports" replace />} />
              <Route path="workforce/people" element={<People />} />
              <Route path="workforce/people/:id" element={<StaffDetail />} />
              <Route path="workforce/payroll-export" element={<PayrollExport />} />

              {/* Operations */}
              <Route path="operations/daybook" element={<Daybook />} />
              <Route path="operations/imports" element={<Imports />} />
              <Route path="operations/compliance" element={<Compliance />} />

              {/* Admin */}
              <Route path="admin/data-imports" element={<DataImports />} />
              <Route path="admin/org-settings" element={<ProtectedRoute requiredRole="admin"><OrgSettings /></ProtectedRoute>} />
              <Route path="admin/venue-settings" element={<VenueSettings />} />
              <Route path="admin/locations" element={<Locations />} />
              <Route path="admin/access-roles" element={<ProtectedRoute requiredRole="admin"><AccessRoles /></ProtectedRoute>} />
              <Route path="admin/integrations" element={<ProtectedRoute requiredRole="admin"><AdminIntegrations /></ProtectedRoute>} />

              {/* Legacy route redirects */}
              <Route path="menu/ingredients" element={<Navigate to="/inventory/ingredients" replace />} />
              <Route path="settings" element={<Navigate to="/admin/org-settings" replace />} />
              <Route path="integrations" element={<Navigate to="/admin/integrations" replace />} />

              <Route path="*" element={<NotFound />} />
            </Route>

            {/* Setup Wizard (protected but outside Layout) */}
            <Route path="/setup" element={<ProtectedRoute><SetupWizard /></ProtectedRoute>} />
            {/* Public Onboarding Portal (outside Layout) */}
            <Route path="onboarding/portal/:token" element={<InvitePortal />} />
            <Route path="onboarding/portal/:token/step:stepNumber" element={<InviteStep />} />
          </Routes>
        </AuthProvider>
      </PageErrorBoundary>
        </BrowserRouter>
      <Toaster />
      <Sonner />
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
)

export default App
