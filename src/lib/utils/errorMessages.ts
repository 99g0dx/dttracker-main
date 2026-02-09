/**
 * Centralized error message utility
 * Provides user-friendly error messages and maps technical errors to readable messages
 */

export interface ErrorContext {
  operation?: string;
  resource?: string;
  details?: Record<string, unknown>;
}

/**
 * Common error message mappings
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Authentication errors
  "Session expired": "Your session has expired. Please log in again.",
  "Not authenticated": "You must be logged in to perform this action.",
  "Unauthorized": "You don't have permission to perform this action.",
  "JWT": "Authentication failed. Please log in again.",
  
  // Network errors
  "Failed to fetch": "Unable to connect to the server. Please check your internet connection.",
  "NetworkError": "Network error. Please check your connection and try again.",
  "Network request failed": "Network request failed. Please try again.",
  "CORS": "Connection error. Please refresh the page.",
  "timeout": "Request timed out. Please try again.",
  
  // API errors
  "non-2xx": "Server error. Please try again later.",
  "Edge Function returned": "Service temporarily unavailable. Please try again.",
  "Invalid response": "Invalid response from server. Please try again.",
  
  // Validation errors
  "Invalid URL format": "Please enter a valid URL.",
  "Unsupported link": "This link is not supported. Please use a TikTok, Instagram, YouTube, Twitter, or Facebook link.",
  "Duplicate": "This item already exists.",
  "Required": "This field is required.",
  
  // Resource errors
  "not found": "The requested resource was not found.",
  "already exists": "This item already exists.",
  "insufficient": "Insufficient resources to complete this action.",
  
  // Payment errors
  "payment": "Payment processing error. Please try again.",
  "insufficient balance": "Insufficient balance. Please fund your wallet.",
  
  // Generic fallback
  "Unknown error": "An unexpected error occurred. Please try again.",
};

/**
 * Extract user-friendly error message from error
 */
export function getUserFriendlyError(error: unknown, context?: ErrorContext): string {
  if (!error) {
    return ERROR_MESSAGES["Unknown error"];
  }

  let errorMessage = "";
  
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === "string") {
    errorMessage = error;
  } else {
    errorMessage = String(error);
  }

  // Normalize error message (lowercase for matching)
  const normalizedMessage = errorMessage.toLowerCase();

  // Apify/RapidAPI 403/401 - API config issue, not user auth (check before generic auth mappings)
  if (
    (normalizedMessage.includes("apify") || normalizedMessage.includes("rapidapi")) &&
    (normalizedMessage.includes("403") || normalizedMessage.includes("401"))
  ) {
    return "Scraping API returned an error. Check your APIFY_TOKEN is valid in Supabase Edge Function secrets and your Apify account has access (paid plan may be required for some scrapers).";
  }

  // Check for specific error patterns
  for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
    if (normalizedMessage.includes(key.toLowerCase())) {
      return message;
    }
  }

  // If no match found, return the original message if it's user-friendly
  // Otherwise return a generic message
  if (errorMessage.length < 100 && !errorMessage.includes("Error:") && !errorMessage.includes("at ")) {
    return errorMessage;
  }

  // Add context if available
  if (context?.operation) {
    return `Failed to ${context.operation}. Please try again.`;
  }

  return ERROR_MESSAGES["Unknown error"];
}

/**
 * Create a standardized error object
 */
export function createError(
  message: string,
  context?: ErrorContext
): Error {
  const friendlyMessage = getUserFriendlyError(message, context);
  const error = new Error(friendlyMessage);
  
  // Attach context to error for debugging
  if (import.meta.env.DEV && context) {
    (error as any).context = context;
  }
  
  return error;
}

/**
 * Format error for display in UI
 */
export function formatError(error: unknown, context?: ErrorContext): string {
  return getUserFriendlyError(error, context);
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  
  return (
    normalized.includes("fetch") ||
    normalized.includes("network") ||
    normalized.includes("timeout") ||
    normalized.includes("cors") ||
    normalized.includes("connection")
  );
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (!error) return false;
  
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  
  return (
    normalized.includes("session") ||
    normalized.includes("auth") ||
    normalized.includes("jwt") ||
    normalized.includes("unauthorized") ||
    normalized.includes("not authenticated")
  );
}

/**
 * Get error hint for common errors
 */
export function getErrorHint(error: unknown): string {
  if (isNetworkError(error)) {
    return "Check your internet connection and try again.";
  }
  
  if (isAuthError(error)) {
    return "Please log in again.";
  }
  
  return "";
}
