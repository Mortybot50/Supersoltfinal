// ============================================
// CORE ENTITIES
// ============================================

export interface Organization {
  id: string
  name: string
  abn?: string
  timezone: string
  currency_code: string
  week_starts_on: 'Monday' | 'Sunday'
  gst_rate_percent: number
  price_display_mode: 'INC_GST' | 'EX_GST'
  default_gp_target_percent: number
  financial_year_start_month: number // 1-12, default 7 (July for AU)
  default_trading_hours?: Record<string, { open: string; close: string }>
  default_award_level?: string
  payroll_cycle: 'weekly' | 'fortnightly' | 'monthly'
  created_at: Date
  updated_at: Date
}

export interface OrgBranding {
  org_id: string
  logo_url?: string
  brand_color_hex: string
  receipt_footer_text?: string
  menu_print_header?: string
  created_at: Date
  updated_at: Date
}

export interface OrgMenuDefaults {
  org_id: string
  menu_sections: MenuSection[]
  default_allergen_list: string[]
  price_endings: '.00' | '.50' | '.90' | '.95' | '.99'
  rounding_mode: 'NEAREST' | 'UP' | 'DOWN'
  default_gst_mode_items: 'INC' | 'EX'
  created_at: Date
  updated_at: Date
}

export interface OrgApprovals {
  org_id: string
  price_change_max_percent_no_approval: number
  roster_over_budget_percent_requires_owner: number
  po_amount_over_requires_owner: number
  below_gp_threshold_alert_percent: number
  enable_ai_suggestions: boolean
  require_reason_on_override: boolean
  created_at: Date
  updated_at: Date
}

export interface OrgHolidays {
  org_id: string
  state: 'VIC' | 'NSW' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'NT' | 'ACT'
  use_au_public_holidays: boolean
  custom_closed_dates: string[]
  created_at: Date
  updated_at: Date
}

export interface OrgExportMappings {
  org_id: string
  pos_provider: 'Square' | 'Lightspeed' | 'Kounta' | 'Other'
  default_tax_code: string
  csv_columns: string[]
  accounting_price_inc_gst: boolean
  created_at: Date
  updated_at: Date
}

export interface OrgSecurity {
  org_id: string
  pii_redaction_on_exports: boolean
  document_retention_months: number
  allow_crew_view_costs: boolean
  created_at: Date
  updated_at: Date
}

export interface OrgAuditLog {
  id: string
  org_id: string
  actor_user_id: string
  actor_name: string
  action: string
  before_snapshot: Record<string, unknown> | null
  after_snapshot: Record<string, unknown> | null
  created_at: Date
}

export const DEFAULT_ORG_SETTINGS = {
  timezone: 'Australia/Melbourne',
  currency_code: 'AUD',
  week_starts_on: 'Monday' as const,
  gst_rate_percent: 10,
  price_display_mode: 'INC_GST' as const,
  default_gp_target_percent: 65,
  financial_year_start_month: 7,
  payroll_cycle: 'fortnightly' as const,
}

// Australian Business Number validation
export function validateABN(abn: string): boolean {
  const cleaned = abn.replace(/\s/g, '')
  if (!/^\d{11}$/.test(cleaned)) return false
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
  const digits = cleaned.split('').map(Number)
  digits[0] -= 1
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0)
  return sum % 89 === 0
}

export function formatABN(abn: string): string {
  const cleaned = abn.replace(/\s/g, '')
  if (cleaned.length <= 2) return cleaned
  if (cleaned.length <= 5) return `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`
  if (cleaned.length <= 8) return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5)}`
  return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 11)}`
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export const DEFAULT_BRANDING = {
  brand_color_hex: '#6C5CE7',
}

export const DEFAULT_MENU_SECTIONS: MenuSection[] = [
  { id: 'entrees', name: 'Entrees', is_drinks: false, display_order: 0, organization_id: '', tax_mode: 'FOLLOW_ITEM', created_at: new Date(), updated_at: new Date() },
  { id: 'mains', name: 'Mains', is_drinks: false, display_order: 1, organization_id: '', tax_mode: 'FOLLOW_ITEM', created_at: new Date(), updated_at: new Date() },
  { id: 'sides', name: 'Sides', is_drinks: false, display_order: 2, organization_id: '', tax_mode: 'FOLLOW_ITEM', created_at: new Date(), updated_at: new Date() },
  { id: 'desserts', name: 'Desserts', is_drinks: false, display_order: 3, organization_id: '', tax_mode: 'FOLLOW_ITEM', created_at: new Date(), updated_at: new Date() },
  { id: 'drinks', name: 'Drinks', is_drinks: true, display_order: 4, organization_id: '', tax_mode: 'FOLLOW_ITEM', created_at: new Date(), updated_at: new Date() },
]

export const FSANZ_ALLERGENS = [
  'Gluten (Wheat, Rye, Barley, Oats)',
  'Milk',
  'Eggs',
  'Peanuts',
  'Tree Nuts',
  'Sesame Seeds',
  'Soybeans',
  'Fish',
  'Crustaceans',
  'Molluscs',
  'Sulphites',
  'Lupin',
]

export const DEFAULT_CSV_COLUMNS = [
  'section_name',
  'item_name',
  'plu_code',
  'price_inc_gst',
  'price_ex_gst',
  'gst_rate_percent',
  'gst_mode',
  'recipe_id',
]

export const AU_STATES = [
  { value: 'VIC', label: 'Victoria' },
  { value: 'NSW', label: 'New South Wales' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'SA', label: 'South Australia' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'NT', label: 'Northern Territory' },
  { value: 'ACT', label: 'Australian Capital Territory' },
]

export const AU_TIMEZONES = [
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
  { value: 'Australia/Adelaide', label: 'Adelaide (ACST/ACDT)' },
  { value: 'Australia/Perth', label: 'Perth (AWST)' },
  { value: 'Australia/Darwin', label: 'Darwin (ACST)' },
  { value: 'Australia/Hobart', label: 'Hobart (AEST/AEDT)' },
]

export interface Venue {
  id: string
  organization_id: string
  name: string
  location_type: 'cafe' | 'restaurant' | 'kiosk' | 'bar'
  address: string
  timezone: string
  active: boolean
}

