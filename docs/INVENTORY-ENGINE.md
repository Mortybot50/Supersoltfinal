# Inventory Depletion Engine — Architecture Document

SuperSolt inventory depletion engine: real-time stock tracking, demand forecasting, and smart reorder recommendations for multi-venue hospitality operations.

---

## 1. How Production Hospitality Platforms Handle Real-Time Stock Depletion

### Industry Patterns (MarketMan, Lightspeed, Toast)

**MarketMan** uses an event-driven depletion model where POS sales events are enqueued immediately at the point of sale, then a background worker processes the queue in batches. Each sale event is resolved against a "theoretical usage" model — mapping menu items to their constituent ingredients via recipes, then debiting those ingredients from the inventory ledger. Stock is never stored as a single cached field; it is always computed as `last_count + sum(movements since count)`. This makes reconciliation deterministic and auditable.

**Lightspeed** takes a similar event queue approach with an important addition: modifier-aware depletion. A burger ordered "without cheese" should not deduct cheese from stock. Lightspeed resolves modifiers against a modifier-ingredient mapping table at depletion time, adjusting quantities before inserting movements. Their system tolerates brief eventual consistency (up to ~30 seconds) on stock levels, but the queue itself is append-only and durable.

**Toast** operates with a more aggressive real-time model using webhooks from the POS firing on every order completion. The webhook receiver validates the payload, authenticates the source, and writes to an order queue table. A separate worker processes the queue with `SELECT FOR UPDATE SKIP LOCKED` to prevent double-processing in multi-instance deployments. Toast also tracks waste factors per ingredient — trim waste, spillage, and overportioning — to reconcile theoretical vs actual stock.

### Common Principles Across All Three

1. **Append-only movement ledger.** Stock level is never a mutable field — it is always derived from an immutable series of movement records. This enables full audit trail, point-in-time reconstruction, and reconciliation against physical counts.

2. **Event queue for durability.** POS events land in a queue table first. Processing is decoupled from ingestion, so a slow inventory calculation does not block order completion at the POS.

3. **Recipe-ingredient resolution at depletion time.** The system resolves the current recipe definition at the time of processing (not at the time of order creation), which means menu changes are reflected immediately.

4. **Atomic bulk writes.** All movements for a single order are inserted in a single database transaction. Partial depletion (some ingredients succeed, others fail) is never allowed — the whole order either depletes or fails and retries.

5. **Waste factor overlays.** Real usage exceeds theoretical usage. A 5% trim waste on beef means that selling one 200g beef burger actually consumes ~210g of stock.

---

## 2. Architecture Decision: Event Queue vs Polling

### Options Considered

**Option A: Polling.** A cron job queries `orders` every N minutes and computes what has not yet been depleted. Simple to implement, but introduces latency proportional to the poll interval, and requires tracking "last processed" state which is fragile under failures.

**Option B: Trigger-based (Postgres trigger).** A `AFTER INSERT ON orders` trigger calls a function that immediately inserts depletion movements. Highly consistent, but Postgres triggers fire synchronously in the transaction — slow recipe resolution could block order writes. Also makes it difficult to retry on partial failures.

**Option C: Event queue table with unified API handler (chosen).** Square sends a webhook to `/api/inventory?action=process-queue` on order completion. The handler writes the raw order event to `stock_depletion_queue` atomically. A separate call (either another webhook trigger or a scheduled invocation) processes the queue by picking up `pending` rows with `SELECT FOR UPDATE SKIP LOCKED`, resolving recipes, and writing `stock_movements` in a single transaction.

### Why Event Queue Was Chosen

- **Durability:** The queue row is written before any processing. If the serverless function dies mid-execution, the row remains `pending` or `failed` and will be retried.
- **Idempotency:** The `UNIQUE (org_id, square_order_id)` constraint on `stock_depletion_queue` prevents duplicate ingestion from Square webhook retries.
- **Decoupling:** Webhook ingestion (fast, ~5ms) is fully decoupled from recipe resolution (slower, may hit several DB tables). This keeps webhook acknowledgement time under Square's 30-second timeout.
- **Observability:** Queue row status (`pending`, `processing`, `completed`, `failed`, `skipped`) provides an audit trail for every order depletion event. Operations staff can inspect failed items and retry.
- **Concurrency-safe:** `SELECT FOR UPDATE SKIP LOCKED` ensures that in a multi-instance deployment, two function instances processing the queue simultaneously will never pick up the same row.

### Processing Flow

