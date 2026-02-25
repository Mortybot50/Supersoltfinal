/**
 * Shared helpers for Square API routes.
 * Used by all /api/square/* serverless functions.
 */
import { createClient } from '@supabase/supabase-js'
import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'crypto'

// ── Vercel handler types (avoids @vercel/node install) ──────────────
import type { IncomingMessage, ServerResponse } from 'http'

export interface VercelRequest extends IncomingMessage {
  query: Record<string, string | string[]>
  body: any
}

export interface VercelResponse extends ServerResponse {
  status(code: number): VercelResponse
  json(body: any): VercelResponse
  send(body: any): VercelResponse
  redirect(statusOrUrl: string | number, url?: string): VercelResponse
}

// ── Environment helpers ─────────────────────────────────────────────
export function env(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`Missing env var: ${key}`)
  return v
}

// ── Supabase server client (service role — bypasses RLS) ────────────
export function supabaseAdmin() {
  return createClient(
    env('NEXT_PUBLIC_SUPABASE_URL'),
    env('SUPABASE_SERVICE_ROLE_KEY'),
  )
}

// ── Supabase user-scoped client (respects RLS) ──────────────────────
// Uses service-role key for API gateway auth but the user's JWT in the
// Authorization header — this makes PostgREST evaluate RLS as that user.
export function supabaseAsUser(accessToken: string) {
  return createClient(
    env('NEXT_PUBLIC_SUPABASE_URL'),
    env('SUPABASE_SERVICE_ROLE_KEY'),
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}

// ── Square API base URL ─────────────────────────────────────────────
export const SQUARE_BASE = process.env.SQUARE_ENVIRONMENT === 'sandbox'
  ? 'https://connect.squareupsandbox.com'
  : 'https://connect.squareup.com'

// ── Square OAuth scopes ─────────────────────────────────────────────
export const SQUARE_SCOPES = [
  'MERCHANT_PROFILE_READ',
  'PAYMENTS_READ',
  'ORDERS_READ',
  'ITEMS_READ',
].join('+')

// ── Token refresh helper ────────────────────────────────────────────
export async function refreshSquareToken(refreshToken: string) {
  const res = await fetch(`${SQUARE_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env('SQUARE_APP_ID'),
      client_secret: env('SQUARE_APP_SECRET'),
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Square token refresh failed: ${res.status} ${text}`)
  }

  return res.json() as Promise<{
    access_token: string
    refresh_token: string
    expires_at: string
  }>
}

// ── Auth helpers ────────────────────────────────────────────────────
// Used by sync, disconnect, and auth routes to verify the calling user.

/** Extract Supabase access token from Authorization header, cookie, or query param */
export function extractToken(req: VercelRequest): string | null {
  // 1. Authorization: Bearer <token>
  const authHeader = req.headers.authorization
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  // 2. sb-access-token cookie
  const cookieHeader = req.headers.cookie
  if (typeof cookieHeader === 'string') {
    const match = cookieHeader.match(/(?:^|;\s*)sb-access-token=([^;]+)/)
    if (match) return match[1]
  }

  // 3. token query param (for GET redirects like /api/square/auth)
  const queryToken = req.query.token
  if (typeof queryToken === 'string' && queryToken.length > 0) {
    return queryToken
  }

  return null
}

/**
 * Verify the Supabase auth token and return the user.
 * Uses the service-role client to validate the JWT — this avoids
 * needing a separate anon key env var on Vercel.
 * Returns { user } on success or { error, status } on failure.
 */
export async function verifyUser(token: string): Promise<
  | { user: { id: string; email?: string }; error?: never; status?: never }
  | { user?: never; error: string; status: number }
> {
  const db = supabaseAdmin()
  const { data: { user }, error } = await db.auth.getUser(token)
  if (!user || error) {
    return { error: 'Unauthorized', status: 401 }
  }
  return { user: { id: user.id, email: user.email ?? undefined } }
}

/**
 * Check that the authenticated user belongs to the given org.
 *
 * Uses a user-scoped Supabase client (with the caller's JWT) and queries
 * the `organizations` table. RLS on that table requires the user to be
 * in org_members — so if the row comes back, membership is proven.
 *
 * This approach piggybacks on the same RLS policies that already work
 * in the frontend, avoiding any service-role edge cases.
 */
export async function checkOrgAccess(
  accessToken: string,
  orgId: string,
): Promise<boolean> {
  const userDb = supabaseAsUser(accessToken)

  const { data, error } = await userDb
    .from('organizations')
    .select('id')
    .eq('id', orgId)
    .maybeSingle()


  if (error || !data) return false
  return true
}

// ── Token encryption (AES-256-GCM) ──────────────────────────────────
// ENCRYPTION_KEY must be a 64-char hex string (32 bytes).
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12       // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16 // 128-bit auth tag

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns base64 string: iv (12 B) + authTag (16 B) + ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = Buffer.from(env('ENCRYPTION_KEY'), 'hex')
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

/**
 * Decrypt a value produced by encrypt().
 * Expects base64 string: iv (12 B) + authTag (16 B) + ciphertext
 */
export function decrypt(ciphertext: string): string {
  const key = Buffer.from(env('ENCRYPTION_KEY'), 'hex')
  const buf = Buffer.from(ciphertext, 'base64')
  const iv = buf.subarray(0, IV_LENGTH)
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)
  return decipher.update(encrypted) + decipher.final('utf8')
}

// ── OAuth state HMAC signing ──────────────────────────────────────

function getStateSecret() { return env('SQUARE_ENCRYPTION_KEY') }

export function signState(payload: object): string {
  const json = JSON.stringify(payload)
  const sig = createHmac('sha256', getStateSecret()).update(json).digest('base64url')
  const data = Buffer.from(json).toString('base64url')
  return `${data}.${sig}`
}

export function verifyState(signed: string): { org_id: string; venue_id: string } | null {
  const [data, sig] = signed.split('.')
  if (!data || !sig) return null
  const json = Buffer.from(data, 'base64url').toString()
  const expected = createHmac('sha256', getStateSecret()).update(json).digest('base64url')
  if (sig !== expected) return null
  return JSON.parse(json)
}
