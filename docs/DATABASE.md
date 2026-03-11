# SuperSolt — Database Reference

## Connection
- Provider: Supabase (PostgreSQL 15)
- Project ID: `vcfmouckydhsmvfoykms`
- Region: ap-southeast-2 (Sydney)
- Supabase URL: `VITE_SUPABASE_URL` env var

---

## Table Overview (53 tables)

### Core / Auth
| Table | Description |
|-------|-------------|
| `organizations` | Top-level tenant. Every table scoped to `org_id`. |
| `venues` | Physical locations within an org. |
| `profiles` | Extended user data linked to `auth.users`. |
| `org_members` | User ↔ org membership with role. |
| `venue_access` | Venue-level permission grants per org_member. |
| `members` | Legacy member records (use org_members for new code). |
| `invites` | Email invitations (org-level). |
| `staff_invites` | Staff onboarding invitations. |
| `user_roles` | Custom role assignments. |
| `role_definitions` | Role definitions per org. |
| `pins` | PIN-based authentication tokens. |
| `device_assignments` | POS terminal device tracking. |
| `access_audit` | Auth/access event log. |

### Inventory
| Table | Description |
|-------|-------------|
| `ingredients` | Ingredient catalogue. `unit_cost`, `yield_percentage`. |
| `ingredient_price_history` | Price change log per ingredient. |
| `suppliers` | Supplier directory. `invoice_email_domains` for email parsing. |
| `purchase_orders` | PO lifecycle: draft → approved → received. |
| `purchase_order_items` | Line items on each PO. `quantity_received` for GRN. |
| `inv_locations` | Inventory storage locations (walk-in, dry store, etc.). |
| `inv_bins` | Bin positions within locations. |
| `inv_location_assignments` | Ingredient ↔ bin assignments. |
| `stock_counts` | Stock count sessions. |
| `stock_count_items` | Per-ingredient counts within a session. |
| `waste_logs` | Waste/spoilage records with reason codes. |
| `count_schedules` | Scheduled count frequencies per location. |
| `orders` | POS orders (synced from Square). |

### Invoice Intelligence
| Table | Description |
|-------|-------------|
| `invoices` | Parsed invoices (upload or email). |
| `invoice_line_items` | Extracted line items with match confidence. |
| `reconciliation_logs` | Invoice vs PO reconciliation sessions. |
| `reconciliation_line_items` | Per-line reconciliation status. |

### Menu & Costing
| Table | Description |
|-------|-------------|
| `menu_items` | Menu items with selling prices. |
| `menu_sections` | Menu sections/categories. |
| `recipes` | Recipe cards. `is_sub_recipe` for nested costing. |
| `recipe_ingredients` | BOM lines linking recipes → ingredients. |

### Labour / Workforce
| Table | Description |
|-------|-------------|
| `staff` | Staff profiles. `employment_type`: casual/part_time/full_time. |
| `roster_shifts` | Individual shifts. `shift_date`, `start_time`, `end_time`, `status`. |
| `shift_swap_requests` | Shift swap requests between staff. |
| `shift_templates` | Reusable shift definitions. |
| `roster_patterns` | Weekly roster templates. `shifts: Json` array. |
| `timesheets` | Weekly timesheet records. `gross_pay`, `status`. |
| `staff_availability` | Recurring availability windows per staff. |
| `staff_qualifications` | Certifications/licences per staff. |
| `qualification_types` | Qualification catalogue per org. |
| `labor_budgets` | Labour cost budgets per period. |

### Payroll / Operations
| Table | Description |
|-------|-------------|
| `venue_settings` | Per-venue config: GST, penalty rates, overtime settings. |
| `venue_settings_audit` | Change log for venue settings. |
| `venue_templates` | Venue configuration templates. |
| `roster_patterns` | (See Labour above) |
| `daybook_entries` | Manager notes/observations. |