export interface User {
  id: string
  organization_id: string
  email: string
  name: string
  role: 'owner' | 'manager' | 'supervisor' | 'crew'
  active: boolean
}

// ============================================
// SALES & ORDERS
// ============================================

export interface Order {
  id: string
  order_number: string
  venue_id: string
  order_datetime: Date
  channel: 'dine-in' | 'takeaway' | 'delivery' | 'online'
  
  gross_amount: number
  tax_amount: number
  discount_amount: number
  service_charge: number
  tip_amount: number
  net_amount: number
  
  is_void: boolean
  is_refund: boolean
  refund_reason?: string
  
  customer_id?: string
  staff_id?: string
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string
  menu_item_name: string
  quantity: number
  unit_price: number
  total_price: number
  menu_category: string
  menu_group: 'food' | 'beverages' | 'other'
}

export interface Tender {
  id: string
  order_id: string
  payment_method: 'card' | 'cash' | 'digital_wallet'
  payment_provider?: string
  amount: number
}

// ============================================
// INVENTORY
// ============================================

export interface Ingredient {
  id: string
  venue_id: string
  name: string
  category: 'produce' | 'meat' | 'seafood' | 'dairy' | 'dry-goods' | 'beverages' | 'other'
  unit: 'kg' | 'g' | 'L' | 'mL' | 'ea'
  
  current_stock: number
  par_level: number
  reorder_point: number // Trigger reorder when stock falls below this
  
  cost_per_unit: number
  last_cost_update: Date
  
  supplier_id?: string
  supplier_name?: string
  product_code?: string // Supplier's product code/SKU
  pack_size?: number // e.g., 1 for single unit, 12 for dozen, 20 for case (legacy)
  gst_applicable?: boolean
  
  // New unit conversion fields
  units_per_pack?: number // Number of units in pack (e.g., 24 for case of 24)
  unit_size?: number // Size of each unit (e.g., 330 for 330mL bottles)
  base_unit?: string // Base unit (g, mL, ea)
  pack_to_base_factor?: number // Total base units in pack (e.g., 7920 for 24×330mL)
  unit_cost_ex_base?: number // Cost per base unit in cents (e.g., 0.2879 cents/mL)
  pack_size_text?: string // Display text (e.g., "24×330mL")

  // Allergens & waste
  allergens?: string[]
  default_waste_percent?: number // Trim/prep waste % (0-100)

  active: boolean
}

export interface IngredientPriceHistory {
  id: string
  ingredient_id: string
  old_cost_cents: number | null
  new_cost_cents: number
  changed_at: string
  changed_by: string | null
  source: 'manual' | 'invoice' | 'import' | 'bulk_update'
}

export interface StockCount {
  id: string
  org_id?: string
  venue_id: string
  count_number: string
  count_date: Date
  count_type: 'full' | 'cycle'
  counted_by_user_id: string
  counted_by_name: string
  status: 'in-progress' | 'completed' | 'reviewed'
  total_variance_value: number
  total_count_value: number
  notes?: string
  items?: StockCountItem[]
}

export interface StockCountItem {
  id: string
  stock_count_id: string
  ingredient_id: string
  ingredient_name: string
  expected_quantity: number
  actual_quantity: number
  variance: number
  variance_value: number
}

export interface WasteEntry {
  id: string
  org_id?: string
  venue_id: string
  waste_date: Date
  waste_time: string
  ingredient_id: string
  ingredient_name: string
  quantity: number
  unit: string
  value: number
  reason: 'spoilage' | 'expired' | 'overproduction' | 'breakage' | 'staff_meal' | 'promo' | 'theft_unknown' | 'spillage' | 'prep-waste' | 'over-production' | 'damaged' | 'other'
  notes?: string
  recorded_by_user_id: string
  recorded_by_name: string
}

export interface PurchaseOrder {
  org_id?: string
  id: string
  po_number: string
  venue_id: string
  supplier_id: string
  supplier_name: string
  order_date: Date
  expected_delivery_date: Date
  status: 'draft' | 'submitted' | 'confirmed' | 'delivered' | 'cancelled'
  subtotal: number
  tax_amount: number
  total: number
  items?: PurchaseOrderItem[]
  notes?: string
  created_by?: string
  created_by_name?: string
  submitted_at?: Date
  submitted_by?: string
  confirmed_at?: Date
  delivered_at?: Date
  cancelled_at?: Date
  cancellation_reason?: string
  created_at?: Date
  updated_at?: Date
  received_by_name?: string
}

export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  ingredient_id: string
  ingredient_name: string
  product_code?: string
  quantity_ordered: number
  quantity_received: number
  unit: string
  unit_cost: number
  line_total: number
  notes?: string
}

export interface Supplier {
  id: string
  organization_id: string
  name: string
  contact_person?: string
  email?: string
  phone?: string
  address?: string
  suburb?: string
  state?: string
  postcode?: string
  abn?: string // Australian Business Number (11 digits)
  is_gst_registered?: boolean
  category: 'produce' | 'meat' | 'dry-goods' | 'beverages' | 'equipment' | 'other'
  payment_terms: 'net-7' | 'net-14' | 'net-30' | 'net-60' | 'cod'
  account_number?: string
  order_method?: 'email' | 'phone' | 'online_portal' | 'rep_visit'
  delivery_days: number[] // Array of day numbers (0=Sunday, 1=Monday, etc.)
  cutoff_time: string // HH:MM format (24hr)
  delivery_lead_days: number // Days between order and delivery
  minimum_order?: number // Minimum order value in cents
  notes?: string
  active: boolean
}

// ============================================
// MENU & RECIPES
// ============================================

export interface MenuItem {
  id: string
  venue_id: string
  name: string
  description?: string
  category: string
  menu_group: 'food' | 'beverages' | 'other'
  
  selling_price: number
  cost_price: number
  margin_percent: number
  
  active: boolean
  launch_date?: Date
}

export interface Recipe {
  id: string
  organization_id: string
  name: string
  category: 'mains' | 'sides' | 'drinks' | 'desserts' | 'prep' | 'other'
  serves: number // Number of portions (min > 0)
  wastage_percent: number // 0-100, default 0
  gp_target_percent: number // Gross profit target % (default 65)
  instructions?: string // Long text instructions
  steps: string[] // Ordered step-by-step instructions
  allergens: string[] // List of allergens
  status: 'draft' | 'published' | 'archived'
  
