/**
 * POST /api/square/webhook
 *
 * Receives real-time events from Square (e.g. payment.completed,
 * order.created). Verifies the HMAC-SHA256 signature, logs the
 * event, and returns 200 immediately to avoid Square retries.
 */
import crypto from 'crypto'
import type { VercelRequest, VercelResponse } from './_lib.js'
import { env } from './_lib.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // ── Verify webhook signature ────────────────────────────────
    const signatureKey = env('SQUARE_WEBHOOK_SIGNATURE_KEY')
    const notificationUrl = `${env('APP_URL')}/api/square/webhook`
    const signature = req.headers['x-square-hmacsha256-signature'] as string

    if (!signature) {
      console.warn('[square/webhook] Missing signature header')
      return res.status(401).json({ error: 'Missing signature' })
    }

    // Square signs: notificationUrl + body
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    const payload = notificationUrl + rawBody

    const expectedSignature = crypto
      .createHmac('sha256', signatureKey)
      .update(payload)
      .digest('base64')

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      console.warn('[square/webhook] Invalid signature')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    // ── Process event ───────────────────────────────────────────
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const eventType = event?.type ?? 'unknown'
    const merchantId = event?.merchant_id ?? 'unknown'

    console.log(`[square/webhook] Event received: ${eventType} for merchant ${merchantId}`)

    // For now, just acknowledge. Future: trigger sync for specific
    // event types like payment.completed or order.updated.
    // The periodic sync cron handles bulk imports; webhooks are for
    // near-real-time updates when needed.

    return res.status(200).json({ received: true })
  } catch (err: any) {
    console.error('[square/webhook] Error:', err)
    // Still return 200 to prevent Square from retrying
    return res.status(200).json({ received: true, error: 'Processing failed' })
  }
}
