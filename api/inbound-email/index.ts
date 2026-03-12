/**
 * POST /api/inbound-email
 *
 * Stub webhook for inbound email invoice ingestion.
 *
 * TODO: Configure your email provider (SendGrid Inbound Parse, Postmark, etc.)
 * to POST parsed emails to this endpoint.
 *
 * TODO: Add signature verification for your chosen email provider.
 * TODO: Implement full pipeline via processInboundEmail().
 */

import type { VercelRequest, VercelResponse } from '../square/_lib.js'
import type { InboundEmail } from '../../src/lib/services/emailIngestion.js'
import { processInboundEmail } from '../../src/lib/services/emailIngestion.js'

const MAX_BODY_BYTES = 10 * 1024 * 1024 // 10 MB

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Reject oversized requests before any processing
  const contentLength = parseInt(req.headers['content-length'] ?? '0', 10)
  if (contentLength > MAX_BODY_BYTES) {
    return res.status(413).json({ error: 'Request body too large. Maximum size is 10MB.' })
  }

  // TODO: Verify webhook signature from your email provider
  // const signature = req.headers['x-sendgrid-signature'] or similar
  // if (!verifySignature(req, signature)) return res.status(401).json({ error: 'Invalid signature' })

  try {
    const body = req.body as InboundEmail

    if (!body?.from || !body?.to) {
      return res.status(400).json({ error: 'Invalid email payload — missing from/to fields' })
    }

    // Process the inbound email (currently a stub — logs and returns)
    await processInboundEmail(body)

    return res.status(200).json({ ok: true })
  } catch (err: unknown) {
    console.error('[inbound-email] Unhandled error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg || 'Internal server error' })
  }
}