  // Calculated fields (auto-computed)
  total_cost: number // Sum of all ingredient line costs (in cents)
  cost_per_serve: number // total_cost / serves (in cents)
  suggested_price: number // Based on GP target (in cents)
  
  created_by: string
  created_by_name?: string
  created_at: Date
  updated_at: Date
  published_at?: Date
  archived_at?: Date
}

export interface RecipeIngredient {
  id: string
  recipe_id: string
  product_id: string // Links to Ingredient or sub-recipe
  product_name: string // Denormalized for display
  quantity: number // Amount needed
  unit: 'g' | 'kg' | 'mL' | 'L' | 'ea'

  // Calculated fields
  cost_per_unit: number // Cost per selected unit (in cents) - DEPRECATED, use unit_cost_ex_base
  line_cost: number // quantity × unit_cost_ex_base (in cents)
  unit_cost_ex_base?: number // Cost per base unit from ingredient (cents per g/mL/ea)

  // Reference data (from Ingredient)
  product_unit: string // Original unit from ingredient
  product_cost: number // Original cost per unit from ingredient (pack cost)

  // Sub-recipe support
  is_sub_recipe?: boolean
  sub_recipe_id?: string // When is_sub_recipe=true, points to recipe.id
  sort_order?: number
}

// Common Australian allergens (FSANZ)
export const COMMON_ALLERGENS = [
  'Gluten (Wheat, Rye, Barley, Oats)',
  'Crustaceans',
  'Eggs',
  'Fish',
  'Milk',
  'Peanuts',
  'Tree Nuts',
  'Soybeans',
  'Sesame Seeds',
  'Lupin',
  'Molluscs',
  'Sulphites',
]

// ============================================
// MENU MANAGEMENT
// ============================================

export interface MenuSection {
  id: string
  organization_id: string
  name: string // "Entrees", "Mains", "Desserts", "Drinks", etc.
  display_order: number
  is_drinks: boolean // Special handling for drinks section
  tax_mode: 'GST_INC' | 'GST_EX' | 'FOLLOW_ITEM' // Default tax handling
  created_at: Date
  updated_at: Date
  
  // Computed aggregations
  items_count?: number
  section_revenue?: number // Ex-GST (in cents)
  section_cogs?: number // Cost of goods sold (in cents)
  section_gp_percent?: number // Gross profit %
}

export interface MenuItem {
  id: string
  organization_id: string
  section_id: string
  name: string
  recipe_id: string // Must link to published recipe
  recipe_name?: string // Denormalized for display
  plu_code?: string // PLU code for POS
  
  // Pricing
  price_mode: 'AUTO_FROM_RECIPE' | 'MANUAL'
  price: number // In cents (manual price or override)
  gst_mode: 'INC' | 'EX' // GST inclusive or exclusive
  gst_rate_percent: number // Default 10 for AU
  
  // Display
  show_on_menu: boolean
  tags: string[] // 'vegan', 'gf', 'spicy', etc.
  allergens: string[] // Copied from recipe, editable
  display_order: number
  
  // Drinks specific
  abv_percent?: number // Alcohol by volume
  volume_ml?: number // Serving size in ml
  std_drinks?: number // Standard drinks (calculated)
  
  // Costing (from recipe)
  cost_per_serve: number // In cents (from linked recipe)
  gp_target_percent: number // Target GP% (from recipe or override)
  
  // Calculated fields
  effective_price?: number // Auto from recipe or manual (in cents)
  price_ex_gst?: number // Price excluding GST (in cents)
  gst_amount?: number // GST component (in cents)
  gp_percent?: number // Actual GP%
  
  created_at: Date
  updated_at: Date
}

export interface MenuAnalytics {
  total_items: number
  total_sections: number
  menu_revenue: number // Total ex-GST (in cents)
  menu_cogs: number // Total COGS (in cents)
  menu_gp_percent: number // Overall GP%
  warnings: MenuWarning[]
}

export interface MenuWarning {
  type: 'low_gp' | 'missing_plu' | 'price_below_cost' | 'unpublished_recipe'
  severity: 'error' | 'warning'
  item_id: string
  item_name: string
  message: string
}

export const COMMON_MENU_TAGS = [
  'Vegetarian',
  'Vegan',
  'Gluten Free',
  'Dairy Free',
  'Nut Free',
  'Spicy',
  'Chef Special',
  'Popular',
  'New',
  'Signature',
  'Seasonal',
]

// ============================================
// WORKFORCE
// ============================================

export interface Staff {
  id: string
  organization_id: string
  venue_id: string
  
  name: string
  email: string
  phone?: string
  
  role: 'manager' | 'supervisor' | 'crew'
  employment_type?: 'full-time' | 'part-time' | 'casual'
  award_classification?: string
  hourly_rate: number  // cents
  start_date: Date
  status: 'active' | 'inactive'
  
  // Onboarding
  onboarding_status: 'not_started' | 'invited' | 'in_progress' | 'pending_review' | 'roster_ready'
  onboarding_progress: number  // 0-100
  onboarding_completed_at?: Date
  
  // Personal Details
  date_of_birth?: Date
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_relationship?: string
  address_line1?: string
  address_line2?: string
  suburb?: string
  state?: string
  postcode?: string
  
  // TFN
  tfn_number?: string
  tfn_exemption: boolean
  tfn_claimed_tax_free_threshold: boolean
  tfn_has_help_debt: boolean
  tfn_has_tsl_debt: boolean
  tfn_tax_offset_claimed: boolean
  tfn_signature?: string
  tfn_signed_at?: Date
  
  // Bank
  bank_account_name?: string
  bank_bsb?: string
  bank_account_number?: string
  bank_institution_name?: string
  
  // Super
  super_fund_name?: string
  super_fund_abn?: string
  super_fund_usi?: string
  super_member_number?: string
  super_use_employer_default: boolean
  super_signed_at?: Date
  
  external_payroll_id?: string
  created_at?: Date
}

export interface OnboardingInvite {
  id: string
  staff_id: string
  token: string
  sent_to_email: string
  sent_at: Date
  expires_at: Date
  accessed_at?: Date
  completed_at?: Date
}

