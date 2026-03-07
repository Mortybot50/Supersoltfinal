import {
  LayoutDashboard, LineChart, Package, ChefHat, Users, ClipboardList,
  Zap, Plug, Radio, Settings, Wallet, Upload
} from "lucide-react";

export type NavItem = {
  label: string;
  href?: string;
  icon?: React.ComponentType<any>;
  badgeKey?: "suggestions" | "alerts" | "tasks";
  children?: NavItem[];
  soon?: boolean;   // mark as post-MVP
  primary?: boolean; // visually emphasize within a group
};

export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },

  {
    label: "Insights", icon: LineChart, children: [
      { label: "Sales", href: "/sales" },
      { label: "COGS", href: "/insights/cogs" },
      { label: "Labour", href: "/insights/labour" },
      { label: "Flash P&L", href: "/insights/pnl", soon: true },
      { label: "Cash management", href: "/insights/cash", soon: true },
      { label: "Reports", href: "/reports" },
    ]
  },

  {
    label: "Inventory", icon: Package, children: [
      { label: "Order Guide", href: "/inventory/order-guide", primary: true },
      { label: "Ingredients", href: "/ingredients" },
      { label: "Suppliers", href: "/suppliers" },
      { label: "Purchases", href: "/inventory/purchases" },
      { label: "Counts", href: "/inventory/counts" },
      { label: "Waste", href: "/inventory/waste" },
      { label: "Transfers", href: "/inventory/transfers", soon: true },
    ]
  },

  {
    label: "Menu & Costing", icon: ChefHat, children: [
      { label: "Menu Items", href: "/menu-items" },
      { label: "Recipes", href: "/recipes" },
      { label: "Pricing (Smart)", href: "/menu/pricing", soon: true },
    ]
  },

  {
    label: "Workforce", icon: Users, children: [
      { label: "Roster", href: "/labour/roster", primary: true },
      { label: "Timesheets", href: "/labour/timesheets" },
      { label: "People", href: "/people" },
      { label: "Payroll Export", href: "/payroll/export" },
    ]
  },

  {
    label: "Operations", icon: ClipboardList, children: [
      { label: "Daybook", href: "/operations/daybook" },
      { label: "Imports", href: "/operations/imports" },
      { label: "Compliance", href: "/compliance" },
      { label: "Checklists", href: "/operations/checklists", soon: true },
    ]
  },

  {
    label: "Automation", icon: Zap, children: [
      { label: "Suggestions", href: "/automation/suggestions", badgeKey: "suggestions" },
      { label: "Demand Overrides", href: "/automation/demand-overrides" },
      { label: "Integrations", href: "/automation/integrations", icon: Plug },
      { label: "IoT Sensors", href: "/automation/iot", icon: Radio, soon: true },
    ]
  },

  {
    label: "Admin", icon: Settings, children: [
      { label: "Data Imports", href: "/admin/imports", icon: Upload },
      { label: "Org Settings", href: "/admin/settings/org" },
      { label: "Venue Settings", href: "/admin/settings/venue" },
      { label: "Locations", href: "/admin/locations" },
      { label: "Access & Roles", href: "/admin/access" },
      { label: "Billing", href: "/admin/billing", icon: Wallet, soon: true },
    ]
  }
];