```
Square POS → webhook → /api/inventory?action=ingest-order
                              ↓
                   INSERT INTO stock_depletion_queue (status='pending')
                              ↓
              /api/inventory?action=process-queue (triggered by webhook or cron)
                              ↓
              SELECT ... FOR UPDATE SKIP LOCKED (up to 10 rows)
                              ↓
              For each row:
                resolve catalog_item_id → recipe_id (square_catalog_mappings)
                load recipe_ingredients
                apply modifier adjustments (square_modifier_mappings)
                apply waste factors (ingredient_waste_factors)
                INSERT INTO stock_movements (batch, negative quantities)
                UPDATE stock_depletion_queue SET status='completed'
```

---

## 3. Concurrency Model

### SELECT FOR UPDATE SKIP LOCKED

The queue processor uses `SELECT ... FOR UPDATE SKIP LOCKED` to claim queue rows. This is standard practice for job queue patterns in Postgres:

- `FOR UPDATE` acquires a row-level lock, preventing any other transaction from modifying the row.
- `SKIP LOCKED` skips rows already locked by another transaction instead of waiting. This allows multiple parallel workers to process the queue without blocking each other.
- Rows are processed in batches of up to 10 per invocation, balancing throughput against Vercel function timeout limits.

In practice on Vercel Hobby (single-instance), lock contention is unlikely. The pattern is included for correctness as the platform scales.

### Atomic Batch INSERT for stock_movements

For each queue item, all ingredient depletion movements are collected into a single array and inserted in one `INSERT INTO stock_movements ... VALUES (...)` call. This ensures:

- Either all ingredient quantities are debited, or none are (Postgres INSERT is atomic).
- No partial depletion state is possible.
- If the INSERT fails, the queue item is marked `failed` and the error message is stored for inspection.

### calculate_current_stock() — Always Computed from Movements

Stock level is never stored as a denormalised field on the `ingredients` table. The `calculate_current_stock(ingredient_id, venue_id)` Postgres function computes:

```
current_stock = last_approved_stock_count.actual_quantity
              + SUM(stock_movements.quantity WHERE created_at > last_stock_count.count_date)
```

If no approved stock count exists, it sums all movements from the beginning of time. This approach:

- Guarantees correctness even if movements are inserted out of order.
- Makes periodic stock counts the "reset" anchor points, preventing floating-point drift over thousands of movements.
- Is `STABLE` (same inputs always produce same outputs within a transaction) so Postgres can cache the result within a query.
- Uses `SECURITY DEFINER` so it can read `stock_count_items` and `stock_movements` regardless of the calling user's RLS context, while still being callable via RPC from the frontend.

---

## 4. Demand Forecasting: Holt-Winters Additive with 7-Day Seasonality

### Why Holt-Winters Over Linear Regression

**Linear regression** fits a straight trend line through historical sales data. It handles trend well but ignores periodicity. For hospitality, this is a critical gap: Friday dinner service is structurally different from Tuesday lunch regardless of the overall trend. A model that ignores day-of-week seasonality will systematically underforecast weekends and overforecast weekdays.

**Holt-Winters additive** (triple exponential smoothing) models three components simultaneously:

| Component | Meaning | Smoothing Param |
|-----------|---------|-----------------|
| Level (L) | Current baseline demand | α (alpha) |
| Trend (B) | Rate of change per period | β (beta) |
| Seasonal (S) | Day-of-week multiplier | γ (gamma) |

For a 7-day seasonal period, the model maintains 7 seasonal factors (one per day of week). The forecast for day `t + h` is:

```
F(t+h) = (L_t + h × B_t) + S(t + h - m)
```

where `m = 7` (seasonal period).

This approach handles:
- **Gradual trend** (new venue ramping up, seasonal business change over months)
- **Weekly seasonality** (busy Friday/Saturday, quiet Monday/Tuesday)
- **Noise dampening** (exponential smoothing averages out one-off events)

### Data Requirements

| History Available | Model Quality |
|-------------------|---------------|
| < 14 days | Insufficient — skip this item |
| 14–27 days | Basic (level only, no trend or seasonality) |
| 28 days (4 weeks) | Seasonal estimates available (1 cycle) |
| 84 days (12 weeks) | Reliable — recommended minimum for production |
| 6+ months | Optimal — captures month-to-month patterns |

The `run-forecast` action checks history length before running the model. Items with < 14 days of data are excluded from forecasts. The `demand_forecasts.mape` field (Mean Absolute Percentage Error on last 7 days of actuals vs forecasts) provides a per-item accuracy signal — items with MAPE > 30% should be reviewed for unusual events or mapping errors.

