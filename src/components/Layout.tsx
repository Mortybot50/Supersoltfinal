import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { useAuth } from "@/contexts/AuthContext"
import {
  LayoutGrid,
  TrendingUp,
  Package,
  ChefHat,
  Users,
  Clipboard,
  Settings,
  ChevronDown,
  ChevronRight,
  Building2,
  ClipboardCheck,
  LogOut,
  Sun,
  Moon,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
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
import { LucideIcon } from "lucide-react"

type NavItem = {
  title: string
  url?: string
  icon: LucideIcon
  items?: { title: string; url?: string; soon?: boolean }[]
}

const navigationItems: NavItem[] = [
  { title: "DASHBOARD", url: "/dashboard", icon: LayoutGrid },
  { title: "SALES", url: "/sales", icon: TrendingUp },
  {
    title: "MENU",
    icon: ChefHat,
    items: [
      { title: "Recipes", url: "/menu/recipes" },
      { title: "Menu Items", url: "/menu/items" },
      { title: "Ingredients", url: "/inventory/ingredients" },
    ],
  },
  {
    title: "INVENTORY",
    icon: Package,
    items: [
      { title: "Order Guide", url: "/inventory/order-guide" },
      { title: "Purchase Orders", url: "/inventory/purchase-orders" },
      { title: "Stock Counts", url: "/inventory/stock-counts" },
      { title: "Waste", url: "/inventory/waste" },
      { title: "Reports", url: "/inventory/reports" },
    ],
  },
  {
    title: "WORKFORCE",
    icon: ClipboardCheck,
    items: [
      { title: "Roster", url: "/workforce/roster" },
      { title: "Timesheets", url: "/workforce/timesheets" },
      { title: "Payroll Export", url: "/workforce/payroll-export" },
      { title: "Reports", url: "/workforce/reports" },
    ],
  },
  { title: "PEOPLE", url: "/workforce/people", icon: Users },
  { title: "SUPPLIERS", url: "/suppliers", icon: Building2 },
  {
    title: "OPERATIONS",
    icon: Clipboard,
    items: [
      { title: "Daybook", url: "/operations/daybook" },
      { title: "Compliance", url: "/operations/compliance" },
    ],
  },
  {
    title: "ADMIN",
    icon: Settings,
    items: [
      { title: "Org Settings", url: "/admin/org-settings" },
      { title: "Venue Settings", url: "/admin/venue-settings" },
      { title: "Locations", url: "/admin/locations" },
      { title: "Access & Roles", url: "/admin/access-roles" },
      { title: "Data Imports", url: "/admin/data-imports" },
      { title: "Integrations", url: "/integrations" },
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
  const { theme, setTheme } = useTheme()
  const { profile, currentVenue, venues, setCurrentVenue, orgMember, signOut } = useAuth()

  // Get user initials for avatar
  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase()
    }
    return "?"
  }

  // Get display name
  const getDisplayName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`
    }
    return profile?.email || "User"
  }

  // Get role display
  const getRoleDisplay = () => {
    if (!orgMember?.role) return ""
    return orgMember.role.charAt(0).toUpperCase() + orgMember.role.slice(1)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate("/login")
  }

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
                  <span className="font-semibold">{currentVenue?.name || "Select Venue"}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-popover">
                <DropdownMenuLabel>Switch Venue</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {venues.map((venue) => (
                  <DropdownMenuItem
                    key={venue.id}
                    onClick={() => setCurrentVenue(venue)}
                    className={currentVenue?.id === venue.id ? "bg-accent" : ""}
                  >
                    {venue.name}
                  </DropdownMenuItem>
                ))}
                {venues.length === 0 && (
                  <DropdownMenuItem disabled>No venues available</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex-1" />

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden sm:block">
                    <div className="text-sm font-medium">{getDisplayName()}</div>
                    <div className="text-xs text-muted-foreground">{getRoleDisplay()}</div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/admin/org-settings')}>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  Log out
                </DropdownMenuItem>
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