### Integrations
| Table | Description |
|-------|-------------|
| `pos_connections` | Square POS OAuth tokens (AES-256-GCM encrypted), sync status. |
| `pos_location_mappings` | Square location → SuperSolt venue mapping. |
| `xero_connections` | Xero OAuth tokens (encrypted), tenant info, sync status. |
| `xero_sync_log` | Sync attempt history (direction, record counts, errors). |
| `xero_account_mappings` | SuperSolt category → Xero chart of accounts. |

### Admin
| Table | Description |
|-------|-------------|
| `admin_data_audit` | Data change audit log. |
| `admin_data_jobs` | Background job tracking. |
| `assignments` | Resource assignments (generic). |

---

## RLS Policy Pattern

**100% of tables have RLS enabled.** Standard policy pattern:

```sql
-- SELECT: any org member
CREATE POLICY "org members can view X"
  ON table_name FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));

-- INSERT/UPDATE/DELETE: typically org admin or any member
CREATE POLICY "org members can insert X"
  ON table_name FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()));
```

### Key Helper Functions
```sql
-- Returns array of org IDs the current user belongs to
get_user_org_ids() → UUID[]

-- Returns array of venue IDs the current user can access
get_user_venue_ids() → UUID[]

-- Returns true if current user is admin of the given org
is_org_admin(org_id UUID) → BOOLEAN
```

---

## Key Relationships (FK Map)

```
auth.users
  └── profiles (id → auth.users.id)
       └── org_members (user_id → profiles.id)
            └── organizations (org_id → organizations.id)
                 └── venues (org_id → organizations.id)
                      └── venue_access (venue_id → venues.id)

organizations
  ├── ingredients (org_id)
  ├── suppliers (org_id)
  ├── purchase_orders (org_id)
  │    └── purchase_order_items (purchase_order_id)
  ├── staff (org_id)
  │    └── roster_shifts (staff_id → staff.id, org_id)
  │    └── timesheets (staff_id → staff.id, org_id)
  ├── recipes (org_id)
  │    └── recipe_ingredients (recipe_id)
  ├── invoices (org_id)
  │    └── invoice_line_items (invoice_id)
  ├── pos_connections (org_id)
  │    └── pos_location_mappings (pos_connection_id)
  └── xero_connections (org_id)
       └── xero_account_mappings (org_id)
```

---

## Key Triggers & Functions

| Name | Purpose |
|------|---------|
| `handle_new_user()` | Creates `profiles` row on `auth.users` insert |
| `get_user_org_ids()` | RLS helper — returns user's org IDs |
| `get_user_venue_ids()` | RLS helper — returns user's venue IDs |
| `is_org_admin(org_id)` | RLS helper — checks admin role |

---

## Migration History

Migrations live in `supabase/migrations/` in `YYYYMMDDHHMMSS_description.sql` format.

Key migrations:
| File | Description |
|------|-------------|
| `20250203000000_mvp_schema.sql` | Base schema — all core tables |
| `20260210000000_fix_rls_policies.sql` | RLS policy standardisation |
| `20260308000001_venue_setup_and_seed.sql` | PPB venue setup + demo data |
| `20260309000005_invoice_intelligence_final.sql` | Invoice/reconciliation tables |
| `20260310000003_qualifications.sql` | Staff qualifications module |
| `20260311000001_supplier_enhancements.sql` | Supplier price tracking |
| `20260311000002_wave3_inventory.sql` | Advanced inventory features |
| `20260311200000_xero_integration.sql` | Xero OAuth + sync tables |
| `20260311210000_piccolo_panini_org_setup.sql` | Pilot org creation |

---

## TypeScript Types

Auto-generated from live schema. Regenerate with:
```bash
supabase gen types typescript --project-id vcfmouckydhsmvfoykms > src/integrations/supabase/types.ts
```

Import the typed client: `import { supabase } from '@/integrations/supabase/client'`

Access table types: `import type { Tables } from '@/integrations/supabase/types'`
