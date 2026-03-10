"use client"

import {
  LayoutDashboard,
  Users,
  Clock,
  DollarSign,
  FileCheck,
  BarChart3,
  Settings,
  UtensilsCrossed,
  Package,
  BookOpen,
  TrendingUp,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"

const menuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "People",
    url: "/people",
    icon: Users,
  },
  {
    title: "Menu Items",
    url: "/menu-items",
    icon: UtensilsCrossed,
  },
  {
    title: "Ingredients",
    url: "/ingredients",
    icon: Package,
  },
  {
    title: "Recipes",
    url: "/recipes",
    icon: BookOpen,
  },
  {
    title: "Sales",
    url: "/sales",
    icon: TrendingUp,
  },
  {
    title: "Labour - Roster",
    url: "/labour/roster",
    icon: Clock,
  },
  {
    title: "Labour - Timesheets",
    url: "/labour/timesheets",
    icon: Clock,
  },
  {
    title: "Payroll - Export",
    url: "/payroll/export",
    icon: DollarSign,
  },
  {
    title: "Compliance",
    url: "/compliance",
    icon: FileCheck,
  },
  {
    title: "Reports and Insights",
    url: "/reports",
    icon: BarChart3,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <div className="px-4 py-6">
            <h1 className="text-xl font-bold">HospitalityOps</h1>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
