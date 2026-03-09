/**
 * Email Ingestion Service (Stub)
 *
 * This module defines the interfaces and stubs for the email-based invoice
 * ingestion pipeline. The actual webhook endpoint is at /api/inbound-email.
 *
 * TODO: Connect this to a real inbound email provider (e.g. SendGrid Inbound
 * Parse, Postmark, or a dedicated @invoices.supersolt.app address).
 */

import type { Supplier } from '@/types'

// ── Inbound email shape (from webhook payload) ────────────────────────

export interface InboundEmailAttachment {
  filename: string
  content_type: string
  content_base64: string
  size: number
}

export interface InboundEmail {
  from: string
  to: string
  subject: string
  text_body?: string
  html_body?: string
  attachments: InboundEmailAttachment[]
  received_at: string
}

// ── Sender → supplier matching ────────────────────────────────────────

/**
 * Matches a sender email address to a known supplier using
 * the `invoice_email_domains` column on the suppliers table.
 *
 * Example: sender 'invoices@bidfood.com.au' matches supplier
 * with invoice_email_domains = ['@bidfood.com.au']
 */
export function matchSenderToSupplier(
  senderEmail: string,
  suppliers: Supplier[],
): Supplier | null {
  const lowerSender = senderEmail.toLowerCase()

  for (const supplier of suppliers) {
    const domains = (supplier as Supplier & { invoice_email_domains?: string[] }).invoice_email_domains
    if (!domains || domains.length === 0) continue

    for (const domain of domains) {
      const lowerDomain = domain.toLowerCase()
      // Match on @domain.com.au suffix or exact email
      if (lowerDomain.startsWith('@')) {
        if (lowerSender.endsWith(lowerDomain)) return supplier
      } else {
        if (lowerSender === lowerDomain) return supplier
      }
    }
  }

  return null
}

// ── Main pipeline entry point (stub) ─────────────────────────────────

/**
 * Processes an inbound email for invoice extraction.
 *
 * TODO: Implement full pipeline:
 *  1. matchSenderToSupplier → get supplier_id
 *  2. For each PDF/image attachment: call parseInvoice()
 *  3. Run matchLineItems() on extracted line items
 *  4. Insert invoice + line items via addInvoice()
 *  5. Notify venue staff via real-time channel
 */
export async function processInboundEmail(email: InboundEmail): Promise<void> {
  console.log('[emailIngestion] Received inbound email from:', email.from)
  console.log('[emailIngestion] Subject:', email.subject)
  console.log('[emailIngestion] Attachments:', email.attachments.length)

  // TODO: implement full pipeline
  // const supplier = matchSenderToSupplier(email.from, suppliers)
  // if (!supplier) { ... }
  // for (const attachment of email.attachments) { ... }
}
