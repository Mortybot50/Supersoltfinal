import { pgTable, text, timestamp, uuid, json, pgEnum, uniqueIndex, index, integer, date, boolean, numeric, smallint, varchar, jsonb } from "drizzle-orm/pg-core"

// Import error type for imports_log
interface ImportError {
  row: number;
  message: string;
}

// Enums
export const roleEnum = pgEnum("role", ["owner", "manager", "supervisor", "crew"])
export const inviteStatusEnum = pgEnum("invite_status", ["pending", "accepted", "expired", "cancelled"])
export const timesheetSourceEnum = pgEnum("timesheet_source", ["mobile", "pin"])
export const timesheetStatusEnum = pgEnum("timesheet_status", ["pending", "approved", "rejected"])
export const payrollSystemEnum = pgEnum("payroll_system", ["xero", "keypay", "myob"])

// User table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password_hash: text("password_hash"),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
})

// Auth.js adapter tables
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (table) => ({
  providerProviderAccountIdUnique: uniqueIndex("account_provider_provider_account_id_unique").on(table.provider, table.providerAccountId),
}))

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionToken: text("session_token").notNull().unique(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
})

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull().unique(),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
}, (table) => ({
  identifierTokenUnique: uniqueIndex("verification_token_identifier_token_unique").on(table.identifier, table.token),
}))

// Organisation table
export const organisations = pgTable("organisations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  settings: json("settings").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
})

// Venue table
export const venues = pgTable("venues", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  name: text("name").notNull(),
  timezone: text("timezone").notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgIdIdx: index("venue_org_id_idx").on(table.orgId),
}))

// Membership table
export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  role: roleEnum("role").notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userOrgUnique: uniqueIndex("membership_user_org_unique").on(table.userId, table.orgId),
}))

// Invite table
export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  email: text("email").notNull(),
  role: roleEnum("role").notNull(),
  token: text("token").notNull().unique(),
  status: inviteStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
})

// Invitations table (email-based onboarding)
export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  email: varchar("email", { length: 320 }).notNull(),
  role: varchar("role", { length: 32 }).notNull(),
  inviterId: uuid("inviter_id").notNull().references(() => users.id),
  tokenHash: varchar("token_hash", { length: 96 }).notNull(),
  expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { mode: "date", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgEmailIdx: index("idx_invites_org_email").on(table.orgId, table.email),
}))

// Password reset tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  tokenHash: varchar("token_hash", { length: 96 }).notNull(),
  expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { mode: "date", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userExpiresIdx: index("idx_pwdreset_user").on(table.userId, table.expiresAt),
}))

// AuditLog table
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  action: text("action").notNull(),
  before: json("before").$type<Record<string, unknown>>(),
  after: json("after").$type<Record<string, unknown>>(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
})

// Type exports for TypeScript
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Organisation = typeof organisations.$inferSelect
export type NewOrganisation = typeof organisations.$inferInsert

export type Venue = typeof venues.$inferSelect
export type NewVenue = typeof venues.$inferInsert

export type Membership = typeof memberships.$inferSelect
export type NewMembership = typeof memberships.$inferInsert

export type Invite = typeof invites.$inferSelect
export type NewInvite = typeof invites.$inferInsert

export type Invitation = typeof invitations.$inferSelect
export type NewInvitation = typeof invitations.$inferInsert

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert

// Staff table
export const staff = pgTable("staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  venueId: uuid("venue_id").references(() => venues.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  roleTitle: text("role_title").notNull(),
  hourlyRateCents: integer("hourly_rate_cents").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  externalId: varchar("external_id", { length: 128 }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgIdIdx: index("staff_org_id_idx").on(table.orgId),
  orgExternalIdIdx: index("staff_org_external_id_idx").on(table.orgId, table.externalId),
}))

// Roster table
export const rosters = pgTable("rosters", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  weekStartDate: date("week_start_date").notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgVenueWeekUnique: uniqueIndex("roster_org_venue_week_unique").on(table.orgId, table.venueId, table.weekStartDate),
  orgVenueIdx: index("roster_org_venue_idx").on(table.orgId, table.venueId),
}))