### Smoothing Parameters

Default parameters (can be tuned per venue):
- `α = 0.3` — moderate responsiveness to recent demand changes
- `β = 0.1` — slow trend adaptation (hospitality trends change slowly)
- `γ = 0.2` — moderate seasonal factor update rate

### Confidence Intervals

Confidence bands are calculated as `±1.5 × RMSE` on the training window, giving approximately 85% coverage. These are stored as `confidence_lower` and `confidence_upper` in `demand_forecasts` and displayed as a shaded band in the forecast chart.

---

## 5. Reorder Point Formula

### Formula

```
ROP = (avg_daily_demand × lead_time_days) + safety_stock

safety_stock = Z × σ_demand × √lead_time_days
```

Where:
- `avg_daily_demand` — rolling 14-day average of daily ingredient usage (derived from `stock_movements` of type `sale_depletion`)
- `lead_time_days` — supplier lead time (from `suppliers.lead_time_days`, default 3)
- `Z` — service level z-score:
  - 90% service level → Z = 1.28 (default)
  - 95% service level → Z = 1.645
  - 99% service level → Z = 2.33
- `σ_demand` — standard deviation of daily demand over the last 14 days

### Example Calculation

For a venue with:
- avg_daily_demand = 4 kg of beef mince
- lead_time_days = 3
- σ_demand = 1.2 kg
- Z = 1.28 (90% service level)

```
safety_stock = 1.28 × 1.2 × √3 = 1.28 × 1.2 × 1.732 = 2.66 kg
ROP = (4 × 3) + 2.66 = 14.66 kg ≈ 15 kg
```

When `calculate_current_stock()` returns ≤ 15 kg, the system generates a reorder recommendation.

### Order Quantity

Recommended order quantity is calculated as:

```
order_qty = ceil(forecasted_demand_over_lead_time + safety_stock - current_stock)
            rounded up to nearest pack_size
```

---

## 6. New Database Tables

### square_catalog_mappings
Links Square POS catalog item IDs to SuperSolt recipes. Scoped to `org_id`, optionally narrowed to a specific `venue_id` (NULL = applies to all venues in org). The POS Mapping UI auto-populates this by calling `sync-catalog`, then operators manually confirm or adjust matches.

### square_modifier_mappings
Maps Square modifier option IDs (e.g., "extra shot", "no cheese") to ingredient quantity adjustments. Supports `add`, `remove`, and `replace` adjustment types. A "no cheese" modifier with `adjustment_type = 'remove'` and `quantity_adjustment = 20` (grams) reduces the cheese depletion by 20g when applied.

### ingredient_waste_factors
Stores venue-specific waste percentages per ingredient, by waste type. The depletion engine multiplies each ingredient's theoretical usage by `(1 + waste_percentage / 100)` before inserting the movement. Waste types:
- `trim` — prep waste (vegetable peeling, meat trimming)
- `spillage` — accidental loss during service
- `evaporation` — cooking reduction (stocks, sauces)
- `overportioning` — portion inconsistency above recipe spec

### stock_depletion_queue
Durable queue of Square order events awaiting depletion processing. Each row contains the raw `line_items` JSONB from Square's order payload. The `UNIQUE (org_id, square_order_id)` constraint makes ingestion idempotent against Square webhook retries. The partial index on `(org_id, status) WHERE status IN ('pending', 'failed')` makes queue polling fast — completed rows are excluded from the index.

### stock_movements
The append-only ledger of all inventory movements. Positive quantities add to stock (purchase receipt, stock count adjustment upward), negative quantities remove stock (sale depletion, waste log, adjustment downward). This table is **never updated or deleted** — `stock_count_adjustment` movements are used to correct errors. The `unit_cost` column enables weighted-average COGS calculations.

Movement types:
| Type | Direction | Trigger |
|------|-----------|---------|
| `sale_depletion` | Negative | Queue processor |
| `purchase_receipt` | Positive | PO receiving |
| `waste_log` | Negative | Waste log UI |
| `stock_count_adjustment` | Either | Stock count approval |
| `manual_adjustment` | Either | Manual inventory adjustment UI |
| `refund_reversal` | Positive | Square refund webhook |
| `opening_stock` | Positive | Initial venue setup |

### demand_forecasts
Stores the output of the Holt-Winters forecasting run per menu item per date. Updated by the `run-forecast` action (typically daily via cron). The `mape` field is the Mean Absolute Percentage Error from backtesting on the last 7 days of actuals — a proxy for forecast quality.

