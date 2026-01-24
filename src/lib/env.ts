/**
 * Environment utilities for DTTracker
 */

/**
 * Get the application URL for billing callbacks.
 * Uses VITE_APP_URL in production, falls back to window.location.origin in development.
 */
export function getAppUrl(): string {
  // In production, use the environment variable
  if (import.meta.env.VITE_APP_URL) {
    return import.meta.env.VITE_APP_URL;
  }

  // Fallback to window.location.origin (only safe with test keys)
  return typeof window !== "undefined" ? window.location.origin : "";
}

/**
 * Check if running in local development environment
 */
export function isLocalDevelopment(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  );
}

/**
 * Get the billing callback URL for Paystack redirects.
 * Always uses VITE_APP_URL if set, which is required for live Paystack payments.
 */
export function getBillingCallbackUrl(): string {
  const appUrl = import.meta.env.VITE_APP_URL;

  // If VITE_APP_URL is set, always use it for billing
  if (appUrl) {
    return `${appUrl}/billing/success`;
  }

  // Warn developers when using localhost without production URL
  if (isLocalDevelopment()) {
    console.warn(
      "[Billing] Using localhost for callback URL. " +
        "This only works with Paystack TEST keys. " +
        "Set VITE_APP_URL for live payments."
    );
  }

  return `${window.location.origin}/billing/success`;
}
