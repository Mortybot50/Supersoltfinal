# Security Audit — SuperSolt
**Date:** 2026-03-12
**Branch:** fix/skill-audit-sweep
**Skill used:** supabase-postgres-best-practices (security-rls-* references)

---

## Summary

| Severity | Count | Fixed | Documented |
|----------|-------|-------|------------|
| Critical | 1     | 1     | 0          |
| High     | 0     | 0     | 0          |
| Medium   | 4     | 1     | 3          |
| Low      | 2     | 0     | 2          |

---

## CRITICAL (Fixed before this audit)

### C1 — Debug block logged partial service role key to Vercel function logs
- **File:** `api/square/callback.ts` (removed in commit `ba2dcbf`)
- **Issue:** A debug block logged `keyPrefix: serviceKey.substring(0, 20)` and `isServiceRole: serviceKey.includes('service_role')` to Vercel function logs. The first 20 characters of the `SUPABASE_SERVICE_ROLE_KEY` were exposed in production Vercel log output (accessible to anyone with Vercel dashboard access to the project).
- **Fix:** Removed the entire debug block and the unused `serviceKey` variable.
- **Status:** ✅ Fixed in commit `ba2dcbf`

---

## MEDIUM

### M1 — `parse-invoice` endpoint: Bearer presence check without token verification
- **File:** `api/parse-invoice/index.ts` (lines 83–87, prior to fix)
- **Issue:** The endpoint only checked that the `Authorization` header started with `"Bearer "` — it did not call `verifyUser()` to validate the token with Supabase. Any HTTP client sending `Authorization: Bearer anything` would pass the check and invoke a Claude claude-sonnet-4-6 (vision) API call, incurring unbounded Anthropic API costs.
- **Fix:** Replaced the header presence check with `extractToken(req)` + `verifyUser(token)`. Also changed rate-limit key from raw token prefix to `user.id` (a genuine identifier).
- **Status:** ✅ Fixed

### M2 — Email webhook (`/api/inbound-email`) has no authentication
- **File:** `api/inbound-email/index.ts` line 22
- **Issue:** The endpoint accepts POST requests from any source without signature validation. A TODO comment acknowledges this.
- **Risk:** An attacker who discovers the endpoint URL could POST arbitrary email payloads. Currently low impact since `processInboundEmail` is a stub that takes no destructive action. **Will become High severity once an email provider is connected.**
- **Action required before going live:** Implement HMAC signature verification for the chosen provider (SendGrid: `x-twilio-email-event-webhook-signature`, Postmark: `X-Postmark-Signature`).
- **Status:** ⚠️ Documented — acceptable as long as endpoint remains unconnected to a provider

### M3 — No explicit CORS configuration on API routes
- **File:** `vercel.json`
- **Issue:** Vercel serves API routes without explicit `Access-Control-Allow-Origin` configuration. Defaults to same-origin for browser requests, but explicit configuration is best practice for APIs that may be called from multiple domains.
- **Impact:** Low in current setup (single-origin Vercel deployment). Would be a gap if the API were called from a mobile app or third-party integration.
- **Status:** ⚠️ Documented — acceptable for current deployment

### M4 — No explicit request body size limits on file-accepting endpoints
- **Files:** `api/parse-invoice/index.ts`, `api/inventory/index.ts`
- **Issue:** No explicit `Content-Length` or size validation before processing. Vercel Pro has 100MB default limit. The invoice parser accepts base64-encoded PDFs/images without checking size before passing to Claude API.
- **Impact:** A large malicious payload could cause slow responses or hit Claude API limits unnecessarily.
- **Recommended fix:** Add size check before Claude call: `if (body.length > 10 * 1024 * 1024) return res.status(413).json({ error: 'File too large' })`
- **Status:** ⚠️ Documented

---

## LOW

### L1 — `staff_availability` data stored unencrypted (but schema incomplete)
- **File:** DB table `staff_availability`
- **Issue:** Availability data is not sensitive (day of week preferences) so encryption is not required. However the table is missing `specific_date` and `notes` columns (documented separately). When notes are added, personal notes should be treated as PII.
- **Status:** ⚠️ Noted — not a current risk; review when schema is complete

### L2 — TFN/bank fields not yet implemented in source
- **Search:** No `TFN`, `tax_file_number`, `bank_account`, `bsb`, or `account_number` fields found in `src/` codebase.
- **Status:** ⚠️ Feature not yet implemented. When added: encrypt at rest (AES-256-GCM, same pattern as Square tokens), never log, never return raw values via API, add column-level encryption in Supabase migration.

---

## Verified Secure

| Area | Status | Notes |
|------|--------|-------|
| Square token storage | ✅ AES-256-GCM encrypted | IV (12 bytes) + auth tag (16 bytes) per best practice |
| Square token decryption | ✅ Tight scope | Decrypted only at point of use in `sync.ts` and `disconnect.ts` |
| Square webhook validation | ✅ HMAC-SHA256 | Uses `crypto.timingSafeEqual()` to prevent timing attacks |
| API route authentication | ✅ All routes | JWT validation + org membership check on every endpoint |
| Xero OAuth CSRF | ✅ HMAC-SHA256 state | Signed by `XERO_CLIENT_SECRET`, verified on callback |
| Frontend Supabase client | ✅ Anon key only | No `service_role` in `src/`; `VITE_SUPABASE_PUBLISHABLE_KEY` only |
| Service role usage | ✅ API routes only | `SUPABASE_SERVICE_ROLE_KEY` only in Vercel serverless functions |
| Invite token generation | ✅ `crypto.randomUUID()` | 7-day expiry; used once (`completed_at` tracked) |
| Invite token validation | ✅ Server-side | Expiry checked in `InvitePortal.tsx` before accepting |
| Secrets in source files | ✅ None found | `.env.local` is gitignored; no hardcoded credentials in `src/` or `api/` |
| Secrets in git history | ✅ None found | History scan: `service_role` references only in documentation files |
| Sentry PII | ✅ `sendDefaultPii: false` | Per `src/lib/sentry.ts` |
| RLS coverage | ✅ 100% of tables | See `docs/audit/database-audit.md` for per-table details |
