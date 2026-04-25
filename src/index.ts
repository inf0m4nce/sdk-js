// ============================================
// Infomance SDK
// ============================================
// TypeScript SDK for accessing the Infomance API
// Documentation: https://infomance.com.br/docs

// Types
export * from './types';

// Error classes
export {
  InfomanceError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ServerError,
  TimeoutError,
  NetworkError,
} from './errors';

// Retry configuration
export {
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  calculateBackoffDelay,
  isRetryableStatus,
  isRetryableNetworkError,
} from './retry';

// Client
export {
  InfomanceClient,
  InfomanceClientConfig,
  RateLimitInfo,
  Logger,
  RequestOptions,
} from './client';

// Re-export main class for convenience
export { InfomanceClient as default } from './client';