export interface OnboardingStep {
  id: string
  staff_id: string
  step_number: number
  step_name: string
  status: 'not_started' | 'in_progress' | 'completed'
  completed_at?: Date
}

export interface OnboardingDocument {
  id: string
  staff_id: string
  document_type: 'id_proof' | 'tfn_declaration' | 'super_choice' | 'rsa_rsg' | 'food_safety' | 'first_aid'
  file_name: string
  file_url: string
  file_size: number
  mime_type: string
  status: 'pending' | 'approved' | 'rejected'
  uploaded_at: Date
  uploaded_by?: string
  reviewed_by?: string
  reviewed_at?: Date
}

export interface Shift {
  id: string
  venue_id: string
  staff_id: string
  staff_name: string

  date: Date
  start_time: string
  end_time: string
  break_minutes: number

  role: string
  notes?: string

  // Status & type
  status?: 'scheduled' | 'confirmed' | 'modified' | 'in-progress' | 'completed' | 'cancelled'
  is_open_shift?: boolean // Unassigned shift staff can claim

  // Cost calculation
  total_hours: number
  base_cost: number // Base hourly rate cost (cents)
  penalty_cost: number // Additional penalty rate cost (cents)
  total_cost: number // base_cost + penalty_cost (cents)

  // Penalty rate breakdown
  penalty_type?: 'none' | 'saturday' | 'sunday' | 'public_holiday' | 'late_night' | 'early_morning' | 'evening'
  penalty_multiplier?: number // e.g., 1.25 for Saturday, 1.5 for Sunday

  // Warnings from penalty rate engine
  warnings?: string[]

  // Template reference
  template_id?: string
}

export interface Timesheet {
  id: string
  venue_id: string
  staff_id: string
  staff_name: string
  
  date: Date
  clock_in: Date
  clock_out?: Date
  break_minutes: number
  
  total_hours: number
  gross_pay: number
  
  status: 'pending' | 'approved' | 'rejected'
  notes?: string
}

// ============================================
// FORECASTS & TARGETS
// ============================================

export interface Forecast {
  id: string
  venue_id: string
  date: Date
  channel: string
  forecast_sales: number
  confidence_lower: number
  confidence_upper: number
}

export interface Target {
  id: string
  venue_id: string
  date: Date
  channel: string
  target_sales: number
  target_type: 'budget' | 'goal' | 'stretch'
}

// ============================================
// CALCULATED METRICS (NOT STORED)
// ============================================

export interface SalesMetrics {
  net_sales: number
  gross_sales: number
  total_tax: number
  avg_check: number
  total_orders: number
  total_items: number
  items_per_order: number
  
  variance_vs_previous: {
    absolute: number
    percentage: number | null
  }
  
  variance_vs_forecast: {
    absolute: number
    percentage: number | null
  }
}

export interface PacingMetrics {
  actual_to_date: number
  target_to_date: number
  pacing_percent: number
  projected_finish: number
  target_total: number
  on_track: boolean
}

export interface RefundMetrics {
  refund_count: number
  refund_rate_percent: number
  refund_value: number
  refund_value_percent: number
  void_count: number
  void_rate_percent: number
}

export interface ChannelMetrics {
  channel: string
  sales: number
  orders: number
  avg_check: number
  share_pct: number
}

export interface PaymentMix {
  payment_method: string
  amount: number
  transaction_count: number
  share_pct: number
  avg_transaction: number
}

export interface LabourMetrics {
  total_hours: number
  total_cost: number
  labour_percent: number
  avg_hourly_rate: number
  staff_count: number
  cost_vs_sales: number
}

export interface InventoryMetrics {
  total_stock_value: number
  items_below_par: number
  items_to_order: number
  total_waste_value: number
  stock_turnover_days: number
}

export interface COGSMetrics {
  total_cogs: number
  cogs_percent: number
  theoretical_cogs: number
  actual_cogs: number
  variance: number
  variance_percent: number
}

export interface DateRangeFilter {
  startDate: Date
  endDate: Date
}

export interface VenueFilter {
  venueIds: string[]
}

export interface GeneralFilters {
  dateRange?: DateRangeFilter
  venues?: string[]
  channels?: string[]
  categories?: string[]
  staff?: string[]
}

// Order Guide Recommendation
export interface OrderRecommendation {
  product: Ingredient
  current_stock: number
  par_level: number
  usage_per_thousand_sales: number // e.g., 2.5 kg per $1000 sales
  forecasted_sales: number // in dollars
  estimated_usage: number // based on forecast
  days_until_delivery: number
  recommended_quantity: number
  estimated_cost: number // in cents
  urgency: 'critical' | 'low' | 'adequate' | 'overstocked'
}

// Inventory Transaction (for tracking usage)
export interface InventoryTransaction {
  id: string
  organization_id: string
  product_id: string
  transaction_type: 'purchase' | 'usage' | 'waste' | 'adjustment' | 'transfer'
  quantity: number // Positive for additions, negative for usage
  unit_cost?: number // Cost at time of transaction (in cents)
  transaction_date: Date
  reference_id?: string // Link to PO, waste log, etc.
  notes?: string
  created_by: string
  created_at: Date
}

// Renamed types for consistency
export type WasteLog = WasteEntry
export type RosterShift = Shift
export type RecipeItem = RecipeIngredient

// Additional types for comprehensive coverage
export interface BankAccount {
  id: string
  organization_id: string
  account_name: string
  bsb: string
  account_number: string
  current_balance: number
  institution: string
  account_type: 'operating' | 'savings' | 'credit'
  active: boolean
  created_at: Date
}

export interface CashFlowObligation {
  id: string
  organization_id: string
  description: string
  obligation_type: 'payroll' | 'superannuation' | 'bas-gst' | 'bas-paye' | 'rent' | 'utilities' | 'supplier' | 'other'
  amount: number
  due_date: Date
  status: 'upcoming' | 'paid' | 'overdue'
  recurrence: 'once' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annual'
  notes?: string
  created_at: Date
}

export interface BudgetLine {
  id: string
  organization_id: string
  venue_id?: string
  category: 'sales' | 'cogs' | 'labour' | 'expenses'
  subcategory: string
  period_type: 'daily' | 'weekly' | 'monthly'
  period_start: Date
  budgeted_amount: number
  actual_amount?: number
  variance?: number
  variance_percent?: number
  notes?: string
  created_at: Date
}

