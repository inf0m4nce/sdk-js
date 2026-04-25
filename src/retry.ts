// ============================================
// Infomance SDK - Retry Configuration
// ============================================

/**
 * Configuration for automatic retry behavior.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Initial delay in ms between retries (default: 500) */
  initialDelay: number;
  /** Maximum delay in ms between retries (default: 10000) */
  maxDelay: number;
  /** Backoff factor for exponential backoff (default: 2) */
  backoffFactor: number;
  /** Whether to add random jitter to delays (default: true) */
  jitter: boolean;
  /** Status codes that trigger automatic retry (default: [429, 500, 502, 503, 504]) */
  retryableStatuses: number[];
}

/**
 * Default retry configuration.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 500,
  maxDelay: 10000,
  backoffFactor: 2,
  jitter: true,
  retryableStatuses: [429, 500, 502, 503, 504],
};

/**
 * Calculate delay for a given retry attempt using exponential backoff.
 *
 * @param attempt - The current retry attempt (0-indexed)
 * @param config - Retry configuration
 * @param retryAfterSeconds - Optional Retry-After header value in seconds
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig,
  retryAfterSeconds?: number
): number {
  // Exponential backoff: initialDelay * (backoffFactor ^ attempt)
  const exponentialDelay =
    config.initialDelay * Math.pow(config.backoffFactor, attempt);

  // If Retry-After was provided, use the greater of Retry-After or backoff
  let baseDelay: number;
  if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
    const retryAfterMs = retryAfterSeconds * 1000;
    baseDelay = Math.max(retryAfterMs, exponentialDelay);
  } else {
    baseDelay = exponentialDelay;
  }

  // Cap at maxDelay
  const cappedDelay = Math.min(baseDelay, config.maxDelay);

  // Add jitter if enabled (random value between 0 and 50% of delay)
  if (config.jitter) {
    const jitterRange = cappedDelay * 0.5;
    const jitterValue = Math.random() * jitterRange;
    return Math.floor(cappedDelay + jitterValue);
  }

  return Math.floor(cappedDelay);
}

/**
 * Check if a status code should trigger a retry.
 *
 * @param status - HTTP status code
 * @param config - Retry configuration
 * @returns Whether the status is retryable
 */
export function isRetryableStatus(status: number, config: RetryConfig): boolean {
  return config.retryableStatuses.includes(status);
}

/**
 * Check if an error is a network or timeout error that should be retried.
 *
 * @param error - The error to check
 * @returns Whether the error is a retryable network error
 */
export function isRetryableNetworkError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    error.name === 'AbortError' ||
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('enotfound')
  );
}

/**
 * Sleep for the specified duration.
 *
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