// Shift table
export const shifts = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  rosterId: uuid("roster_id").notNull().references(() => rosters.id),
  staffId: uuid("staff_id").references(() => staff.id), // nullable for draft shifts
  roleTitle: text("role_title").notNull(),
  role: text("role"), // nullable role for categorization (FOH, BOH, etc.)
  status: varchar("status", { length: 16 }).notNull().default("DRAFT"), // DRAFT | PUBLISHED
  publishedAt: timestamp("published_at", { mode: "date", withTimezone: true }),
  wageRateCentsSnapshot: integer("wage_rate_cents_snapshot"), // snapshot wage at publish
  startTs: timestamp("start_ts", { mode: "date", withTimezone: true }).notNull(),
  endTs: timestamp("end_ts", { mode: "date", withTimezone: true }).notNull(),
  breakMinutes: integer("break_minutes").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  rosterIdIdx: index("shift_roster_id_idx").on(table.rosterId),
}))

// Roster Publications table - audit log for published weeks
export const rosterPublications = pgTable("roster_publications", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  weekStart: date("week_start", { mode: "string" }).notNull(), // Monday start
  version: integer("version").notNull().default(1),
  publishedBy: uuid("published_by").notNull().references(() => users.id),
  publishedAt: timestamp("published_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgVenueWeekIdx: index("roster_pub_org_venue_week_idx").on(table.orgId, table.venueId, table.weekStart),
}))

// Roster Templates table - saved shift patterns
export const rosterTemplates = pgTable("roster_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  name: varchar("name", { length: 120 }).notNull(),
  weekday: integer("weekday"), // 0..6 optional; null = any
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgVenueIdx: index("roster_templates_org_venue_idx").on(table.orgId, table.venueId),
}))

// Roster Template Lines table - shift blocks within a template
export const rosterTemplateLines = pgTable("roster_template_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id").notNull().references(() => rosterTemplates.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 64 }).notNull(),
  startMinute: integer("start_minute").notNull(), // minutes from midnight
  endMinute: integer("end_minute").notNull(),
  headcount: integer("headcount").notNull().default(1),
}, (table) => ({
  templateIdIdx: index("roster_template_lines_template_idx").on(table.templateId),
}))

// Timesheet table
export const timesheets = pgTable("timesheets", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  staffId: uuid("staff_id").notNull().references(() => staff.id),
  shiftId: uuid("shift_id").references(() => shifts.id),
  clockInTs: timestamp("clock_in_ts", { mode: "date", withTimezone: true }).notNull(),
  clockOutTs: timestamp("clock_out_ts", { mode: "date", withTimezone: true }),
  breakMinutes: integer("break_minutes").notNull().default(0),
  source: timesheetSourceEnum("source").notNull(),
  status: timesheetStatusEnum("status").notNull().default("pending"),
  managerNote: text("manager_note"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgVenueIdx: index("timesheet_org_venue_idx").on(table.orgId, table.venueId),
  staffIdIdx: index("timesheet_staff_id_idx").on(table.staffId),
  shiftIdIdx: index("timesheet_shift_id_idx").on(table.shiftId),
}))

// StaffIntegration table - links staff to external payroll systems
export const staffIntegrations = pgTable("staff_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  staffId: uuid("staff_id").notNull().references(() => staff.id),
  system: payrollSystemEnum("system").notNull(),
  externalRef: text("external_ref").notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgSystemStaffUnique: uniqueIndex("staff_integration_org_system_staff_unique").on(table.orgId, table.system, table.staffId),
  orgIdIdx: index("staff_integration_org_id_idx").on(table.orgId),
}))

// PayItemMap table - maps role titles to payroll system pay item codes
export const payItemMaps = pgTable("pay_item_maps", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  system: payrollSystemEnum("system").notNull(),
  roleTitle: text("role_title").notNull(),
  payItemCode: text("pay_item_code").notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgSystemRoleUnique: uniqueIndex("pay_item_map_org_system_role_unique").on(table.orgId, table.system, table.roleTitle),
  orgIdIdx: index("pay_item_map_org_id_idx").on(table.orgId),
}))

// Type exports for Labour module
export type Staff = typeof staff.$inferSelect
export type NewStaff = typeof staff.$inferInsert