export interface DaybookEntry {
  id: string
  venue_id: string
  entry_date: Date
  entry_time: string
  category: 'incident' | 'maintenance' | 'delivery' | 'observation' | 'task' | 'other'
  description: string
  priority: 'low' | 'medium' | 'high'
  status: 'open' | 'in-progress' | 'resolved'
  assigned_to?: string
  resolved_at?: Date
  resolution_notes?: string
  created_by: string
  created_at: Date
}

export interface ComplianceCheck {
  id: string
  organization_id: string
  venue_id: string
  check_type: 'fairwork' | 'food-safety' | 'whs' | 'licensing' | 'other'
  check_name: string
  check_date: Date
  status: 'pass' | 'fail' | 'warning'
  findings?: string
  corrective_actions?: string
  due_date?: Date
  completed: boolean
  completed_by?: string
  created_at: Date
}

export interface AutomationRule {
  id: string
  organization_id: string
  rule_name: string
  rule_type: 'auto-order' | 'price-alert' | 'roster-alert' | 'compliance-reminder' | 'other'
  trigger_condition: string
  action: string
  active: boolean
  last_triggered?: Date
  created_at: Date
}

// ============================================
// INVOICE OCR TYPES
// ============================================
// DIAGNOSTICS TYPES
// ============================================

export type DiagnosticsJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'partial'
export type DiagnosticsSeverity = 'fail' | 'warn' | 'info' | 'pass'
export type DiagnosticsCategory = 'settings' | 'suppliers' | 'catalog' | 'ingredients' | 'recipes' | 'menu' | 'locations' | 'rbac' | 'intake'

export interface DiagnosticsJob {
  id: string
  org_id: string
  venue_id?: string
  started_by_user_id: string
  status: DiagnosticsJobStatus
  started_at: Date
  finished_at?: Date
  summary_json: { total: number; fail: number; warn: number; info: number; pass: number }
  created_at: Date
}

export interface DiagnosticsResult {
  id: string
  job_id: string
  category: DiagnosticsCategory
  check_id: string
  title: string
  severity: DiagnosticsSeverity
  detail: string
  evidence: { count?: number; ids?: string[]; rows?: Array<Record<string, unknown>>; message?: string }
  quick_fix_available: boolean
  quick_fix_action?: string
  quick_fix_url?: string
  created_at: Date
}

// ============================================
// INVOICE OCR TYPES
// ============================================

export type InvoiceIntakeStatus = 'queued' | 'parsing' | 'needs_review' | 'approved' | 'rejected' | 'failed'
export type InvoiceIntakeSource = 'UPLOAD' | 'EMAIL' | 'EDI' | 'PEPPOL' | 'MANUAL'
export type MatchType = 'exact' | 'alias' | 'fuzzy' | 'new_item'
export type GSTMode = 'INC' | 'EX' | 'NONE'

export interface InvoiceIntakeJob {
  id: string
  org_id: string
  venue_id: string
  created_by_user_id: string
  
  // Source & Status
  source: InvoiceIntakeSource
  status: InvoiceIntakeStatus
  
  // File
  file_url: string
  original_filename: string
  
  // Confidence
  supplier_confidence: number  // 0-1
  totals_confidence: number    // 0-1
  
  // Header (parsed from OCR)
  header_json: {
    invoice_number: string
    invoice_date: string  // ISO date
    supplier_name: string
    abn?: string
    supplier_code?: string
    po_number?: string
    gst_mode: GSTMode
    subtotal: number   // dollars
    gst: number        // dollars
    total: number      // dollars
  }
  
  // Lines (parsed from OCR)
  lines_json: Array<{
    line_index: number
    raw_desc: string
    brand?: string
    pack_size_text?: string
    qty: number
    unit_price: number  // dollars
    ext_price: number   // dollars
    gst_code?: string
    confidence: number  // 0-1
  }>
  
  // Mapping (computed after parsing)
  mapping_json: Array<{
    line_index: number
    match_type: MatchType
    ingredient_id?: string
    alias_used?: string
    pack_to_unit_factor?: number  // e.g., 1kg = 1000g
    unit: 'g' | 'kg' | 'ml' | 'L' | 'pcs' | 'ea'
    unit_cost_computed: number  // cents per base unit
  }>
  
  // Duplicate detection
  dedupe_key: string  // format: "{abn}_{invoice_number}_{invoice_date}"
  
  created_at: Date
  updated_at: Date
}

export interface SupplierAlias {
  id: string
  org_id: string
  supplier_id: string
  
  // Alias details
  supplier_sku: string
  supplier_name_at_time: string
  brand?: string
  pack_size_text: string
  uom_base: string  // 'g' | 'ml' | 'ea'
  uom_qty: number
  
  // Link to ingredient
  ingredient_id: string
  
  // Metadata
  confidence_avg: number  // 0-1
  last_seen_at: Date
  created_at: Date
}

export interface InvoiceIntakeReview {
  id: string
  intake_id: string
  reviewer_user_id: string
  status: 'approved' | 'rejected'
  notes?: string
  created_at: Date
}

// ============================================
// ADVANCED ROSTERING TYPES
// ============================================

/**
 * A single shift definition within a template or roster pattern.
 * day_of_week: 0=Sun, 1=Mon, ..., 6=Sat (JS standard)
 */
export interface TemplateShiftDef {
  day_of_week: number
  start_time: string    // HH:MM
  end_time: string      // HH:MM
  break_minutes: number
  role: string
  staff_id: string | null
}

/**
 * Shift Template - Reusable shift patterns
 */
export interface ShiftTemplate {
  id: string
  organization_id: string
  venue_id: string
  name: string // e.g., "Weekend Dinner", "Monday Lunch"
  description?: string

  // Template configuration (single-shift legacy)
  start_time: string // HH:MM
  end_time: string // HH:MM
  break_minutes: number
  role: 'manager' | 'supervisor' | 'crew'
  date?: Date // used when converting time strings to timestamptz

  // When to apply
  days_of_week: number[] // 0=Sun, 1=Mon, etc.

  // Multi-shift definitions (if present, overrides single start/end/role)
  template_shifts?: TemplateShiftDef[]

  // Usage tracking
  usage_count: number
  last_used_at?: Date
  created_at: Date
  updated_at: Date
}