---

## 7. API: Single /api/inventory Handler

To stay within Vercel Hobby plan's 12-function limit, all inventory operations are consolidated under a single `/api/inventory` handler routed by `?action=` query parameter.

### Action Routing Table

| Action | Method | Description |
|--------|--------|-------------|
| `process-queue` | POST | Process up to 10 pending depletion queue items |
| `get-queue` | GET | Return queue status (last 100 items, counts by status) |
| `get-movements` | GET | Return recent stock movements for ingredient or venue |
| `get-stock-levels` | GET | Compute current stock for all ingredients in a venue |
| `get-forecast` | GET | Return demand forecasts for a date range |
| `run-forecast` | POST | Run Holt-Winters and upsert demand_forecasts |
| `get-recommendations` | GET | Return smart reorder recommendations |
| `sync-catalog` | POST | Fetch Square catalog and upsert catalog mappings |
| `get-catalog-mappings` | GET | Return catalog mappings for a venue |
| `save-catalog-mapping` | POST | Upsert a single catalog mapping |
| `save-modifier-mapping` | POST | Upsert a modifier mapping |
| `save-waste-factor` | POST | Upsert a waste factor |

### Auth Pattern

All actions follow the same auth chain: extract Bearer token → `verifyUser()` → `checkOrgAccess()`. The handler extracts `org_id` and `venue_id` from query params (GET) or request body (POST).

### Vercel Function Count Impact

Before this module: 11 functions (square: 5, xero: 3, parse-invoice: 1, inbound-email: 1, staff: 1).
After adding `/api/inventory`: 12 functions — at the Hobby plan limit.

---

## 8. Integration Points with Existing Modules

### Square POS (api/square/)
- `sync.ts` already polls Square Orders API. The inventory engine adds webhook-based real-time ingestion via `stock_depletion_queue`.
- `square_catalog_mappings.square_catalog_item_id` joins to Square's `catalogObjectId` on order line items.
- The `sync-catalog` action reuses the decrypted Square access token from `pos_connections` (same encryption scheme).

### Recipes / Ingredients (src/lib/services/recipeService.ts)
- `recipe_ingredients` table is the core of depletion resolution. Each mapped catalog item resolves to a recipe, and that recipe's ingredients are the depletion targets.
- Sub-recipe support: if `recipe_ingredients.sub_recipe_id` is set, the engine recursively resolves ingredient quantities through the sub-recipe graph (BFS, same pattern as `costCascade` in `recipeService.ts`).

### Purchase Orders / PO Receiving
- When a PO is received (status → `received`), `src/components/inventory/POReceiving.tsx` should call `/api/inventory?action=process-queue` (or directly insert `stock_movements` of type `purchase_receipt`) to log the inbound stock. This closes the loop between theoretical and actual stock.

### Stock Counts
- `stock_counts` + `stock_count_items` tables are already the "reset anchor" for `calculate_current_stock()`. When a stock count is approved, the function automatically uses it as the new baseline.

### Food Cost Analysis (src/pages/inventory/FoodCostAnalysis.tsx)
- COGS can be computed more accurately from `stock_movements` (type `sale_depletion`) weighted by `unit_cost`, rather than from PO totals. The `get-movements` action provides the necessary data.

### Waste Logging
- Waste log entries (existing `waste_logs` table) should insert corresponding `stock_movements` of type `waste_log` with negative quantities, so waste is automatically reflected in `calculate_current_stock()` without needing a stock count.

### Demand Forecasts → Roster
- Forecasted high-demand days (e.g., Friday dinner forecast spike) can be surfaced in the roster module as a soft signal for staffing recommendations. The `demand_forecasts` table is queryable by date range, making this integration straightforward.

---

## Future Considerations

- **Par level automation:** Once 12+ weeks of forecast data accumulates, par levels can be auto-suggested per ingredient based on `ROP + (avg_daily_demand × review_period)`.
- **Supplier price change integration:** The `SupplierDetail` edit page (currently a known gap) should trigger a `costCascade` on save and insert a `stock_movements` row with updated `unit_cost` to keep weighted-average COGS accurate.
- **Multi-venue aggregation:** The `org_id` scope on all tables enables cross-venue stock reporting (e.g., total beef mince across all venues) with simple `GROUP BY org_id` queries.
- **Casual overtime in depletion estimates:** Not directly related, but demand forecasts feed into labour cost forecasting where the casual overtime gap (> 10h/day) is a known issue to address.
