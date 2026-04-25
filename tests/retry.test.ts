/**
 * Tests for retry logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { InfomanceClient } from '../src/index';
import { server, sampleListResponse, TEST_BASE_URL } from './setup';
import {
  calculateBackoffDelay,
  DEFAULT_RETRY_CONFIG,
} from '../src/retry';

describe('Retry Logic', () => {
  let requestCount: number;

  beforeEach(() => {
    requestCount = 0;
  });

  it('should retry on 500 error', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, () => {
        requestCount++;
        if (requestCount < 3) {
          return HttpResponse.json({ detail: 'Server error' }, { status: 500 });
        }
        return HttpResponse.json(sampleListResponse);
      })
    );

    const client = new InfomanceClient({
      apiKey: 'test_key',
      baseUrl: TEST_BASE_URL,
      retry: {
        maxRetries: 3,
        initialDelay: 10,
        backoffFactor: 1,
        jitter: false,
      },
    });

    const result = await client.listMunicipalities();

    expect(requestCount).toBe(3);
    expect(result.items[0].ibge_code).toBe('3550308');
  });

  it('should retry on 503 error', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, () => {
        requestCount++;
        if (requestCount < 2) {
          return HttpResponse.json(
            { detail: 'Service unavailable' },
            { status: 503 }
          );
        }
        return HttpResponse.json(sampleListResponse);
      })
    );

    const client = new InfomanceClient({
      apiKey: 'test_key',
      baseUrl: TEST_BASE_URL,
      retry: {
        maxRetries: 3,
        initialDelay: 10,
        jitter: false,
      },
    });

    const result = await client.listMunicipalities();

    expect(requestCount).toBe(2);
    expect(result.items[0].ibge_code).toBe('3550308');
  });

  it('should retry on 429 error', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, () => {
        requestCount++;
        if (requestCount < 2) {
          return HttpResponse.json(
            { detail: 'Rate limit exceeded' },
            { status: 429, headers: { 'Retry-After': '1' } }
          );
        }
        return HttpResponse.json(sampleListResponse);
      })
    );

    const client = new InfomanceClient({
      apiKey: 'test_key',
      baseUrl: TEST_BASE_URL,
      retry: {
        maxRetries: 3,
        initialDelay: 10,
        jitter: false,
      },
    });

    const result = await client.listMunicipalities();

    expect(requestCount).toBe(2);
    expect(result.items).toHaveLength(1);
  });

  it('should not retry on 401 error', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, () => {
        requestCount++;
        return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 });
      })
    );

    const client = new InfomanceClient({
      apiKey: 'test_key',
      baseUrl: TEST_BASE_URL,
      retry: {
        maxRetries: 3,
        initialDelay: 10,
      },
    });

    await expect(client.listMunicipalities()).rejects.toThrow();

    expect(requestCount).toBe(1);
  });

  it('should not retry on 404 error', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, () => {
        requestCount++;
        return HttpResponse.json({ detail: 'Not found' }, { status: 404 });
      })
    );

    const client = new InfomanceClient({
      apiKey: 'test_key',
      baseUrl: TEST_BASE_URL,
      retry: {
        maxRetries: 3,
        initialDelay: 10,
      },
    });

    await expect(client.listMunicipalities()).rejects.toThrow();

    expect(requestCount).toBe(1);
  });

  it('should not retry on 400 error', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, () => {
        requestCount++;
        return HttpResponse.json(
          { detail: 'Bad request' },
          { status: 400 }
        );
      })
    );

    const client = new InfomanceClient({
      apiKey: 'test_key',
      baseUrl: TEST_BASE_URL,
      retry: {
        maxRetries: 3,
        initialDelay: 10,
      },
    });

    await expect(client.listMunicipalities()).rejects.toThrow();

    expect(requestCount).toBe(1);
  });

  it('should respect max retries', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, () => {
        requestCount++;
        return HttpResponse.json({ detail: 'Server error' }, { status: 500 });
      })
    );

    const client = new InfomanceClient({
      apiKey: 'test_key',
      baseUrl: TEST_BASE_URL,
      retry: {
        maxRetries: 2,
        initialDelay: 10,
        jitter: false,
      },
    });

    await expect(client.listMunicipalities()).rejects.toThrow();

    // Initial request + 2 retries = 3 total
    expect(requestCount).toBe(3);
  });

  it('should disable retries when maxRetries is 0', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, () => {
        requestCount++;
        return HttpResponse.json({ detail: 'Server error' }, { status: 500 });
      })
    );

    const client = new InfomanceClient({
      apiKey: 'test_key',
      baseUrl: TEST_BASE_URL,
      retry: { maxRetries: 0 },
    });

    await expect(client.listMunicipalities()).rejects.toThrow();

    expect(requestCount).toBe(1);
  });

  it('should call logger on retry', async () => {
    const warnSpy = vi.fn();
    const logger = { warn: warnSpy };

    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, () => {
        requestCount++;
        if (requestCount < 2) {
          return HttpResponse.json({ detail: 'Server error' }, { status: 500 });
        }
        return HttpResponse.json(sampleListResponse);
      })
    );

    const client = new InfomanceClient({
      apiKey: 'test_key',
      baseUrl: TEST_BASE_URL,
      retry: {
        maxRetries: 3,
        initialDelay: 10,
        jitter: false,
      },
      logger,
    });

    await client.listMunicipalities();

    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toContain('retrying');
  });

  it('should use exponential backoff', async () => {
    const delays: number[] = [];
    let lastRequestTime = Date.now();

    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, () => {
        requestCount++;
        const now = Date.now();
        if (requestCount > 1) {
          delays.push(now - lastRequestTime);
        }
        lastRequestTime = now;

        if (requestCount < 3) {
          return HttpResponse.json({ detail: 'Server error' }, { status: 500 });
        }
        return HttpResponse.json(sampleListResponse);
      })
    );

    const client = new InfomanceClient({
      apiKey: 'test_key',
      baseUrl: TEST_BASE_URL,
      retry: {
        maxRetries: 3,
        initialDelay: 50,
        backoffFactor: 2,
        jitter: false,
      },
    });

    await client.listMunicipalities();

    expect(requestCount).toBe(3);
    // First retry delay should be around 50ms
    expect(delays[0]).toBeGreaterThanOrEqual(40);
    // Second retry delay should be around 100ms (50 * 2)
    expect(delays[1]).toBeGreaterThanOrEqual(80);
  });
});

describe('Retry Configuration', () => {
  it('should use default retry config', () => {
    const client = new InfomanceClient({
      apiKey: 'test_key',
    });

    // Client should be created with defaults
    expect(client).toBeInstanceOf(InfomanceClient);
  });

  it('should merge partial retry config with defaults', () => {
    const client = new InfomanceClient({
      apiKey: 'test_key',
      retry: {
        maxRetries: 5,
      },
    });

    expect(client).toBeInstanceOf(InfomanceClient);
  });
});

describe('Retry-After integration', () => {
  let requestCount: number;
  let requestTimestamps: number[];

  beforeEach(() => {
    requestCount = 0;
    requestTimestamps = [];
  });

  it('should use Retry-After header value in retry delay calculation', async () => {
    const retryAfterSeconds = 3;

    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, () => {
        requestCount++;
        requestTimestamps.push(Date.now());

        if (requestCount < 2) {
          return HttpResponse.json(
            { detail: 'Rate limit exceeded' },
            {
              status: 429,
              headers: {
                'Retry-After': String(retryAfterSeconds),
              },
            }
          );
        }
        return HttpResponse.json(sampleListResponse);
      })
    );

    const client = new InfomanceClient({
      apiKey: 'test_key',
      baseUrl: TEST_BASE_URL,
      retry: {
        maxRetries: 3,
        initialDelay: 100, // Much smaller than Retry-After (3000ms)
        backoffFactor: 2,
        jitter: false,
      },
    });

    await client.listMunicipalities();

    expect(requestCount).toBe(2);
    expect(requestTimestamps).toHaveLength(2);

    // The delay between requests should be at least Retry-After value (3 seconds)
    const actualDelay = requestTimestamps[1] - requestTimestamps[0];
    expect(actualDelay).toBeGreaterThanOrEqual(retryAfterSeconds * 1000);
  });

  it('should use Retry-After even when larger than maxDelay (capped by maxDelay)', async () => {
    const retryAfterSeconds = 5; // Server says wait 5 seconds
    const maxDelay = 1000; // But maxDelay caps at 1 second

    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, () => {
        requestCount++;
        requestTimestamps.push(Date.now());

        if (requestCount < 2) {
          return HttpResponse.json(
            { detail: 'Rate limit exceeded' },
            {
              status: 429,
              headers: {
                'Retry-After': String(retryAfterSeconds),
              },
            }
          );
        }
        return HttpResponse.json(sampleListResponse);
      })
    );

    const client = new InfomanceClient({
      apiKey: 'test_key',
      baseUrl: TEST_BASE_URL,
      retry: {
        maxRetries: 3,
        initialDelay: 100,
        maxDelay,
        jitter: false,
      },
    });

    await client.listMunicipalities();

    expect(requestCount).toBe(2);

    // The delay should be capped at maxDelay (not Retry-After which is larger)
    const actualDelay = requestTimestamps[1] - requestTimestamps[0];
    expect(actualDelay).toBeGreaterThanOrEqual(maxDelay);
    // Should not exceed maxDelay by too much (allow some tolerance for test execution)
    expect(actualDelay).toBeLessThan(maxDelay + 500);
  });
});

describe('calculateBackoffDelay', () => {
  it('should respect Retry-After header over backoff', () => {
    const config = { ...DEFAULT_RETRY_CONFIG, initialDelay: 100, jitter: false };
    const delay = calculateBackoffDelay(0, config, 5); // 5 seconds
    expect(delay).toBeGreaterThanOrEqual(5000); // Must be at least 5s
  });

  it('should use backoff when Retry-After is smaller', () => {
    const config = {
      ...DEFAULT_RETRY_CONFIG,
      initialDelay: 1000,
      backoffFactor: 2,
      jitter: false,
    };
    // Attempt 2: 1000 * 2^2 = 4000ms, Retry-After = 1s = 1000ms
    // Should use the larger value (4000ms)
    const delay = calculateBackoffDelay(2, config, 1);
    expect(delay).toBe(4000);
  });

  it('should use Retry-After when larger than backoff', () => {
    const config = {
      ...DEFAULT_RETRY_CONFIG,
      initialDelay: 100,
      backoffFactor: 2,
      jitter: false,
    };
    // Attempt 0: 100ms backoff, Retry-After = 10s = 10000ms
    // Should use the larger value (10000ms)
    const delay = calculateBackoffDelay(0, config, 10);
    expect(delay).toBe(10000);
  });

  it('should cap Retry-After at maxDelay', () => {
    const config = {
      ...DEFAULT_RETRY_CONFIG,
      initialDelay: 100,
      maxDelay: 5000,
      jitter: false,
    };
    // Retry-After = 60s = 60000ms, but maxDelay = 5000ms
    const delay = calculateBackoffDelay(0, config, 60);
    expect(delay).toBe(5000);
  });

  it('should ignore invalid Retry-After values', () => {
    const config = { ...DEFAULT_RETRY_CONFIG, initialDelay: 100, jitter: false };
    // Zero or negative Retry-After should be ignored
    const delay = calculateBackoffDelay(0, config, 0);
    expect(delay).toBe(100);
  });

  it('should fall back to backoff when Retry-After is undefined', () => {
    const config = { ...DEFAULT_RETRY_CONFIG, initialDelay: 200, jitter: false };
    const delay = calculateBackoffDelay(0, config, undefined);
    expect(delay).toBe(200);
  });
});