export type Roster = typeof rosters.$inferSelect
export type NewRoster = typeof rosters.$inferInsert

export type Shift = typeof shifts.$inferSelect
export type NewShift = typeof shifts.$inferInsert

export type RosterPublication = typeof rosterPublications.$inferSelect
export type NewRosterPublication = typeof rosterPublications.$inferInsert

export type RosterTemplate = typeof rosterTemplates.$inferSelect
export type NewRosterTemplate = typeof rosterTemplates.$inferInsert

export type RosterTemplateLine = typeof rosterTemplateLines.$inferSelect
export type NewRosterTemplateLine = typeof rosterTemplateLines.$inferInsert

export type Timesheet = typeof timesheets.$inferSelect
export type NewTimesheet = typeof timesheets.$inferInsert

export type StaffIntegration = typeof staffIntegrations.$inferSelect
export type NewStaffIntegration = typeof staffIntegrations.$inferInsert

export type PayItemMap = typeof payItemMaps.$inferSelect
export type NewPayItemMap = typeof payItemMaps.$inferInsert

// Menu Items table - products/dishes offered to customers
export const menuItems = pgTable("menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  name: text("name").notNull(),
  priceCents: integer("price_cents").notNull(),
  sku: text("sku"),
  category: text("category"),
  isComposite: boolean("is_composite").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  externalId: varchar("external_id", { length: 128 }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgIdIdx: index("menu_item_org_id_idx").on(table.orgId),
  orgExternalIdIdx: index("menu_item_org_external_id_idx").on(table.orgId, table.externalId),
}))

// Ingredients table - raw materials/ingredients with cost and stock levels
export const ingredients = pgTable("ingredients", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  costPerUnitCents: integer("cost_per_unit_cents").notNull(),
  currentStockLevel: numeric("current_stock_level", { precision: 10, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  externalId: varchar("external_id", { length: 128 }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgIdIdx: index("ingredient_org_id_idx").on(table.orgId),
  orgExternalIdIdx: index("ingredient_org_external_id_idx").on(table.orgId, table.externalId),
}))

// Suppliers table - tracks supplier contact information
export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  name: text("name").notNull(),
  contactEmail: text("contact_email"),
  phone: text("phone"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  externalId: varchar("external_id", { length: 128 }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgIdIdx: index("supplier_org_id_idx").on(table.orgId),
  orgExternalIdIdx: index("supplier_org_external_id_idx").on(table.orgId, table.externalId),
}))

// Ingredient Suppliers table - many suppliers per ingredient with pricing
export const ingredientSuppliers = pgTable("ingredient_suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  ingredientId: uuid("ingredient_id").notNull().references(() => ingredients.id, { onDelete: "cascade" }),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  packSize: numeric("pack_size", { precision: 10, scale: 3 }),
  packUnit: text("pack_unit"),
  unitPriceCents: integer("unit_price_cents").notNull(),
  leadTimeDays: integer("lead_time_days").notNull().default(0),
  sku: text("sku"),
  isPreferred: boolean("is_preferred").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgIngredientSupplierUnique: uniqueIndex("ingredient_supplier_org_ingredient_supplier_unique").on(table.orgId, table.ingredientId, table.supplierId),
  ingredientIdIdx: index("ingredient_supplier_ingredient_id_idx").on(table.ingredientId),
  supplierIdIdx: index("ingredient_supplier_supplier_id_idx").on(table.supplierId),
}))

// Recipes table (header) - recipe metadata for menu items
export const recipes = pgTable("recipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id, { onDelete: "cascade" }),
  yieldQty: numeric("yield_qty", { precision: 10, scale: 3 }).notNull().default("1"),
  yieldUnit: text("yield_unit"),
  wastagePct: numeric("wastage_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgMenuItemUnique: uniqueIndex("recipe_org_menu_item_unique").on(table.orgId, table.menuItemId),
  menuItemIdIdx: index("recipe_menu_item_id_idx").on(table.menuItemId),
}))