/**
 * Roster Pattern - Named recurring weekly shift configuration.
 * Applied each week to auto-generate shift slots.
 */
export interface RosterPattern {
  id: string
  organization_id: string
  venue_id: string
  name: string
  description?: string
  shifts: TemplateShiftDef[]
  is_active: boolean
  created_at: Date
  updated_at: Date
}

/**
 * Staff Availability - When staff can/can't work
 */
export interface StaffAvailability {
  id: string
  staff_id: string
  venue_id: string

  // Availability type
  type: 'available' | 'unavailable' | 'preferred'

  // Date range or recurring
  is_recurring: boolean
  day_of_week?: number // 0-6 for recurring
  specific_date?: Date // For one-off availability

  // Time range (null = all day)
  start_time?: string // HH:MM
  end_time?: string // HH:MM

  notes?: string
  created_at: Date
  updated_at: Date
}

/**
 * Shift Swap Request - Staff-initiated shift swaps
 */
export interface ShiftSwapRequest {
  id: string
  venue_id: string

  // The shift being swapped
  original_shift_id: string
  original_staff_id: string
  original_staff_name: string

  // Who wants it (null for open swap)
  target_staff_id?: string
  target_staff_name?: string

  // Status workflow
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'

  // Approval tracking
  requested_at: Date
  responded_at?: Date
  responded_by?: string
  rejection_reason?: string

  notes?: string
}

/**
 * Labor Budget - Weekly/monthly labor cost targets
 */
export interface LaborBudget {
  id: string
  venue_id: string

  // Budget period
  period_type: 'weekly' | 'monthly'
  period_start: Date
  period_end: Date

  // Budget amounts (cents)
  budgeted_amount: number
  actual_amount?: number

  // Revenue target for labor % calculation
  revenue_target?: number

  // Thresholds for warnings
  warning_threshold_percent: number // e.g., 90 = warn at 90% of budget
  critical_threshold_percent: number // e.g., 100 = critical at 100%

  notes?: string
  created_at: Date
  updated_at: Date
}

/**
 * Roster Warning - Compliance and scheduling issues
 */
export interface RosterWarning {
  id: string
  shift_id?: string
  staff_id: string
  staff_name: string

  // Warning type
  type:
    | 'overtime_weekly' // >38h/week
    | 'overtime_daily' // >10h/day
    | 'rest_gap' // <10h between shifts
    | 'break_required' // No break scheduled for long shift
    | 'availability_conflict' // Scheduled during unavailable time
    | 'qualification_missing' // Missing required cert (RSA, etc.)
    | 'minor_hours' // Under-18 hour restrictions
    | 'budget_exceeded' // Over labor budget

  severity: 'info' | 'warning' | 'error'
  message: string

  // Additional context
  details?: {
    hours?: number
    limit?: number
    gap_hours?: number
    shift_date?: string
  }

  // Resolution
  acknowledged: boolean
  acknowledged_by?: string
  acknowledged_at?: Date
}

// ============================================
// AUSTRALIAN HOSPITALITY AWARD RATES
// ============================================

/**
 * Hospitality Industry (General) Award 2020 penalty rates
 * Reference: https://www.fairwork.gov.au/employment-conditions/awards/awards-summary/ma000009-summary
 *
 * For permanent (full-time/part-time) employees, the base rate is the ordinary hourly rate.
 * Casual employees already receive a 25% loading on top of the base rate, which covers
 * some weekend/evening loadings. However, Sundays and Public Holidays have separate
 * casual rates.
 */
export const AU_HOSPITALITY_PENALTY_RATES = {
  // Casual loading
  casual_loading: 1.25, // 25% casual loading (built into hourly rate)

  // Day-based penalties — Permanent (full-time / part-time)
  saturday: 1.25,       // 125% of base
  sunday: 1.50,         // 150% of base
  public_holiday: 2.50, // 250% of base

  // Day-based penalties — Casual
  casual_saturday: 1.25,       // Casual loading already covers Saturday (no extra)
  casual_sunday: 1.75,         // 175% of base (not covered by casual loading)
  casual_public_holiday: 2.75, // 275% of base

  // Time-based penalties — Evening (after 7pm weekdays)
  evening: 1.15, // 15% loading for shifts ending/spanning after 7pm on weekdays

  // Legacy aliases
  late_night: 1.15,      // After 7pm weekdays (15% loading)
  early_morning: 1.10,   // Before 7am (10% loading)

  // Overtime rates (full-time only: beyond 38hrs/week or 10hrs/day)
  overtime_first_2_hours: 1.50, // First 2 hours of overtime
  overtime_after_2_hours: 2.00, // After 2 hours of overtime
  overtime_sunday: 2.00,         // Sunday overtime
  overtime_public_holiday: 2.50, // Public holiday overtime

  // Minimum engagement
  minimum_shift_hours_casual: 3,    // Minimum 3-hour shift for casuals
  minimum_shift_hours_part_time: 3, // Minimum 3-hour shift for part-time

  // Break rules
  meal_break_threshold_hours: 5,    // After 5 continuous hours: 30-min unpaid meal break
  meal_break_duration_minutes: 30,
  rest_break_threshold_hours: 4,    // After 4 hours: 10-min paid rest break
  rest_break_duration_minutes: 10,

  // Superannuation (current AU rate)
  super_rate_percent: 11.5, // 11.5% of OTE
} as const

/**
 * Shift cost breakdown — returned by the penalty rate engine
 */
export interface ShiftCostBreakdown {
  base_hours: number
  base_cost_cents: number
  penalty_type: string | null
  penalty_multiplier: number
  penalty_cost_cents: number
  break_deduction_minutes: number
  total_cost_cents: number
  warnings: string[]
}

/**
 * Penalty rate type union
 */
export type PenaltyRateType =
  | 'none'
  | 'saturday'
  | 'sunday'
  | 'public_holiday'
  | 'late_night'
  | 'early_morning'
  | 'evening'
  | 'overtime'

// ============================================
// AUSTRALIAN PUBLIC HOLIDAYS 2024-2026
// ============================================

