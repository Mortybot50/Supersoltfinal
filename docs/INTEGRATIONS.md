# SuperSolt — Integrations Guide

## Square POS

### Overview

Syncs sales orders, payments, and line items from Square into SuperSolt.

### Architecture

- OAuth 2.0 flow via `/api/square/auth` → `/api/square/callback`
- Tokens stored AES-256-GCM encrypted in `pos_connections` table
- Sync triggered manually ("Sync Now") or via API call
- Real-time webhook at `/api/square/webhook` (currently acknowledgement only)

### OAuth Flow

1. User clicks "Connect Square" → redirected to `/api/square/auth?org_id=X&token=JWT`
2. Server verifies user, builds Xero authorize URL with signed state
3. Square OAuth UI → user approves
4. Square redirects to `/api/square/callback?code=C&state=S`
5. Server: verifies state HMAC, exchanges code for tokens, fetches locations
6. Tokens encrypted and stored in `pos_connections`
7. Redirect to `/admin/integrations?connected=square`

### Files

```
api/square/
├── _lib.ts          # encrypt/decrypt, auth helpers, Square base URL
├── auth.ts          # Initiate OAuth (redirects to Square)
├── callback.ts      # Handle redirect, token exchange, store tokens
├── sync.ts          # Fetch + upsert orders from Square API
├── disconnect.ts    # Revoke token, mark connection inactive
└── webhook.ts       # Receive real-time events (stub handler)
```

### Env Vars Required

```
SQUARE_APP_ID          # From Square Developer Dashboard
SQUARE_APP_SECRET      # From Square Developer Dashboard
SQUARE_ENVIRONMENT     # 'sandbox' or 'production'
ENCRYPTION_KEY         # 64-char hex (shared with Xero)
APP_URL                # https://your-domain.vercel.app
```

### Testing

- Use Square Sandbox app for development
- Test orders can be created in Square Dashboard sandbox mode
- After connecting, click "Sync Now" — orders appear in `/sales`

### Token Refresh

Auto-refresh on 401 response in `sync.ts`. New tokens written back to `pos_connections`.

---

## Xero Accounting Integration

### Overview

Syncs financial data between SuperSolt and Xero:

- **Push**: Sales summaries → Xero invoices, PO bills → Xero bills, payroll → Xero journals
- **Pull**: Chart of accounts for mapping

### Architecture

- OAuth 2.0 PKCE flow via `/api/xero/auth` → `/api/xero/callback`
- Tokens stored AES-256-GCM encrypted in `xero_connections`
- Sync attempts logged in `xero_sync_log`
- Account mappings in `xero_account_mappings` (configurable per org)

### OAuth Flow

1. User clicks "Connect Xero" → redirected to `/api/xero/auth?org_id=X&token=JWT`
2. Server verifies user, builds Xero authorize URL with HMAC-signed state
3. Xero OAuth UI → user selects Xero organisation
4. Xero redirects to `/api/xero/callback?code=C&state=S`
5. Server: verifies state, exchanges code, fetches tenant list
6. Tokens encrypted, stored in `xero_connections`
7. Default AU hospitality account mappings seeded in `xero_account_mappings`
8. Redirect to `/admin/integrations?connected=xero`

### Files

```
api/xero/
├── _lib.ts          # encrypt/decrypt, auth, Xero base URL, default mappings
├── auth.ts          # Initiate OAuth
├── callback.ts      # Handle redirect, token exchange, seed mappings
├── sync.ts          # Push sales/purchases/payroll; auto token refresh
├── accounts.ts      # Fetch Xero chart of accounts for mapping UI
└── disconnect.ts    # Revoke token, mark connection inactive
```

### Env Vars Required

```
XERO_CLIENT_ID       # From Xero Developer Portal (My Apps > OAuth 2.0)
XERO_CLIENT_SECRET   # From Xero Developer Portal
XERO_REDIRECT_URI    # Must match exactly in Xero app config:
                     # https://your-domain.vercel.app/api/xero/callback
ENCRYPTION_KEY       # Same key as Square (64-char hex)
APP_URL              # https://your-domain.vercel.app
```