// Recipe Lines table - ingredients or sub-menu items in a recipe
export const recipeLines = pgTable("recipe_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  recipeId: uuid("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  ingredientId: uuid("ingredient_id").references(() => ingredients.id, { onDelete: "cascade" }),
  subMenuItemId: uuid("sub_menu_item_id").references(() => menuItems.id, { onDelete: "cascade" }),
  qty: numeric("qty", { precision: 10, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  recipeIdIdx: index("recipe_line_recipe_id_idx").on(table.recipeId),
  ingredientIdIdx: index("recipe_line_ingredient_id_idx").on(table.ingredientId),
  subMenuItemIdIdx: index("recipe_line_sub_menu_item_id_idx").on(table.subMenuItemId),
}))

// Daily Sales table - tracks quantity sold per menu item per day
export const dailySales = pgTable("daily_sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  saleDate: date("sale_date", { mode: "string" }).notNull(),
  menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id),
  quantitySold: integer("quantity_sold").notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgDateIdx: index("daily_sales_org_date_idx").on(table.orgId, table.saleDate),
  orgVenueIdx: index("daily_sales_org_venue_idx").on(table.orgId, table.venueId),
  menuItemIdIdx: index("daily_sales_menu_item_id_idx").on(table.menuItemId),
  saleDateIdx: index("daily_sales_sale_date_idx").on(table.saleDate),
  venueMenuItemDateUnique: uniqueIndex("daily_sales_venue_menu_item_date_unique").on(table.venueId, table.menuItemId, table.saleDate),
}))

// Type exports for Inventory module
export type MenuItem = typeof menuItems.$inferSelect
export type NewMenuItem = typeof menuItems.$inferInsert

export type Ingredient = typeof ingredients.$inferSelect
export type NewIngredient = typeof ingredients.$inferInsert

export type Supplier = typeof suppliers.$inferSelect
export type NewSupplier = typeof suppliers.$inferInsert

export type IngredientSupplier = typeof ingredientSuppliers.$inferSelect
export type NewIngredientSupplier = typeof ingredientSuppliers.$inferInsert

export type Recipe = typeof recipes.$inferSelect
export type NewRecipe = typeof recipes.$inferInsert

export type RecipeLine = typeof recipeLines.$inferSelect
export type NewRecipeLine = typeof recipeLines.$inferInsert

export type DailySale = typeof dailySales.$inferSelect
export type NewDailySale = typeof dailySales.$inferInsert

// Purchase Orders table - tracks ingredient orders from suppliers
export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  supplierId: uuid("supplier_id").references(() => suppliers.id), // Made nullable for auto-generated POs
  supplierName: varchar("supplier_name", { length: 255 }), // Added for non-supplier orders
  supplierEmail: varchar("supplier_email", { length: 255 }), // Added for non-supplier orders
  number: varchar("number", { length: 32 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("DRAFT"),
  orderDate: date("order_date", { mode: "string" }), // Added order date
  currency: varchar("currency", { length: 8 }).notNull().default("AUD"),
  expectedDate: date("expected_date", { mode: "string" }),
  notes: varchar("notes", { length: 512 }),
  subtotalCents: integer("subtotal_cents").notNull().default(0),
  taxCents: integer("tax_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull().default(0),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { mode: "date", withTimezone: true }),
  receivedAt: timestamp("received_at", { mode: "date", withTimezone: true }),
  idempotencyKey: varchar("idempotency_key", { length: 128 }),
}, (table) => ({
  orgVenueStatusIdx: index("po_org_venue_status_idx").on(table.orgId, table.venueId, table.status),
  numberIdx: index("po_number_idx").on(table.number),
  idempotencyKeyIdx: index("po_idempotency_key_idx").on(table.idempotencyKey),
}))

// Purchase Order Lines table - individual items in a purchase order
export const purchaseOrderLines = pgTable("purchase_order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  poId: uuid("po_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  ingredientId: uuid("ingredient_id").notNull().references(() => ingredients.id),
  packLabel: varchar("pack_label", { length: 64 }),
  packSize: numeric("pack_size", { precision: 12, scale: 3 }),
  packUnit: varchar("pack_unit", { length: 16 }),
  supplierItemId: uuid("supplier_item_id").references(() => ingredientSuppliers.id),
  baseUom: varchar("base_uom", { length: 8 }).notNull(),
  baseQtyPerPack: integer("base_qty_per_pack").notNull(),
  packsOrdered: numeric("packs_ordered", { precision: 12, scale: 3 }).notNull(),
  packsReceived: numeric("packs_received", { precision: 12, scale: 3 }).notNull().default("0"),
  packCostCents: integer("pack_cost_cents").notNull(),
  unitCostCentsSnapshot: integer("unit_cost_cents_snapshot"),
  lineTotalCents: integer("line_total_cents").notNull(),
  note: varchar("note", { length: 512 }),
}, (table) => ({
  poIdIdx: index("pol_po_id_idx").on(table.poId),
}))