export const AU_PUBLIC_HOLIDAYS_2024: Record<string, string[]> = {
  national: [
    '2024-01-01', // New Year's Day
    '2024-01-26', // Australia Day
    '2024-03-29', // Good Friday
    '2024-03-30', // Easter Saturday
    '2024-03-31', // Easter Sunday
    '2024-04-01', // Easter Monday
    '2024-04-25', // ANZAC Day
    '2024-06-10', // Queen's Birthday (VIC/most states)
    '2024-12-25', // Christmas Day
    '2024-12-26', // Boxing Day
  ],
  VIC: ['2024-03-12', '2024-11-05'], // Labour Day, Melbourne Cup
  NSW: ['2024-06-10', '2024-08-05'],
  QLD: ['2024-05-06', '2024-08-14'],
  SA: ['2024-03-11', '2024-10-07'],
  WA: ['2024-03-04', '2024-06-03'],
  TAS: ['2024-02-12', '2024-03-11'],
  NT: ['2024-05-06', '2024-08-05'],
  ACT: ['2024-03-11', '2024-05-27'],
}

export const AU_PUBLIC_HOLIDAYS_2025: Record<string, string[]> = {
  national: [
    '2025-01-01', // New Year's Day
    '2025-01-27', // Australia Day (observed — 26th is Sunday)
    '2025-04-18', // Good Friday
    '2025-04-19', // Easter Saturday
    '2025-04-20', // Easter Sunday
    '2025-04-21', // Easter Monday
    '2025-04-25', // ANZAC Day
    '2025-06-09', // Queen's Birthday (VIC)
    '2025-12-25', // Christmas Day
    '2025-12-26', // Boxing Day
  ],
  VIC: ['2025-03-10', '2025-09-26', '2025-11-04'], // Labour Day, AFL Grand Final Fri, Melbourne Cup
  NSW: ['2025-06-09', '2025-08-04'],
  QLD: ['2025-05-05', '2025-08-13'],
  SA: ['2025-03-10', '2025-10-06'],
  WA: ['2025-03-03', '2025-06-02'],
  TAS: ['2025-02-10', '2025-03-10'],
  NT: ['2025-05-05', '2025-08-04'],
  ACT: ['2025-03-10', '2025-05-26'],
}

export const AU_PUBLIC_HOLIDAYS_2026: Record<string, string[]> = {
  national: [
    '2026-01-01', // New Year's Day
    '2026-01-26', // Australia Day
    '2026-04-03', // Good Friday
    '2026-04-04', // Easter Saturday
    '2026-04-05', // Easter Sunday
    '2026-04-06', // Easter Monday
    '2026-04-25', // ANZAC Day (Saturday — observed Monday 27th in some states)
    '2026-06-08', // Queen's Birthday (VIC)
    '2026-12-25', // Christmas Day
    '2026-12-28', // Boxing Day (observed — 26th is Saturday)
  ],
  VIC: ['2026-03-09', '2026-11-03'], // Labour Day, Melbourne Cup
  NSW: ['2026-06-08', '2026-08-03'],
  QLD: ['2026-05-04', '2026-08-12'],
  SA: ['2026-03-09', '2026-10-05'],
  WA: ['2026-03-02', '2026-06-01'],
  TAS: ['2026-02-09', '2026-03-09'],
  NT: ['2026-05-04', '2026-08-03'],
  ACT: ['2026-03-09', '2026-05-25'],
}

/** All holidays combined for lookup */
export const AU_PUBLIC_HOLIDAYS_ALL: Record<string, string[]> = (() => {
  const result: Record<string, string[]> = {}
  for (const yearData of [AU_PUBLIC_HOLIDAYS_2024, AU_PUBLIC_HOLIDAYS_2025, AU_PUBLIC_HOLIDAYS_2026]) {
    for (const [key, dates] of Object.entries(yearData)) {
      if (!result[key]) result[key] = []
      result[key].push(...dates)
    }
  }
  return result
})()

/** Holiday name lookup */
export const AU_HOLIDAY_NAMES: Record<string, string> = {
  // 2024
  '2024-01-01': "New Year's Day", '2024-01-26': 'Australia Day',
  '2024-03-29': 'Good Friday', '2024-03-30': 'Easter Saturday',
  '2024-03-31': 'Easter Sunday', '2024-04-01': 'Easter Monday',
  '2024-04-25': 'ANZAC Day', '2024-06-10': "Queen's Birthday",
  '2024-12-25': 'Christmas Day', '2024-12-26': 'Boxing Day',
  '2024-03-12': 'Labour Day (VIC)', '2024-11-05': 'Melbourne Cup Day',
  // 2025
  '2025-01-01': "New Year's Day", '2025-01-27': 'Australia Day',
  '2025-04-18': 'Good Friday', '2025-04-19': 'Easter Saturday',
  '2025-04-20': 'Easter Sunday', '2025-04-21': 'Easter Monday',
  '2025-04-25': 'ANZAC Day', '2025-06-09': "Queen's Birthday",
  '2025-12-25': 'Christmas Day', '2025-12-26': 'Boxing Day',
  '2025-03-10': 'Labour Day (VIC)', '2025-09-26': 'AFL Grand Final Friday',
  '2025-11-04': 'Melbourne Cup Day',
  // 2026
  '2026-01-01': "New Year's Day", '2026-01-26': 'Australia Day',
  '2026-04-03': 'Good Friday', '2026-04-04': 'Easter Saturday',
  '2026-04-05': 'Easter Sunday', '2026-04-06': 'Easter Monday',
  '2026-04-25': 'ANZAC Day', '2026-06-08': "Queen's Birthday",
  '2026-12-25': 'Christmas Day', '2026-12-28': 'Boxing Day (observed)',
  '2026-03-09': 'Labour Day (VIC)', '2026-11-03': 'Melbourne Cup Day',
}

// ============================================
// ROSTER VIEW TYPES
// ============================================

export type RosterViewMode = 'day' | 'week' | 'fortnight' | 'month'
export type RosterDisplayMode = 'staff' | 'stacked'
export type RosterGroupBy = 'none' | 'team' | 'position'

export interface HourlyStaffing {
  hour: number
  minute: number
  label: string
  staffCount: number
  predictedDemand: number
}

// ============================================
// INVOICE INTELLIGENCE TYPES
// ============================================

