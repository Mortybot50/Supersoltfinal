/**
 * Shared helpers for Square API routes.
 * Used by all /api/square/* serverless functions.
 */
import { createClient } from '@supabase/supabase-js'

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

// ── Square API base URL ─────────────────────────────────────────────
export const SQUARE_BASE =
  process.env.SQUARE_ENVIRONMENT === 'sandbox'
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