// Stock Movements table - tracks all inventory changes (receipts, adjustments, waste)
export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  ingredientId: uuid("ingredient_id").notNull().references(() => ingredients.id),
  type: varchar("type", { length: 16 }).notNull(),
  qtyBase: integer("qty_base").notNull(),
  unitCostCents: integer("unit_cost_cents").notNull().default(0),
  refType: varchar("ref_type", { length: 16 }),
  refId: uuid("ref_id"),
  occurredAt: timestamp("occurred_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgVenueIngredientOccurredIdx: index("mov_org_venue_ing_occurred_idx").on(table.orgId, table.venueId, table.ingredientId, table.occurredAt),
}))

// Receipts table - tracks when POs are received (partial or full)
export const receipts = pgTable("receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  poId: uuid("po_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  receivedAt: timestamp("received_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  receivedBy: uuid("received_by").notNull().references(() => users.id),
  status: varchar("status", { length: 16 }).notNull().default("partial"), // partial|full
  note: varchar("note", { length: 512 }),
}, (table) => ({
  poIdIdx: index("receipts_po_id_idx").on(table.poId),
  receivedAtIdx: index("receipts_received_at_idx").on(table.receivedAt),
}))

// Receipt Lines table - individual items received in a receipt
export const receiptLines = pgTable("receipt_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  receiptId: uuid("receipt_id").notNull().references(() => receipts.id, { onDelete: "cascade" }),
  poLineId: uuid("po_line_id").notNull().references(() => purchaseOrderLines.id),
  ingredientId: uuid("ingredient_id").notNull().references(() => ingredients.id),
  packsReceived: numeric("packs_received", { precision: 12, scale: 3 }).notNull(),
  qtyBaseUnits: numeric("qty_base_units", { precision: 12, scale: 3 }).notNull(),
  unitCostCentsSnapshot: integer("unit_cost_cents_snapshot").notNull(),
}, (table) => ({
  receiptIdIdx: index("receipt_lines_receipt_id_idx").on(table.receiptId),
  ingredientIdIdx: index("receipt_lines_ingredient_id_idx").on(table.ingredientId),
}))

// Type exports for Purchase Orders module
export type PurchaseOrder = typeof purchaseOrders.$inferSelect
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert

export type PurchaseOrderLine = typeof purchaseOrderLines.$inferSelect
export type NewPurchaseOrderLine = typeof purchaseOrderLines.$inferInsert

export type StockMovement = typeof stockMovements.$inferSelect
export type NewStockMovement = typeof stockMovements.$inferInsert

export type Receipt = typeof receipts.$inferSelect
export type NewReceipt = typeof receipts.$inferInsert

export type ReceiptLine = typeof receiptLines.$inferSelect
export type NewReceiptLine = typeof receiptLines.$inferInsert

// Sales Forecasts table - Per-menu-item daily forecasts (units)
export const salesForecasts = pgTable("sales_forecasts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  date: date("date", { mode: "date" }).notNull(),
  menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id),
  qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
  model: text("model").notNull().default("dow_ewma_v1"),
  generatedAt: timestamp("generated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  venueIdDateIdx: index("sales_forecasts_venue_date_idx").on(table.venueId, table.date),
  orgIdIdx: index("sales_forecasts_org_id_idx").on(table.orgId),
}))

// Forecast Hour Profiles table - Hourly distribution weights per DOW for a venue
export const forecastHourProfiles = pgTable("forecast_hour_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  dow: smallint("dow").notNull(),
  hour: smallint("hour").notNull(),
  weight: numeric("weight", { precision: 6, scale: 4 }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  venueIdDowHourUnique: uniqueIndex("forecast_hour_profiles_venue_dow_hour_unique").on(table.venueId, table.dow, table.hour),
  orgIdIdx: index("forecast_hour_profiles_org_id_idx").on(table.orgId),
}))

