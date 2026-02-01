import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import {
  LayoutGrid,
  TrendingUp,
  Package,
  ChefHat,
  Users,
  Clipboard,
  Zap,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  ShoppingCart,
  Building2,
  FileText,
  ClipboardCheck,
  Activity,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import DataInitializer from "./DataInitializer"

type NavItem = {
  title: string
  url?: string
  icon: any
  items?: { title: string; url?: string; soon?: boolean }[]
}

const navigationItems: NavItem[] = [
  { title: "DASHBOARD", url: "/dashboard", icon: LayoutGrid },
  {
    title: "INSIGHTS",
    icon: TrendingUp,
    items: [
      { title: "Sales", url: "/insights/sales" },
      { title: "COGS", url: "/insights/cogs" },
      { title: "Labour", url: "/insights/labour" },
      { title: "Flash P&L", soon: true },
      { title: "Cash management", soon: true },
      { title: "Reports", url: "/insights/reports" },
    ],
  },
  {
    title: "INVENTORY",
    icon: Package,
    items: [
      { title: "Order Guide", url: "/inventory/order-guide" },
      { title: "Suppliers", url: "/suppliers" },
      { title: "Purchase Orders", url: "/inventory/purchase-orders" },
      { title: "Stock Counts", url: "/inventory/stock-counts" },
      { title: "Waste", url: "/inventory/waste" },
      { title: "Transfers", soon: true },
    ],
  },
  {
    title: "MENU & COSTING",
    icon: ChefHat,
    items: [
      { title: "Menu Items", url: "/menu/items" },
      { title: "Recipes", url: "/menu/recipes" },
      { title: "Pricing (Smart)", soon: true },
    ],
  },
  {
    title: "WORKFORCE",
    icon: Users,
    items: [
      { title: "People", url: "/workforce/people" },
      { title: "Roster", url: "/workforce/roster" },
      { title: "Timesheets", url: "/workforce/timesheets" },
      { title: "Payroll Export", url: "/workforce/payroll-export" },
    ],
  },
  {
    title: "OPERATIONS",
    icon: Clipboard,
    items: [
      { title: "Daybook", url: "/operations/daybook" },
      { title: "Imports", url: "/operations/imports" },
      { title: "Compliance", url: "/operations/compliance" },
      { title: "Checklists", soon: true },
    ],
  },
  {
    title: "AUTOMATION",
    icon: Zap,
    items: [
      { title: "Suggestions", url: "/automation/suggestions" },
      { title: "Demand Overrides", url: "/automation/demand-overrides" },
      { title: "Integrations", url: "/automation/integrations" },
      { title: "IoT Sensors", soon: true },
    ],
  },
  {
    title: "ADMIN",
    icon: Settings,
    items: [
      { title: "Data Imports", url: "/admin/data-imports" },
      { title: "Data Management", url: "/admin/data-management" },
      { title: "System Verification", url: "/admin/system-verification" },
      { title: "Diagnostics", url: "/admin/diagnostics" },
      { title: "Org Settings", url: "/admin/org-settings" },
      { title: "Venue Settings", url: "/admin/venue-settings" },
      { title: "Locations", url: "/admin/locations" },
      { title: "Access & Roles", url: "/admin/access-roles" },
      { title: "Billing", soon: true },
    ],
  },
]

function AppSidebar() {
  const location = useLocation()
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  // Auto-expand the section containing the current route (only ONE at a time)
  useEffect(() => {
    const path = location.pathname
    
    // Determine which section should be expanded based on current route
    const activeSection = navigationItems.find((item) => {
      if (item.items) {
        return item.items.some(
          (child) => child.url && path.startsWith(child.url)
        )
      }
      return false
    })
    
    // Set only the active section as expanded, collapse all others
    setExpandedSection(activeSection?.title || null)
  }, [location.pathname])

  const toggleSection = (title: string) => {
    // If clicking the already expanded section, collapse it
    // Otherwise, expand this section (and auto-collapse others)
    setExpandedSection((current) => (current === title ? null : title))
  }

  const isActiveRoute = (url?: string) => {
    if (!url) return false
    return location.pathname === url || location.pathname.startsWith(url + "/")
  }

  return (
    <Sidebar className="border-r bg-background">
      <SidebarContent className="px-3 py-4">
        <SidebarGroupLabel className="text-xl font-bold px-3 py-4 mb-2">
          SuperSolt
        </SidebarGroupLabel>

        <SidebarMenu className="space-y-1">
          {navigationItems.map((item) => {
            if (!item.items) {
              // Single item without submenu
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className={`px-3 py-2 ${
                      isActiveRoute(item.url)
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted"
                    }`}
                  >
                    <NavLink to={item.url || "#"}>
                      <item.icon className="h-5 w-5 mr-3" />
                      <span className="font-bold text-sm">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            }

            // Section with submenu
            const isOpen = expandedSection === item.title
            const hasActiveChild = item.items.some((child) =>
              isActiveRoute(child.url)
            )

            return (
              <Collapsible
                key={item.title}
                open={isOpen}
                onOpenChange={() => toggleSection(item.title)}
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className={`px-3 py-2 w-full justify-between transition-all duration-200 ${
                        hasActiveChild
                          ? "text-primary font-bold"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center">
                        <item.icon className="h-5 w-5 mr-3" />
                        <span className="font-bold text-sm">{item.title}</span>
                      </div>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                      ) : (
                        <ChevronRight className="h-4 w-4 transition-transform duration-200" />
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>

                <CollapsibleContent className="space-y-1 mt-1 overflow-hidden transition-all duration-200 ease-in-out data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                  {item.items.map((subItem) => (
                    <SidebarMenuItem key={subItem.title}>
                      {subItem.soon ? (
                        <div className="pl-[52px] py-2 text-sm text-muted-foreground cursor-not-allowed">
                          {subItem.title} • soon
                        </div>
                      ) : (
                        <SidebarMenuButton
                          asChild
                          className={`pl-[52px] py-2 ${
                            isActiveRoute(subItem.url)
                              ? "bg-primary/10 text-primary font-medium"
                              : "hover:bg-muted"
                          }`}
                        >
                          <NavLink to={subItem.url || "#"}>
                            <span className="text-sm">{subItem.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )
          })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}

export default function Layout() {
  const navigate = useNavigate()

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b bg-background flex items-center px-4 gap-4">
            <SidebarTrigger />
            
            {/* Venue Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <span className="font-semibold">Rowville Café</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-popover">
                <DropdownMenuLabel>Switch Venue</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Rowville Café</DropdownMenuItem>
                <DropdownMenuItem>Melbourne CBD</DropdownMenuItem>
                <DropdownMenuItem>Brighton Store</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex-1" />
            
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      JS
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden sm:block">
                    <div className="text-sm font-medium">J Smith</div>
                    <div className="text-xs text-muted-foreground">Manager</div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings?tab=profile')}>
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 overflow-auto">
            <DataInitializer />
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
