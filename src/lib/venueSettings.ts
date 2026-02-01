export interface VenueSettings {
  id?: string;
  venue_id: string;
  timezone?: string;
  price_display_mode?: string;
  gst_rate_percent?: number;
  week_starts_on?: string;
  default_gp_target_percent?: number;
  menu_sections?: any[];
  price_endings?: string;
  rounding_mode?: string;
  primary_suppliers?: string[];
  delivery_windows?: any[];
  order_cutoffs?: any[];
  payroll_cycle?: string;
  award_region?: string;
  roster_budget_percent?: number;
  pos_provider?: string;
  printer_map?: any[];
  tax_code_default?: string;
  use_au_public_holidays?: boolean;
  state?: string;
  custom_closed_dates?: string[];
  price_change_max_percent_no_approval?: number;
  po_amount_over_requires_owner?: number;
  below_gp_threshold_alert_percent?: number;
  inherit?: Record<string, boolean>;
  last_published_snapshot?: any;
  created_at?: string;
  updated_at?: string;
}

export interface OrgSettings {
  timezone: string;
  price_display_mode: string;
  gst_rate_percent: number;
  week_starts_on: string;
  default_gp_target_percent: number;
  menu_sections: any[];
  price_endings: string;
  rounding_mode: string;
  primary_suppliers: string[];
  delivery_windows: any[];
  order_cutoffs: any[];
  payroll_cycle: string;
  award_region: string;
  roster_budget_percent: number;
  pos_provider: string;
  printer_map: any[];
  tax_code_default: string;
  use_au_public_holidays: boolean;
  state: string;
  custom_closed_dates: string[];
  price_change_max_percent_no_approval: number;
  po_amount_over_requires_owner: number;
  below_gp_threshold_alert_percent: number;
  [key: string]: any;
}

/**
 * Get effective setting for a specific field, respecting inheritance
 */
export function getEffectiveVenueSetting(
  venueSettings: VenueSettings | null,
  orgSettings: OrgSettings,
  fieldName: string
): any {
  // If no venue settings or inherit flag is true, return org default
  if (!venueSettings || venueSettings.inherit?.[fieldName] === true) {
    return orgSettings[fieldName];
  }
  
  // Otherwise return venue override
  return venueSettings[fieldName];
}

/**
 * Get all effective settings for a venue
 */
export function getAllEffectiveSettings(
  venueId: string,
  venueSettings: VenueSettings | null,
  orgSettings: OrgSettings
) {
  const fields = [
    'timezone', 'price_display_mode', 'gst_rate_percent', 'week_starts_on',
    'default_gp_target_percent', 'menu_sections', 'price_endings', 'rounding_mode',
    'primary_suppliers', 'delivery_windows', 'order_cutoffs',
    'payroll_cycle', 'award_region', 'roster_budget_percent',
    'pos_provider', 'printer_map', 'tax_code_default',
    'use_au_public_holidays', 'state', 'custom_closed_dates',
    'price_change_max_percent_no_approval', 'po_amount_over_requires_owner',
    'below_gp_threshold_alert_percent'
  ];
  
  const effective: any = { venue_id: venueId };
  fields.forEach(field => {
    effective[field] = getEffectiveVenueSetting(venueSettings, orgSettings, field);
  });
  
  return effective;
}

/**
 * Generate default org settings (used as fallback)
 */
export function getDefaultOrgSettings(): OrgSettings {
  return {
    timezone: 'Australia/Melbourne',
    price_display_mode: 'INC_GST',
    gst_rate_percent: 10.0,
    week_starts_on: 'Monday',
    default_gp_target_percent: 70.0,
    menu_sections: [],
    price_endings: '.00',
    rounding_mode: 'NEAREST',
    primary_suppliers: [],
    delivery_windows: [],
    order_cutoffs: [],
    payroll_cycle: 'Fortnightly',
    award_region: 'VIC',
    roster_budget_percent: 25.0,
    pos_provider: '',
    printer_map: [],
    tax_code_default: '',
    use_au_public_holidays: true,
    state: 'VIC',
    custom_closed_dates: [],
    price_change_max_percent_no_approval: 15.0,
    po_amount_over_requires_owner: 5000.0,
    below_gp_threshold_alert_percent: 60.0,
  };
}