// Type exports for Forecasting module
export type SalesForecast = typeof salesForecasts.$inferSelect
export type NewSalesForecast = typeof salesForecasts.$inferInsert

export type ForecastHourProfile = typeof forecastHourProfiles.$inferSelect
export type NewForecastHourProfile = typeof forecastHourProfiles.$inferInsert

// Labour Rules table - Per venue/role staffing rules for planning
export const labourRules = pgTable("labour_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  role: text("role").notNull(), // e.g., "FOH", "BOH", "Barista"
  metric: text("metric").notNull().default("orders"), // "orders" | "revenue"
  perStaffPerHour: numeric("per_staff_per_hour", { precision: 10, scale: 2 }).notNull(), // e.g., 25 orders/hr per FOH
  minShiftMinutes: integer("min_shift_minutes").notNull().default(240),
  maxShiftMinutes: integer("max_shift_minutes").notNull().default(480),
  openHour: smallint("open_hour").notNull().default(9), // 0..23
  closeHour: smallint("close_hour").notNull().default(22), // 0..23
  daysMask: smallint("days_mask").notNull().default(127), // bitmask 0b1111111 (Sun..Sat)
  targetLabourPct: numeric("target_labour_pct", { precision: 5, scale: 2 }).default("22.0"),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  venueRoleIdx: index("labour_rules_venue_role_idx").on(table.venueId, table.role),
  orgIdIdx: index("labour_rules_org_id_idx").on(table.orgId),
}))

// Roster Suggestions table - Aggregated shift blocks before import
export const rosterSuggestions = pgTable("roster_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  weekStart: date("week_start", { mode: "date" }).notNull(),
  role: text("role").notNull(),
  startAt: timestamp("start_at", { mode: "date", withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { mode: "date", withTimezone: true }).notNull(),
  headcount: integer("headcount").notNull().default(1),
  generatedAt: timestamp("generated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  venueWeekIdx: index("roster_suggestions_venue_week_idx").on(table.venueId, table.weekStart),
  orgIdIdx: index("roster_suggestions_org_id_idx").on(table.orgId),
}))

// Type exports for Labour Planning module
export type LabourRule = typeof labourRules.$inferSelect
export type NewLabourRule = typeof labourRules.$inferInsert

export type RosterSuggestion = typeof rosterSuggestions.$inferSelect
export type NewRosterSuggestion = typeof rosterSuggestions.$inferInsert

// Operations Suggestions table - AI-generated actionable suggestions for managers
export const opsSuggestions = pgTable("ops_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  type: varchar("type", { length: 32 }).notNull(), // PRICE_NUDGE | ORDER_SHORTFALL | LABOUR_TRIM | LABOUR_ADD
  status: varchar("status", { length: 16 }).notNull().default("NEW"), // NEW | APPROVED | IGNORED
  title: varchar("title", { length: 256 }).notNull(),
  reason: varchar("reason", { length: 512 }),
  impact: varchar("impact", { length: 128 }),
  payload: jsonb("payload").notNull(), // typed per type
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { mode: "date", withTimezone: true }),
}, (table) => ({
  venueStatusIdx: index("ops_suggestions_venue_status_idx").on(table.venueId, table.status),
  orgIdIdx: index("ops_suggestions_org_id_idx").on(table.orgId),
}))

// Type exports for Operations Suggestions
export type OpsSuggestion = typeof opsSuggestions.$inferSelect
export type NewOpsSuggestion = typeof opsSuggestions.$inferInsert

