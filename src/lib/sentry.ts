/**
 * Sentry initialization for error tracking.
 * DSN is loaded from VITE_SENTRY_DSN env var.
 * If no DSN is configured, Sentry is disabled (no-op).
 */
import * as Sentry from '@sentry/react'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || ''

export function initSentry() {
  if (!SENTRY_DSN) {
    console.log('[Sentry] No DSN configured — error tracking disabled')
    return
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE || 'development',
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    // Performance monitoring — sample 10% of transactions in production
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    // Only send errors in production
    enabled: import.meta.env.PROD || !!import.meta.env.VITE_SENTRY_DSN,
    // Don't send PII
    sendDefaultPii: false,
    // Ignore common non-actionable errors
    ignoreErrors: [
      'ResizeObserver loop',
      'Non-Error promise rejection',
      'Network request failed',
      'Load failed',
    ],
  })

  console.log('[Sentry] Initialized')
}

export { Sentry }
