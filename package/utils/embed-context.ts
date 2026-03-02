/**
 * Context about the embedding environment for error reporting (e.g. Sentry).
 * Helps debug issues when dsheet runs inside iframes or different referrers.
 */
export type EmbedContext = {
  /** Whether the app is running inside an iframe */
  isInIframe: boolean;
  /** Parent window URL (or "[cross-origin]" when not readable) */
  parentUrl: string | null;
  /** document.referrer */
  referrer: string;
  /** Current window location href */
  currentUrl: string;
  /** User agent string (may be truncated for privacy) */
  userAgent?: string;
};

/**
 * Safely gathers embed context for Sentry/error reports.
 * Handles cross-origin iframes (parent.location not readable) and SSR (no window).
 */
export function getEmbedContext(): EmbedContext {
  if (typeof window === 'undefined') {
    return {
      isInIframe: false,
      parentUrl: null,
      referrer: '',
      currentUrl: '',
    };
  }

  let isInIframe = false;
  let parentUrl: string | null = null;

  try {
    isInIframe = window.self !== window.top;
    if (isInIframe && window.parent && window.parent !== window.self) {
      parentUrl = window.parent.location.href;
    }
  } catch {
    // Cross-origin iframe: reading parent.location throws
    parentUrl = '[cross-origin]';
  }

  return {
    isInIframe,
    parentUrl,
    referrer: document.referrer || '',
    currentUrl: window.location.href || '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };
}