// Count Sessions table - Stock count workflow sessions
export const countSessions = pgTable("count_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  name: varchar("name", { length: 128 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("DRAFT"), // DRAFT | SUBMITTED | APPROVED | POSTED
  startAt: timestamp("start_at", { mode: "date", withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { mode: "date", withTimezone: true }).notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  submittedAt: timestamp("submitted_at", { mode: "date", withTimezone: true }),
  approvedAt: timestamp("approved_at", { mode: "date", withTimezone: true }),
  postedAt: timestamp("posted_at", { mode: "date", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgVenueStatusStartIdx: index("count_sessions_org_venue_status_start_idx").on(table.orgId, table.venueId, table.status, table.startAt),
}))

// Count Lines table - Individual ingredient counts within a session
export const countLines = pgTable("count_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => countSessions.id, { onDelete: "cascade" }),
  ingredientId: uuid("ingredient_id").notNull().references(() => ingredients.id),
  ingredientName: varchar("ingredient_name", { length: 256 }).notNull(),
  baseUom: varchar("base_uom", { length: 8 }).notNull(), // g | ml | each
  onHandBeforeBase: integer("on_hand_before_base").notNull().default(0),
  theoreticalUsedBase: integer("theoretical_used_base").notNull().default(0),
  countedBase: integer("counted_base").notNull().default(0),
  varianceBase: integer("variance_base").notNull().default(0),
  notes: varchar("notes", { length: 512 }),
}, (table) => ({
  sessionIngredientIdx: index("count_lines_session_ingredient_idx").on(table.sessionId, table.ingredientId),
}))

// Waste Events table - Logged waste/spoilage events
export const wasteEvents = pgTable("waste_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  date: date("date", { mode: "date" }).notNull(),
  ingredientId: uuid("ingredient_id").notNull().references(() => ingredients.id),
  qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
  unit: varchar("unit", { length: 8 }).notNull(), // g | kg | ml | l | each
  reason: varchar("reason", { length: 32 }).notNull(), // prep | spoilage | overportion | transfer | theft | other
  note: varchar("note", { length: 512 }),
  unitCostCentsSnapshot: integer("unit_cost_cents_snapshot"),
  qtyBase: integer("qty_base").notNull(),
  occurredAt: timestamp("occurred_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  notes: varchar("notes", { length: 256 }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  venueIdDateIdx: index("waste_events_venue_date_idx").on(table.venueId, table.date),
  venueIngredientDateIdx: index("waste_events_venue_ing_date_idx").on(table.venueId, table.ingredientId, table.date),
  orgVenueIngredientOccurredIdx: index("waste_events_org_venue_ing_occurred_idx").on(table.orgId, table.venueId, table.ingredientId, table.occurredAt),
}))

// Type exports for Stock Counts & Waste module
export type CountSession = typeof countSessions.$inferSelect
export type NewCountSession = typeof countSessions.$inferInsert

export type CountLine = typeof countLines.$inferSelect
export type NewCountLine = typeof countLines.$inferInsert

export type WasteEvent = typeof wasteEvents.$inferSelect
export type NewWasteEvent = typeof wasteEvents.$inferInsert

// Imports Log table - Track CSV import history
export const importsLog = pgTable("imports_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organisations.id),
  venueId: uuid("venue_id").references(() => venues.id),
  importType: varchar("import_type", { length: 32 }).notNull(), // sales | ingredients | menu | staff
  fileName: varchar("file_name", { length: 256 }).notNull(),
  status: varchar("status", { length: 16 }).notNull(), // success | error | partial
  rowsProcessed: integer("rows_processed").notNull().default(0),
  rowsInserted: integer("rows_inserted").notNull().default(0),
  rowsUpdated: integer("rows_updated").notNull().default(0),
  rowsSkipped: integer("rows_skipped").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  errorDetails: jsonb("error_details").$type<ImportError[]>(),
  importedBy: uuid("imported_by").notNull().references(() => users.id),
  importedAt: timestamp("imported_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orgTypeImportedAtIdx: index("imports_log_org_type_imported_at_idx").on(table.orgId, table.importType, table.importedAt),
}))

export type ImportsLog = typeof importsLog.$inferSelect
export type NewImportsLog = typeof importsLog.$inferInsert

// Organisation Settings - Default settings for entire organisation
export const organisationSettings = pgTable("organisation_settings", {
  orgId: uuid("org_id").primaryKey().references(() => organisations.id),
  timezone: varchar("timezone", { length: 64 }).notNull().default("Australia/Melbourne"),
  targetCogsPct: integer("target_cogs_pct").notNull().default(35),     // whole %
  targetLabourPct: integer("target_labour_pct").notNull().default(22), // whole %
  weekStartsOn: integer("week_starts_on").notNull().default(1),        // 1 = Monday
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
})

