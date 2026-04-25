/**
 * Test setup for Infomance SDK tests.
 */

import { afterAll, afterEach, beforeAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Sample response data
export const sampleMunicipalityResponse = {
  ibge_code: '3550308',
  name: 'Sao Paulo',
  state: 'SP',
  region: 'Sudeste',
  population: 12396372,
  pib: 763782000000,
  pib_per_capita: 61618,
  area_km2: 1521.11,
};

export const sampleEconomicResponse = {
  pib: 763782000000,
  pib_per_capita: 61618,
  agriculture: 102000000,
  industry: 152390000000,
  services: 549290000000,
  taxes: 62000000000,
  year: 2021,
};

export const sampleInfrastructureResponse = {
  water_coverage: 99.8,
  sewage_collection: 92.4,
  sewage_treatment: 85.6,
  water_loss: 32.1,
  internet_accesses: 5200000,
  fiber_coverage: 78.5,
  year: 2022,
};

export const sampleListResponse = {
  items: [sampleMunicipalityResponse],
  total: 1,
  limit: 10,
  offset: 0,
};

// Base URL for tests
export const TEST_BASE_URL = 'https://api.test.infomance.com.br';

// Default handlers
export const handlers = [
  // List Municipalities - Success
  http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities`, () => {
    return HttpResponse.json(sampleListResponse, {
      headers: {
        'X-RateLimit-Limit': '1000',
        'X-RateLimit-Remaining': '999',
        'X-RateLimit-Reset': '1704067200',
        'X-Request-ID': 'req_test123',
      },
    });
  }),

  // Get Municipality - Success
  http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities/:ibgeCode`, ({ params }) => {
    const { ibgeCode } = params;

    if (ibgeCode === '0000000') {
      return HttpResponse.json(
        { detail: 'Municipality not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json(sampleMunicipalityResponse, {
      headers: {
        'X-Request-ID': `req_${ibgeCode}`,
      },
    });
  }),

  // Get Municipality Economic - Success
  http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities/:ibgeCode/economic`, () => {
    return HttpResponse.json(sampleEconomicResponse);
  }),

  // Get Municipality Infrastructure - Success
  http.get(`${TEST_BASE_URL}/api/v1/indicators/municipalities/:ibgeCode/infrastructure`, () => {
    return HttpResponse.json(sampleInfrastructureResponse);
  }),

  // 401 Unauthorized
  http.get(`${TEST_BASE_URL}/api/v1/auth-error`, () => {
    return HttpResponse.json(
      { detail: 'API Key invalida' },
      { status: 401 }
    );
  }),

  // 403 Forbidden
  http.get(`${TEST_BASE_URL}/api/v1/forbidden`, () => {
    return HttpResponse.json(
      { detail: 'Plano Pro necessario', required_plan: 'Pro' },
      { status: 403 }
    );
  }),

  // 429 Rate Limit
  http.get(`${TEST_BASE_URL}/api/v1/rate-limit`, () => {
    return HttpResponse.json(
      { detail: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': '1000',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': '1704067260',
        },
      }
    );
  }),

  // 500 Server Error
  http.get(`${TEST_BASE_URL}/api/v1/server-error`, () => {
    return HttpResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }),

  // Validation Error
  http.get(`${TEST_BASE_URL}/api/v1/validation-error`, () => {
    return HttpResponse.json(
      {
        detail: 'Validation failed',
        errors: [{ field: 'ibge_code', message: 'Invalid format' }],
      },
      { status: 400 }
    );
  }),
];

// Create and export server
export const server = setupServer(...handlers);

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Close server after all tests
afterAll(() => server.close());
