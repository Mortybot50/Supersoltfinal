import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { ThemeProvider } from "next-themes"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "@/contexts/AuthContext"
import ProtectedRoute from "@/components/ProtectedRoute"
import { ErrorBoundary, PageErrorBoundary } from "@/components/ErrorBoundary"
import Layout from "./components/Layout"
import PageLoader from "./components/PageLoader"

// Auth (small, load eagerly so login feels instant)
import Login from "./pages/auth/Login"
import Signup from "./pages/auth/Signup"
import ConfirmEmail from "./pages/auth/ConfirmEmail"
import ForgotPassword from "./pages/auth/ForgotPassword"
import ResetPassword from "./pages/auth/ResetPassword"

// Dashboard (loaded eagerly — first page after login)
import Dashboard from "./pages/Dashboard"

// NotFound (tiny, no benefit to lazy-loading)
import NotFound from "./pages/NotFound"

// ── Lazy page routes ────────────────────────────────────────────────────────

// Inventory
const InventoryOverview    = lazy(() => import("./pages/inventory/InventoryOverview"))
const OrderGuide           = lazy(() => import("./pages/inventory/OrderGuide"))
const Ingredients          = lazy(() => import("./pages/Ingredients"))
const Suppliers            = lazy(() => import("./pages/Suppliers"))
const SupplierDetail       = lazy(() => import("./pages/SupplierDetail"))
const PurchaseOrders       = lazy(() => import("./pages/inventory/PurchaseOrders"))
const PurchaseOrderDetail  = lazy(() => import("./pages/inventory/PurchaseOrderDetail"))
const StockCounts          = lazy(() => import("./pages/inventory/StockCounts"))
const NewStockCount        = lazy(() => import("./pages/inventory/NewStockCount"))
const Waste                = lazy(() => import("./pages/inventory/Waste"))
const InventoryReports     = lazy(() => import("./pages/inventory/InventoryReports"))
const FoodCostAnalysis     = lazy(() => import("./pages/inventory/FoodCostAnalysis"))
const PriceTracking        = lazy(() => import("./pages/inventory/PriceTracking"))
const POReceiving          = lazy(() => import("./pages/inventory/POReceiving"))
const PurchaseByInvoice    = lazy(() => import("./pages/inventory/PurchaseByInvoice"))
const PurchaseFromInvoice  = lazy(() => import("./pages/inventory/PurchaseFromInvoice"))

// Invoice Intelligence (heavy — Claude Vision, keep in its own chunk)
const Invoices             = lazy(() => import("./pages/inventory/Invoices"))
const InvoiceUpload        = lazy(() => import("./pages/inventory/InvoiceUpload"))
const InvoiceDetail        = lazy(() => import("./pages/inventory/InvoiceDetail"))
const Reconciliation       = lazy(() => import("./pages/inventory/Reconciliation"))

// Menu & Costing
const MenuItems            = lazy(() => import("./pages/MenuItems"))
const Recipes              = lazy(() => import("./pages/menu/Recipes"))
const RecipeEditor         = lazy(() => import("./pages/menu/RecipeEditor"))

// Sales
const Sales                = lazy(() => import("./pages/Sales"))

// Workforce
const Roster               = lazy(() => import("./pages/labour/Roster"))
const Timesheets           = lazy(() => import("./pages/labour/Timesheets"))
const TimesheetsDaily      = lazy(() => import("./pages/labour/TimesheetsDaily"))
const TimesheetDetail      = lazy(() => import("./pages/labour/TimesheetDetail"))
const LabourReports        = lazy(() => import("./pages/labour/Reports"))
const AvailabilityLeave    = lazy(() => import("./pages/labour/AvailabilityLeave"))
const People               = lazy(() => import("./pages/People"))
const StaffDetail          = lazy(() => import("./pages/labour/StaffDetail"))
const Qualifications       = lazy(() => import("./pages/labour/Qualifications"))
const PayrollExport        = lazy(() => import("./pages/labour/PayrollExport"))