export type OrganisationSettings = typeof organisationSettings.$inferSelect
export type NewOrganisationSettings = typeof organisationSettings.$inferInsert

// Venue Settings - Venue-specific overrides
export const venueSettings = pgTable("venue_settings", {
  venueId: uuid("venue_id").primaryKey().references(() => venues.id),
  timezone: varchar("timezone", { length: 64 }),
  displayName: varchar("display_name", { length: 128 }),
  safetyStockDays: integer("safety_stock_days"),
  defaultOrderWindowDays: integer("default_order_window_days"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
})

export type VenueSettings = typeof venueSettings.$inferSelect
export type NewVenueSettings = typeof venueSettings.$inferInsert

// Business Hours - Opening hours per day-of-week (0=Sun..6=Sat)
export const businessHours = pgTable("business_hours", {
  id: uuid("id").defaultRandom().primaryKey(),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  dow: integer("dow").notNull(), // 0=Sunday, 1=Monday ... 6=Saturday
  openMinute: integer("open_minute").notNull(),   // minutes from midnight
  closeMinute: integer("close_minute").notNull(), // minutes from midnight
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  venueDowIdx: index("idx_hours_venue_dow").on(table.venueId, table.dow),
}))

export type BusinessHours = typeof businessHours.$inferSelect
export type NewBusinessHours = typeof businessHours.$inferInsert

// Demand Overrides - Manual demand multipliers for known events
export const demandOverrides = pgTable("demand_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  startsAt: timestamp("starts_at", { mode: "date", withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { mode: "date", withTimezone: true }).notNull(),
  multiplier: numeric("multiplier", { precision: 5, scale: 2 }).notNull(), // e.g., 1.15 for +15%
  reason: text("reason"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  venueStartsEndsIdx: index("demand_overrides_venue_starts_ends_idx").on(table.venueId, table.startsAt, table.endsAt),
}))

export type DemandOverride = typeof demandOverrides.$inferSelect
export type NewDemandOverride = typeof demandOverrides.$inferInsert

// Holidays - Public holidays and special days affecting demand
export const holidays = pgTable("holidays", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  date: date("date").notNull(),
  name: text("name").notNull(),
  region: text("region"), // e.g., AU-VIC
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  venueDateUnique: uniqueIndex("holidays_venue_date_unique").on(table.venueId, table.date),
}))

export type Holiday = typeof holidays.$inferSelect
export type NewHoliday = typeof holidays.$inferInsert

// Import Jobs - Track wizard-based CSV imports (multi-step workflow)
export const importJobs = pgTable("import_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  venueId: uuid("venue_id").notNull().references(() => venues.id),
  type: varchar("type", { length: 32 }).notNull(), // ingredients | menu_items | recipes | staff | sales | stock
  status: varchar("status", { length: 16 }).notNull(), // uploaded | mapping | validating | ready | importing | done | failed
  filename: varchar("filename", { length: 256 }).notNull(),
  csvText: text("csv_text"), // Full CSV content for reparsing at commit
  totalRows: integer("total_rows").notNull().default(0),
  errorRows: integer("error_rows").notNull().default(0),
  mapping: jsonb("mapping").$type<Record<string, string>>(), // header → canonical field mapping
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { mode: "date", withTimezone: true }),
}, (table) => ({
  venueTypeCreatedIdx: index("import_jobs_venue_type_created_idx").on(table.venueId, table.type, table.createdAt),
}))

export type ImportJob = typeof importJobs.$inferSelect
export type NewImportJob = typeof importJobs.$inferInsert

// Import Job Rows - Track individual rows in an import job
export const importJobRows = pgTable("import_job_rows", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => importJobs.id, { onDelete: "cascade" }),
  rowNumber: integer("row_number").notNull(),
  dataJson: jsonb("data_json").notNull(), // Original CSV row data
  status: varchar("status", { length: 16 }).notNull(), // pending | ok | error | skipped | created | updated
  message: text("message"), // Error/status message
}, (table) => ({
  jobRowIdx: index("import_job_rows_job_row_idx").on(table.jobId, table.rowNumber),
}))

export type ImportJobRow = typeof importJobRows.$inferSelect
export type NewImportJobRow = typeof importJobRows.$inferInsert
