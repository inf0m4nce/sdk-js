/**
 * Error handling example for the Infomance SDK.
 *
 * This example demonstrates:
 * - Handling different error types
 * - Accessing error details (requestId, retryAfter, etc.)
 * - Using isRetryable for custom retry logic
 */

import {
  InfomanceClient,
  InfomanceError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ServerError,
  TimeoutError,
  NetworkError,
} from 'infomance';

async function main() {
  const client = new InfomanceClient({
    apiKey: 'your-api-key',
  });

  try {
    const data = await client.getMunicipality('invalid-code');
    console.log(data);
  } catch (error) {
    if (error instanceof NotFoundError) {
      console.log('Municipality not found');
      console.log('Request ID:', error.requestId);
    } else if (error instanceof AuthenticationError) {
      console.log('Invalid or expired API key');
      console.log('Check your credentials at https://infomance.com.br/dashboard');
    } else if (error instanceof ForbiddenError) {
      console.log('Access denied for this resource');
      if (error.requiredPlan) {
        console.log(`Upgrade required: ${error.requiredPlan} plan needed`);
      }
    } else if (error instanceof ValidationError) {
      console.log('Validation error:', error.message);
      if (error.errors) {
        error.errors.forEach((e) => {
          console.log(`  - ${e.field}: ${e.message}`);
        });
      }
    } else if (error instanceof RateLimitError) {
      console.log('Rate limit exceeded');
      if (error.retryAfter) {
        console.log(`Retry after ${error.retryAfter} seconds`);
      }
      console.log(`Limit: ${error.limit}, Remaining: ${error.remaining}`);
    } else if (error instanceof ServerError) {
      console.log('Server error:', error.status);
      console.log('The server is temporarily unavailable');
      if (error.isRetryable) {
        console.log('This error is retryable - try again later');
      }
    } else if (error instanceof TimeoutError) {
      console.log(`Request timed out after ${error.timeoutMs}ms`);
    } else if (error instanceof NetworkError) {
      console.log('Network error:', error.message);
      console.log('Original error:', error.originalError);
    } else if (error instanceof InfomanceError) {
      // Generic API error
      console.log('API Error:', error.message);
      console.log('Status:', error.status);
      console.log('Request ID:', error.requestId);
    } else {
      // Unknown error
      throw error;
    }
  }
}

// Example: Custom retry logic using isRetryable
async function fetchWithCustomRetry(
  client: InfomanceClient,
  ibgeCode: string,
  maxAttempts = 3
) {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await client.getMunicipality(ibgeCode);
    } catch (error) {
      if (error instanceof InfomanceError && error.isRetryable) {
        lastError = error;
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

main().catch(console.error);
