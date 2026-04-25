/**
 * Retry configuration example for the Infomance SDK.
 *
 * This example demonstrates:
 * - Configuring retry behavior
 * - Understanding exponential backoff
 * - Handling Retry-After headers
 * - Per-request timeout and cancellation
 */

import { InfomanceClient, DEFAULT_RETRY_CONFIG } from 'infomance';

async function main() {
  // Default configuration
  console.log('Default retry config:', DEFAULT_RETRY_CONFIG);
  // {
  //   maxRetries: 3,
  //   initialDelay: 500,
  //   maxDelay: 10000,
  //   backoffFactor: 2,
  //   jitter: true,
  //   retryableStatuses: [429, 500, 502, 503, 504]
  // }

  // Custom retry configuration
  const client = new InfomanceClient({
    apiKey: 'your-api-key',
    retry: {
      maxRetries: 5, // More retries for unstable connections
      initialDelay: 1000, // Start with 1s delay
      maxDelay: 30000, // Cap at 30s
      backoffFactor: 2, // Double delay each retry
      jitter: true, // Add randomness to prevent thundering herd
    },
  });

  // Retry delays will be approximately:
  // Retry 1: 1000ms + jitter
  // Retry 2: 2000ms + jitter
  // Retry 3: 4000ms + jitter
  // Retry 4: 8000ms + jitter
  // Retry 5: 16000ms + jitter

  // Disable retries entirely
  const noRetryClient = new InfomanceClient({
    apiKey: 'your-api-key',
    retry: { maxRetries: 0 },
  });

  // Aggressive retry for time-sensitive operations
  const aggressiveClient = new InfomanceClient({
    apiKey: 'your-api-key',
    retry: {
      maxRetries: 10,
      initialDelay: 100,
      maxDelay: 5000,
      backoffFactor: 1.5,
      jitter: true,
    },
  });

  // Per-request timeout override
  const data = await client.getMunicipality('3550308', {
    timeout: 5000, // 5s timeout for this specific request
  });

  // Request cancellation with AbortSignal
  const controller = new AbortController();

  // Cancel after 2 seconds
  setTimeout(() => controller.abort(), 2000);

  try {
    const result = await client.listMunicipalities(
      { state: 'SP' },
      { signal: controller.signal }
    );
    console.log(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes('aborted')) {
      console.log('Request was cancelled');
    }
  }

  // Combining timeout and signal
  const anotherController = new AbortController();

  const result = await client.getMunicipality('3550308', {
    timeout: 10000, // 10s timeout
    signal: anotherController.signal, // External cancellation
  });
  // Request will fail if either timeout expires or signal is aborted
}

// Example: Custom retry statuses
async function customRetryStatuses() {
  // Only retry on 503 (Service Unavailable)
  const client = new InfomanceClient({
    apiKey: 'your-api-key',
    retry: {
      retryableStatuses: [503],
      maxRetries: 5,
    },
  });

  // This will NOT retry on 500, 502, 504, or 429
  // Only 503 will trigger automatic retries
}

// Example: Understanding Retry-After
async function retryAfterBehavior() {
  // When the server returns a 429 with Retry-After: 60
  // the SDK will wait at least 60 seconds before retrying
  // (or maxDelay if smaller)

  const client = new InfomanceClient({
    apiKey: 'your-api-key',
    retry: {
      maxRetries: 3,
      maxDelay: 30000, // 30s max
      // If server says Retry-After: 60, SDK will wait 30s (capped)
    },
  });
}

main().catch(console.error);