export interface Invoice {
  id: string
  org_id: string
  venue_id: string
  supplier_id?: string
  source: 'upload' | 'email'
  original_file_url?: string
  original_filename?: string
  invoice_number?: string
  invoice_date?: string  // ISO date string
  due_date?: string
  subtotal?: number
  tax_amount?: number
  total_amount?: number
  currency: string
  document_type: 'invoice' | 'credit_note' | 'statement'
  status: 'pending_review' | 'confirmed' | 'disputed' | 'duplicate'
  matched_po_id?: string
  sender_email?: string
  processing_metadata?: Record<string, unknown>
  confirmed_by?: string
  confirmed_at?: string
  notes?: string
  created_at: string
  updated_at: string
  // Joined fields (not in DB)
  supplier_name?: string
  line_items?: InvoiceLineItem[]
}

export interface InvoiceLineItem {
  id: string
  invoice_id: string
  ingredient_id?: string
  raw_description: string
  extracted_quantity?: number
  extracted_unit?: string
  extracted_unit_price?: number
  extracted_line_total?: number
  extracted_tax?: number
  extracted_discount?: number
  confidence_score?: number
  match_status: 'auto_matched' | 'manual_matched' | 'new_ingredient' | 'unmatched'
  confirmed_quantity?: number
  confirmed_unit_price?: number
  variance_notes?: string
  created_at: string
  // Joined fields
  ingredient_name?: string
}

export interface ReconciliationLog {
  id: string
  invoice_id: string
  purchase_order_id?: string
  venue_id: string
  reconciled_by?: string
  reconciled_at: string
  total_expected_value?: number
  total_received_value?: number
  total_variance?: number
  status: 'fully_received' | 'partial' | 'disputed'
  notes?: string
  // Joined fields
  line_items?: ReconciliationLineItem[]
}

export interface ReconciliationLineItem {
  id: string
  reconciliation_id: string
  invoice_line_item_id?: string
  po_line_item_id?: string
  ingredient_id?: string
  expected_quantity?: number
  received_quantity?: number
  expected_unit_price?: number
  actual_unit_price?: number
  quantity_variance?: number
  price_variance?: number
  status: 'received_full' | 'received_partial' | 'not_received' | 'unexpected'
  notes?: string
  // Joined fields
  ingredient_name?: string
}

// ============================================
// INVENTORY DEPLETION ENGINE TYPES
// ============================================

export interface DepletionQueueItem {
  id: string
  org_id: string
  venue_id: string
  square_order_id: string
  line_items: Array<{
    catalog_item_id: string
    variation_id?: string
    quantity: number
    modifiers?: Array<{ modifier_id: string; modifier_name: string }>
  }>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message?: string | null
  processed_at?: string | null
  created_at: string
}

// ============================================
// INVENTORY DEPLETION ENGINE TYPES
// ============================================

export type DepletionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'

export interface DepletionQueueItem {
  id: string
  org_id: string
  venue_id: string
  square_order_id: string
  line_items: Array<{
    catalog_item_id: string
    variation_id?: string
    quantity: number
    modifiers?: Array<{ modifier_id: string; modifier_name: string }>
  }>
  status: DepletionStatus
  error_message?: string | null
  retry_count: number
  processed_at?: string | null
  created_at: string
}

export type MovementType =
  | 'sale_depletion'
  | 'purchase_receipt'
  | 'waste_log'
  | 'manual_adjustment'
  | 'opening_stock'
  | 'stock_count_adjustment'
  | 'refund_reversal'

export interface StockMovement {
  id: string
  org_id: string
  venue_id: string
  ingredient_id: string
  ingredient_name?: string // joined
  movement_type:
    | 'sale_depletion'
    | 'purchase_receipt'
    | 'waste_log'
    | 'manual_adjustment'
    | 'opening_stock'
    | 'stock_count_adjustment'
  quantity: number // positive = stock added, negative = stock removed
  unit: string
  unit_cost?: number | null
  reference_type?: string | null
  reference_id?: string | null
  notes?: string | null
  created_by?: string | null
  created_at: string
}

export interface StockLevel {
  ingredient_id: string
  ingredient_name: string
  venue_id: string
  unit: string
  current_stock: number     // computed from movements
  par_level: number
  reorder_point: number
  weighted_avg_cost: number | null
  last_movement_at: string | null
  status: 'healthy' | 'low' | 'critical' | 'out'
}

// ============================================
// DEMAND FORECASTING TYPES
// ============================================

export interface DemandForecast {
  id: string
  venue_id: string
  menu_item_id: string
  menu_item_name?: string  // joined
  forecast_date: string    // ISO date YYYY-MM-DD
  predicted_quantity: number
  lower_bound: number
  upper_bound: number
  mape?: number | null     // Mean Absolute Percentage Error from last fit
  model_params?: Record<string, number> | null  // alpha, beta, gamma stored
  created_at: string
  updated_at: string
}

// ============================================
// REORDER ENGINE TYPES
// ============================================

export interface OrderRecommendation {
  ingredient_id: string
  ingredient_name: string
  venue_id: string
  supplier_id?: string | null
  supplier_name?: string | null
  current_stock: number
  par_level: number
  reorder_point: number
  avg_daily_demand: number
  lead_time_days: number
  recommended_order_qty: number
  pack_size?: number | null
  unit: string
  unit_cost?: number | null
  estimated_order_value?: number | null
  days_remaining?: number | null
  status: 'healthy' | 'low' | 'critical' | 'out'
  reason: string  // human-readable justification
}

export interface DayStats {
  date: Date
  totalHours: number
  totalCost: number
  shiftCount: number
  staffCount: number
  avgHourlyRate: number
  salesForecast: number
  sph: number
  wagePercentRevenue: number
}

// ── Quick Build Types ─────────────────────────────────────────────────────────

/**
 * Individual shift definition within a template or roster pattern.
 */
export interface TemplateShiftDef {
  day_of_week: number   // 0=Sun, 1=Mon, …, 6=Sat
  start_time: string    // HH:MM
  end_time: string      // HH:MM
  break_minutes: number
  role: string
  staff_id: string | null
}

/**
 * Roster Pattern — recurring weekly shift pattern (e.g. "Mon–Wed–Fri Kitchen Open").
 */
export interface RosterPattern {
  id: string
  organization_id: string
  venue_id: string
  name: string
  description?: string
  shifts: TemplateShiftDef[]
  is_active: boolean
  created_at: Date
  updated_at: Date
}
