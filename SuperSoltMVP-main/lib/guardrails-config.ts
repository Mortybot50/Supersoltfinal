// Environment-aware guardrails configuration

export const TARGET_COGS_PCT = 0.35; // 35% COGS → 65% GP target
export const TARGET_LABOUR_PCT = 0.22; // 22% labour target
export const DEV = process.env.NODE_ENV !== "production";

// Minimum observations required to consider an item for price suggestions
export const MIN_MENU_OBS = DEV ? 1 : 3;

// Labour tolerance thresholds (±10% in dev, ±20% in prod)
export const LABOUR_TOLERANCE = DEV ? 0.10 : 0.20;

// Inventory horizon for order shortfall detection
export const SHORTFALL_LOOKAHEAD_DAYS = 7;

// Price nudge configuration
export const PRICE_NUDGE_STEP = 0.05; // Propose +5% price steps
export const PRICE_NUDGE_MAX = 0.20; // Cap at +20% maximum increase

// Legacy config object for backward compatibility
export const GUARDRAILS_CONFIG = {
  TARGET_COGS_PCT,
  LABOUR_DEVIATION_THRESHOLD: LABOUR_TOLERANCE,
  ORDER_GUIDE_DAYS: SHORTFALL_LOOKAHEAD_DAYS,
  ORDER_GUIDE_SAFETY_DAYS: 1,
} as const;

// Suggestion priorities
export const SUGGESTION_PRIORITY = {
  PRICE_NUDGE: 1,
  ORDER_SHORTFALL: 2,
  LABOUR_TRIM: 3,
  LABOUR_ADD: 4,
} as const;
