import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

/**
 * Initialize Sentry error tracking
 * Only initializes if VITE_SENTRY_DSN is configured
 */
export function initSentry(): void {
  if (!SENTRY_DSN) {
    console.log('Sentry DSN not configured - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,

    // Performance monitoring
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

    // Session replay for debugging
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Filter out non-critical errors
    beforeSend(event) {
      // Filter out network errors that are expected
      if (event.exception?.values?.[0]?.type === 'NetworkError') {
        return null;
      }
      return event;
    },

    // Add tags for filtering
    initialScope: {
      tags: {
        app: 'astroswap-frontend',
        network: import.meta.env.VITE_STELLAR_NETWORK || 'testnet',
      },
    },
  });
}

/**
 * Capture an error with additional context
 */
export function captureError(
  error: Error,
  context?: Record<string, unknown>
): void {
  if (!SENTRY_DSN) {
    console.error('Error (Sentry disabled):', error, context);
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(error);
  });
}

/**
 * Set user context for error tracking
 */
export function setUser(address: string | null): void {
  if (!SENTRY_DSN) return;

  if (address) {
    Sentry.setUser({ id: address });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
): void {
  if (!SENTRY_DSN) return;

  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

export { Sentry };
