/**
 * Shared helpers for Xero API routes.
 * Used by all /api/xero/* serverless functions.
 *
 * ENV VARS REQUIRED (set in Vercel dashboard):
 *   XERO_CLIENT_ID         — from Xero Developer portal (My Apps > OAuth 2.0 credentials)
 *   XERO_CLIENT_SECRET     — from Xero Developer portal
 *   XERO_REDIRECT_URI      — must match exactly: https://your-domain.vercel.app/api/xero/callback
 *   ENCRYPTION_KEY         — 64-char hex string (shared with Square — same AES-256-GCM key)
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   APP_URL                — https://your-domain.vercel.app
 */

import { createClient } from "@supabase/supabase-js";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHmac,
} from "crypto";

// ── Vercel handler types ─────────────────────────────────────────────
import type { IncomingMessage, ServerResponse } from "http";

export interface VercelRequest extends IncomingMessage {
  query: Record<string, string | string[]>;
  body: unknown;
}

export interface VercelResponse extends ServerResponse {
  status(code: number): VercelResponse;
  json(body: unknown): VercelResponse;
  send(body: unknown): VercelResponse;
  redirect(statusOrUrl: string | number, url?: string): VercelResponse;
}

// ── Environment helpers ─────────────────────────────────────────────
export function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

// ── Supabase clients ────────────────────────────────────────────────
export function supabaseAdmin() {
  return createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

export function supabaseAsUser(accessToken: string) {
  return createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

// ── Xero API base URL ───────────────────────────────────────────────
// Xero does not have a separate sandbox — use a test organisation instead.
export const XERO_API_BASE = "https://api.xero.com";
export const XERO_OAUTH_BASE = "https://login.xero.com/identity/connect";

// Xero OAuth scopes required for SuperSolt sync:
// openid profile email — user identity
// accounting.transactions — create/read invoices, bills, journals
// accounting.accounts.read — read chart of accounts
// accounting.contacts.read — read suppliers/customers
// offline_access — refresh token support
export const XERO_SCOPES = [
  "openid",
  "profile",
  "email",
  "accounting.transactions",
  "accounting.accounts.read",
  "accounting.contacts.read",
  "offline_access",
].join(" ");

// ── Token encryption (AES-256-GCM) ─────────────────────────────────
// Identical scheme to Square — ENCRYPTION_KEY is shared.
// iv (12 B) + authTag (16 B) + ciphertext → base64

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export function encrypt(plaintext: string): string {
  const key = Buffer.from(env("ENCRYPTION_KEY"), "hex");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(ciphertext: string): string {
  const key = Buffer.from(env("ENCRYPTION_KEY"), "hex");
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

// ── OAuth state HMAC signing ────────────────────────────────────────
// Prevents CSRF — state is signed with XERO_CLIENT_SECRET.
export function signState(payload: Record<string, string>): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString("base64url");
  const sig = createHmac("sha256", env("XERO_CLIENT_SECRET"))
    .update(b64)
    .digest("hex");
  return `${b64}.${sig}`;
}

export function verifyState(signed: string): Record<string, string> {
  const [b64, sig] = signed.split(".");
  if (!b64 || !sig) throw new Error("Malformed state");
  const expected = createHmac("sha256", env("XERO_CLIENT_SECRET"))
    .update(b64)
    .digest("hex");
  if (sig !== expected)
    throw new Error("State signature mismatch — possible CSRF");
  return JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
}

// ── Auth helpers ────────────────────────────────────────────────────

export function extractToken(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader === "string") {
    const match = cookieHeader.match(/(?:^|;\s*)sb-access-token=([^;]+)/);
    if (match) return match[1];
  }
  const queryToken = req.query.token;
  if (typeof queryToken === "string" && queryToken.length > 0) {
    return queryToken;
  }
  return null;
}

export async function verifyUser(
  token: string,
): Promise<
  | { user: { id: string; email?: string }; error?: never; status?: never }
  | { user?: never; error: string; status: number }
> {
  const db = supabaseAdmin();
  const {
    data: { user },
    error,
  } = await db.auth.getUser(token);
  if (!user || error) {
    return { error: "Unauthorized", status: 401 };
  }
  return { user: { id: user.id, email: user.email ?? undefined } };
}

export async function checkOrgAccess(
  accessToken: string,
  orgId: string,
): Promise<boolean> {
  const userDb = supabaseAsUser(accessToken);
  const { data, error } = await userDb
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .maybeSingle();
  if (error || !data) return false;
  return true;
}

// ── Token refresh helper ────────────────────────────────────────────
export async function refreshXeroToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const credentials = Buffer.from(
    `${env("XERO_CLIENT_ID")}:${env("XERO_CLIENT_SECRET")}`,
  ).toString("base64");

  const res = await fetch(`${XERO_OAUTH_BASE}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero token refresh failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
}

// ── Default AU hospitality account mappings ─────────────────────────
// Standard Xero AU chart of accounts codes for hospitality.
// These are seeded on first connection — admin can override via UI.
export const DEFAULT_AU_ACCOUNT_MAPPINGS: Array<{
  supersolt_category: string;
  xero_account_code: string;
  xero_account_name: string;
}> = [
  {
    supersolt_category: "revenue_food",
    xero_account_code: "200",
    xero_account_name: "Sales",
  },
  {
    supersolt_category: "revenue_beverage",
    xero_account_code: "200",
    xero_account_name: "Sales",
  },
  {
    supersolt_category: "cogs_food",
    xero_account_code: "310",
    xero_account_name: "Cost of Goods Sold",
  },
  {
    supersolt_category: "cogs_beverage",
    xero_account_code: "310",
    xero_account_name: "Cost of Goods Sold",
  },
  {
    supersolt_category: "labour_wages",
    xero_account_code: "477",
    xero_account_name: "Wages and Salaries",
  },
  {
    supersolt_category: "labour_super",
    xero_account_code: "478",
    xero_account_name: "Superannuation",
  },
  {
    supersolt_category: "gst_collected",
    xero_account_code: "820",
    xero_account_name: "GST",
  },
  {
    supersolt_category: "gst_paid",
    xero_account_code: "820",
    xero_account_name: "GST",
  },
  {
    supersolt_category: "overhead_rent",
    xero_account_code: "493",
    xero_account_name: "Rent",
  },
  {
    supersolt_category: "overhead_utilities",
    xero_account_code: "489",
    xero_account_name: "Light, Power, Heating",
  },
  {
    supersolt_category: "overhead_marketing",
    xero_account_code: "400",
    xero_account_name: "Advertising and Marketing",
  },
];

// ── Configuration check ──────────────────────────────────────────────
export const XERO_CONFIGURED =
  !!process.env.XERO_CLIENT_ID &&
  !!process.env.XERO_CLIENT_SECRET &&
  !!process.env.XERO_REDIRECT_URI;

export function requireXeroConfig(res: VercelResponse): boolean {
  if (!XERO_CONFIGURED) {
    res.status(503).json({
      error: "Xero integration not configured",
      message:
        "Set XERO_CLIENT_ID, XERO_CLIENT_SECRET, and XERO_REDIRECT_URI in Vercel environment variables.",
    });
    return false;
  }
  return true;
}
