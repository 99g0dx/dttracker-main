/**
 * Retry utility with exponential backoff
 * Handles transient network errors and API failures
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  multiplier?: number;
  /** Function to determine if error is retryable (default: retries network errors) */
  shouldRetry?: (error: unknown) => boolean;
  /** Function called before each retry attempt */
  onRetry?: (attempt: number, error: unknown) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  multiplier: 2,
  shouldRetry: () => true,
  onRetry: () => {},
};

/**
 * Check if error is a retryable network error
 */
function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  // Retry on network errors
  if (
    normalized.includes("fetch") ||
    normalized.includes("network") ||
    normalized.includes("timeout") ||
    normalized.includes("connection") ||
    normalized.includes("econnreset") ||
    normalized.includes("enotfound")
  ) {
    return true;
  }

  // Retry on 5xx server errors
  if (normalized.includes("500") || normalized.includes("502") || normalized.includes("503") || normalized.includes("504")) {
    return true;
  }

  // Don't retry on 4xx client errors (except 429 - rate limit)
  if (normalized.includes("400") || normalized.includes("401") || normalized.includes("403") || normalized.includes("404")) {
    return false;
  }

  // Retry on rate limit errors
  if (normalized.includes("429") || normalized.includes("rate limit")) {
    return true;
  }

  return false;
}

/**
 * Calculate delay for exponential backoff
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const delay = options.initialDelay * Math.pow(options.multiplier, attempt);
  return Math.min(delay, options.maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts: Required<RetryOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
    shouldRetry: options.shouldRetry || DEFAULT_OPTIONS.shouldRetry,
    onRetry: options.onRetry || DEFAULT_OPTIONS.onRetry,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      const shouldRetry = opts.shouldRetry(error);
      if (!shouldRetry) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === opts.maxAttempts - 1) {
        throw error;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, opts);
      opts.onRetry(attempt + 1, error);

      if (import.meta.env.DEV) {
        console.warn(
          `Retry attempt ${attempt + 1}/${opts.maxAttempts} after ${delay}ms:`,
          error instanceof Error ? error.message : String(error)
        );
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Retry with default options (retries network errors)
 */
export async function retryOnNetworkError<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  return retry(fn, {
    maxAttempts,
    shouldRetry: isRetryableError,
  });
}

/**
 * Retry with custom retry condition
 */
export async function retryWithCondition<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  maxAttempts: number = 3
): Promise<T> {
  return retry(fn, {
    maxAttempts,
    shouldRetry,
  });
}