### Xero App Setup (Xero Developer Portal)

1. Go to https://developer.xero.com/myapps
2. Create a new app, select "Web App"
3. Set redirect URI to `https://YOUR_DOMAIN/api/xero/callback`
4. Copy Client ID and Secret to Vercel env vars
5. Add scopes: `openid profile email accounting.transactions accounting.accounts.read accounting.contacts.read offline_access`

> **Note**: Xero does not have a sandbox environment — use a test Xero organisation (free demo org available in Xero Developer Portal).

### Account Mapping UI

Admin navigates to: Settings → Integrations → Xero → "Mappings" button

The mapping UI (`XeroSettings.tsx`) fetches the live Xero chart of accounts and allows admin to map each SuperSolt financial category to a Xero account code.

**Default AU mappings** (seeded on first connection):
| SuperSolt Category | Xero Code | Account Name |
|-------------------|-----------|-------------|
| revenue_food | 200 | Sales |
| revenue_beverage | 200 | Sales |
| cogs_food | 310 | Cost of Goods Sold |
| cogs_beverage | 310 | Cost of Goods Sold |
| labour_wages | 477 | Wages and Salaries |
| labour_super | 478 | Superannuation |
| gst_collected | 820 | GST |
| gst_paid | 820 | GST |
| overhead_rent | 493 | Rent |
| overhead_utilities | 489 | Light, Power, Heating |
| overhead_marketing | 400 | Advertising and Marketing |

### Sync Types

| Type        | What's pushed                                  | Xero record type      |
| ----------- | ---------------------------------------------- | --------------------- |
| `sales`     | Daily sales totals (from `orders`)             | ACCREC Invoice        |
| `purchases` | Approved/received POs (from `purchase_orders`) | ACCPAY Invoice (bill) |
| `payroll`   | Approved timesheets (from `timesheets`)        | Manual Journal        |
| `accounts`  | Pull only — no push                            | N/A                   |

---

## Invoice Intelligence (Claude Vision)

### Overview

Parses supplier invoices (PDF or image) using Anthropic Claude claude-sonnet-4-6 vision model.
Extracts line items, matches them to ingredients, creates `invoices` + `invoice_line_items` records.

### Architecture

```
Upload PDF/image
  → client sends to /api/parse-invoice/
  → Vercel function calls Anthropic API (claude-sonnet-4-6)
  → Returns structured JSON
  → Client reviews extracted lines
  → Client matches to ingredients (ingredientMatcher.ts)
  → User confirms → saved to DB
```

### Files

```
api/parse-invoice/index.ts         # Vercel function, calls Anthropic
src/lib/services/invoiceParser.ts  # Client-side parser service
src/lib/services/ingredientMatcher.ts  # Fuzzy matching to ingredients
src/pages/inventory/InvoiceUpload.tsx  # UI
```

### Env Vars Required

```
ANTHROPIC_API_KEY    # From Anthropic Console (console.anthropic.com)
```

Set in Vercel dashboard. The key is ONLY accessed server-side in the Vercel function — never exposed to the client.

### Supported File Types

- PDF (most common)
- JPEG, PNG, WebP

### Email Ingestion (Stub)

`src/lib/services/emailIngestion.ts` and `api/inbound-email/index.ts` are stubs for future email-based invoice ingestion. Not yet functional.

---

## Integration Status Summary

| Integration             | Status           | Notes                                               |
| ----------------------- | ---------------- | --------------------------------------------------- |
| Square POS              | Production-ready | Needs SQUARE_APP_ID + SQUARE_APP_SECRET in Vercel   |
| Xero Accounting         | Production-ready | Needs XERO_CLIENT_ID + XERO_CLIENT_SECRET in Vercel |
| Invoice Intelligence    | Production-ready | Needs ANTHROPIC_API_KEY in Vercel                   |
| Email Invoice Ingestion | Stub / TODO      | api/inbound-email not implemented                   |
| MYOB                    | Not started      | Roadmap                                             |
| Deputy / Tanda          | Not started      | Roadmap                                             |