// Operations
const Daybook              = lazy(() => import("./pages/operations/Daybook"))
const Compliance           = lazy(() => import("./pages/operations/Compliance"))

// Admin
const AdminIntegrations    = lazy(() => import("./pages/admin/Integrations"))
const DataImports          = lazy(() => import("./pages/admin/DataImports"))
const OrgSettings          = lazy(() => import("./pages/admin/OrgSettings"))
const VenueSettings        = lazy(() => import("./pages/admin/VenueSettings"))
const Locations            = lazy(() => import("./pages/admin/Locations"))
const AccessRoles          = lazy(() => import("./pages/admin/AccessRoles"))

// Onboarding & Setup
const InvitePortal         = lazy(() => import("./pages/onboarding/InvitePortal"))
const InviteStep           = lazy(() => import("./pages/onboarding/InviteStep"))
const SetupWizard          = lazy(() => import("./pages/setup/SetupWizard"))

// ────────────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient()

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
    <TooltipProvider>
      <BrowserRouter>
        <PageErrorBoundary>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/confirm-email" element={<ConfirmEmail />} />
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
              <Route path="inventory" element={<InventoryOverview />} />
              <Route path="inventory/overview" element={<InventoryOverview />} />
              <Route path="inventory/order-guide" element={<OrderGuide />} />
              <Route path="inventory/ingredients" element={<Ingredients />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="suppliers/:supplierId" element={<SupplierDetail />} />
              <Route path="inventory/purchase-orders" element={<PurchaseOrders />} />
              <Route path="inventory/purchase-orders/:poId" element={<PurchaseOrderDetail />} />
              <Route path="inventory/purchase-orders/:poId/receive" element={<POReceiving />} />
              <Route path="inventory/stock-counts" element={<StockCounts />} />
              <Route path="inventory/stock-counts/new" element={<NewStockCount />} />
              <Route path="inventory/waste" element={<Waste />} />
              <Route path="inventory/reports" element={<InventoryReports />} />
              <Route path="inventory/invoices" element={<Invoices />} />
              <Route path="inventory/invoices/upload" element={<InvoiceUpload />} />
              <Route path="inventory/invoices/:invoiceId" element={<InvoiceDetail />} />
              <Route path="inventory/invoices/:invoiceId/reconcile" element={<Reconciliation />} />
              <Route path="inventory/purchase-by-invoice" element={<PurchaseByInvoice />} />
              <Route path="inventory/purchases/from-invoice/:invoiceId" element={<PurchaseFromInvoice />} />
              <Route path="inventory/food-cost" element={<FoodCostAnalysis />} />
              <Route path="inventory/price-tracking" element={<PriceTracking />} />

              {/* Menu & Costing */}
              <Route path="menu/items" element={<MenuItems />} />
              <Route path="menu/recipes" element={<Recipes />} />
              <Route path="menu/recipes/:recipeId" element={<RecipeEditor />} />

              {/* Workforce */}
              <Route path="workforce/roster" element={<Roster />} />
              <Route path="workforce/timesheets" element={<Timesheets />} />
              <Route path="workforce/timesheets/daily/:date" element={<TimesheetsDaily />} />
              <Route path="workforce/timesheets/:staffId/:periodStart" element={<TimesheetDetail />} />
              <Route path="workforce/reports" element={<LabourReports />} />
              <Route path="labour-reports" element={<Navigate to="/workforce/reports" replace />} />
              <Route path="workforce/people" element={<People />} />
              <Route path="workforce/people/:id" element={<StaffDetail />} />
              <Route path="workforce/qualifications" element={<Qualifications />} />
              <Route path="workforce/availability" element={<AvailabilityLeave />} />
              <Route path="labour/availability" element={<Navigate to="/workforce/availability" replace />} />
              <Route path="workforce/payroll-export" element={<PayrollExport />} />

              {/* Operations */}
              <Route path="operations/daybook" element={<Daybook />} />
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
          </Suspense>
        </AuthProvider>
      </PageErrorBoundary>
        </BrowserRouter>
      <Sonner />
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
)

export default App
