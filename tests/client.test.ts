/**
 * Tests for InfomanceClient.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  InfomanceClient,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  ServerError,
} from '../src/index';
import {
  server,
  sampleMunicipalityResponse,
  sampleEconomicResponse,
  sampleInfrastructureResponse,
  sampleListResponse,
  TEST_BASE_URL,
} from './setup';

describe('InfomanceClient', () => {
  let client: InfomanceClient;

  beforeEach(() => {
    client = new InfomanceClient({
      apiKey: 'test_api_key',
      baseUrl: TEST_BASE_URL,
      retry: { maxRetries: 0 }, // Disable retries for tests
    });
  });

  describe('Initialization', () => {
    it('should create client with API key', () => {
      const c = new InfomanceClient({ apiKey: 'my_api_key' });
      expect(c).toBeInstanceOf(InfomanceClient);
    });

    it('should throw error without API key', () => {
      expect(() => new InfomanceClient({ apiKey: '' })).toThrow(
        'API Key is required'
      );
    });

    it('should use custom base URL', () => {
      const c = new InfomanceClient({
        apiKey: 'key',
        baseUrl: 'https://custom.api.com',
      });
      expect(c).toBeInstanceOf(InfomanceClient);
    });

    it('should use custom timeout', () => {
      const c = new InfomanceClient({
        apiKey: 'key',
        timeout: 60000,
      });
      expect(c).toBeInstanceOf(InfomanceClient);
    });

    it('should accept logger option', () => {
      const logger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      };
      const c = new InfomanceClient({
        apiKey: 'key',
        logger,
      });
      expect(c).toBeInstanceOf(InfomanceClient);
    });
  });

  describe('listMunicipalities', () => {
    it('should fetch list of municipalities', async () => {
      const result = await client.listMunicipalities();

      expect(result.items).toHaveLength(1);
      expect(result.items[0].ibge_code).toBe('3550308');
      expect(result.items[0].name).toBe('Sao Paulo');
    });

    it('should track rate limit from response headers', async () => {
      await client.listMunicipalities();

      expect(client.rateLimit).toBeDefined();
      expect(client.rateLimit?.limit).toBe(1000);
      expect(client.rateLimit?.remaining).toBe(999);
      expect(client.rateLimit?.resetDate).toBeInstanceOf(Date);
    });

    it('should track request ID', async () => {
      await client.listMunicipalities();

      expect(client.lastRequestId).toBe('req_test123');
    });
  });

  describe('getMunicipality', () => {
    it('should fetch municipality by IBGE code', async () => {
      const result = await client.getMunicipality('3550308');

      expect(result.ibge_code).toBe('3550308');
      expect(result.name).toBe('Sao Paulo');
      expect(result.population).toBe(12396372);
    });

    it('should throw NotFoundError for unknown municipality', async () => {
      await expect(client.getMunicipality('0000000')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('getMunicipalityEconomic', () => {
    it('should fetch economic data', async () => {
      const result = await client.getMunicipalityEconomic('3550308');

      expect(result.pib).toBe(763782000000);
      expect(result.year).toBe(2021);
    });
  });

  describe('getMunicipalityInfrastructure', () => {
    it('should fetch infrastructure data', async () => {
      const result = await client.getMunicipalityInfrastructure('3550308');

      expect(result.water_coverage).toBe(99.8);
      expect(result.year).toBe(2022);
    });
  });

  describe('Error Handling', () => {
    it('should throw AuthenticationError for 401', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, () => {
          return HttpResponse.json(
            { detail: 'API Key invalida' },
            { status: 401 }
          );
        })
      );

      await expect(client.listMunicipalities()).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should throw ForbiddenError for 403', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, () => {
          return HttpResponse.json(
            { detail: 'Plano Pro necessario', required_plan: 'Pro' },
            { status: 403 }
          );
        })
      );

      await expect(client.listMunicipalities()).rejects.toThrow(ForbiddenError);
    });

    it('should throw RateLimitError for 429', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, () => {
          return HttpResponse.json(
            { detail: 'Rate limit exceeded' },
            {
              status: 429,
              headers: { 'Retry-After': '60' },
            }
          );
        })
      );

      try {
        await client.listMunicipalities();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).retryAfter).toBe(60);
        expect((error as RateLimitError).isRetryable).toBe(true);
      }
    });

    it('should throw ValidationError for 400', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, () => {
          return HttpResponse.json(
            {
              detail: 'Parametros invalidos',
              errors: [{ field: 'state', message: 'campo obrigatorio' }],
            },
            { status: 400 }
          );
        })
      );

      try {
        await client.listMunicipalities();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).errors).toHaveLength(1);
      }
    });

    it('should throw ServerError for 500', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, () => {
          return HttpResponse.json(
            { detail: 'Internal server error' },
            { status: 500 }
          );
        })
      );

      try {
        await client.listMunicipalities();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ServerError);
        expect((error as ServerError).isRetryable).toBe(true);
      }
    });
  });

  describe('User-Agent Header', () => {
    it('should send User-Agent header', async () => {
      let capturedUserAgent: string | null = null;

      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, ({ request }) => {
          capturedUserAgent = request.headers.get('User-Agent');
          return HttpResponse.json(sampleListResponse);
        })
      );

      await client.listMunicipalities();

      expect(capturedUserAgent).toMatch(/^infomance-js\/1\.0\.0/);
    });

    it('should include custom User-Agent suffix', async () => {
      const customClient = new InfomanceClient({
        apiKey: 'test_key',
        baseUrl: TEST_BASE_URL,
        userAgent: 'my-app/1.0',
        retry: { maxRetries: 0 },
      });

      let capturedUserAgent: string | null = null;

      server.use(
        http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, ({ request }) => {
          capturedUserAgent = request.headers.get('User-Agent');
          return HttpResponse.json(sampleListResponse);
        })
      );

      await customClient.listMunicipalities();

      expect(capturedUserAgent).toBe('infomance-js/1.0.0 my-app/1.0');
    });
  });
});
