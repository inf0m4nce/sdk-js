/**
 * Tests for exception classes.
 */

import { describe, it, expect } from 'vitest';
import {
  InfomanceError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  ServerError,
  TimeoutError,
  NetworkError,
} from '../src/index';

describe('Errors', () => {
  describe('InfomanceError', () => {
    it('should create with message only', () => {
      const error = new InfomanceError('Something went wrong');
      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('InfomanceError');
      expect(error.status).toBeUndefined();
    });

    it('should create with status code', () => {
      const error = new InfomanceError('Error', 500);
      expect(error.status).toBe(500);
    });

    it('should create with request ID', () => {
      const error = new InfomanceError('Error', 500, 'req_123');
      expect(error.requestId).toBe('req_123');
    });

    it('should create with response body', () => {
      const body = { detail: 'Error details' };
      const error = new InfomanceError('Error', 500, undefined, body);
      expect(error.responseBody).toEqual(body);
    });

    it('should be retryable for 5xx errors', () => {
      expect(new InfomanceError('', 500).isRetryable).toBe(true);
      expect(new InfomanceError('', 502).isRetryable).toBe(true);
      expect(new InfomanceError('', 503).isRetryable).toBe(true);
      expect(new InfomanceError('', 504).isRetryable).toBe(true);
    });

    it('should be retryable for 429', () => {
      expect(new InfomanceError('', 429).isRetryable).toBe(true);
    });

    it('should not be retryable for 4xx errors', () => {
      expect(new InfomanceError('', 400).isRetryable).toBe(false);
      expect(new InfomanceError('', 401).isRetryable).toBe(false);
      expect(new InfomanceError('', 403).isRetryable).toBe(false);
      expect(new InfomanceError('', 404).isRetryable).toBe(false);
    });

    it('should be instanceof Error', () => {
      const error = new InfomanceError('Test');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(InfomanceError);
    });
  });

  describe('AuthenticationError', () => {
    it('should have default message', () => {
      const error = new AuthenticationError();
      expect(error.message).toBe('API Key inválida ou expirada');
      expect(error.status).toBe(401);
      expect(error.name).toBe('AuthenticationError');
    });

    it('should accept custom message', () => {
      const error = new AuthenticationError('Token expired');
      expect(error.message).toBe('Token expired');
    });

    it('should be instanceof InfomanceError', () => {
      const error = new AuthenticationError();
      expect(error).toBeInstanceOf(InfomanceError);
    });
  });

  describe('ForbiddenError', () => {
    it('should have default message', () => {
      const error = new ForbiddenError();
      expect(error.message).toBe('Acesso não autorizado para este recurso');
      expect(error.status).toBe(403);
      expect(error.name).toBe('ForbiddenError');
    });

    it('should accept required plan', () => {
      const error = new ForbiddenError('Upgrade needed', 'Pro');
      expect(error.requiredPlan).toBe('Pro');
    });

    it('should be instanceof InfomanceError', () => {
      const error = new ForbiddenError();
      expect(error).toBeInstanceOf(InfomanceError);
    });
  });

  describe('NotFoundError', () => {
    it('should have default message', () => {
      const error = new NotFoundError();
      expect(error.message).toBe('Recurso não encontrado');
      expect(error.status).toBe(404);
      expect(error.name).toBe('NotFoundError');
    });

    it('should be instanceof InfomanceError', () => {
      const error = new NotFoundError();
      expect(error).toBeInstanceOf(InfomanceError);
    });
  });

  describe('RateLimitError', () => {
    it('should have default message', () => {
      const error = new RateLimitError();
      expect(error.message).toBe('Limite de requisições excedido');
      expect(error.status).toBe(429);
      expect(error.name).toBe('RateLimitError');
    });

    it('should accept retry after', () => {
      const error = new RateLimitError('Rate limited', 60);
      expect(error.retryAfter).toBe(60);
    });

    it('should accept limit info', () => {
      const error = new RateLimitError('Rate limited', 60, 1000, 0);
      expect(error.limit).toBe(1000);
      expect(error.remaining).toBe(0);
    });

    it('should always be retryable', () => {
      expect(new RateLimitError().isRetryable).toBe(true);
    });

    it('should be instanceof InfomanceError', () => {
      const error = new RateLimitError();
      expect(error).toBeInstanceOf(InfomanceError);
    });
  });

  describe('ValidationError', () => {
    it('should have default message', () => {
      const error = new ValidationError();
      expect(error.message).toBe('Parâmetros inválidos');
      expect(error.status).toBe(400);
      expect(error.name).toBe('ValidationError');
    });

    it('should accept errors array', () => {
      const errors = [
        { field: 'ibge_code', message: 'campo obrigatorio' },
        { field: 'state', message: 'valor invalido' },
      ];
      const error = new ValidationError('Invalid', errors);
      expect(error.errors).toEqual(errors);
      expect(error.errors).toHaveLength(2);
    });

    it('should be instanceof InfomanceError', () => {
      const error = new ValidationError();
      expect(error).toBeInstanceOf(InfomanceError);
    });
  });

  describe('ServerError', () => {
    it('should have default message', () => {
      const error = new ServerError();
      expect(error.message).toBe('Erro interno do servidor');
      expect(error.status).toBe(500);
      expect(error.name).toBe('ServerError');
    });

    it('should accept custom status code', () => {
      const error = new ServerError('Gateway timeout', 504);
      expect(error.status).toBe(504);
    });

    it('should always be retryable', () => {
      expect(new ServerError().isRetryable).toBe(true);
    });

    it('should be instanceof InfomanceError', () => {
      const error = new ServerError();
      expect(error).toBeInstanceOf(InfomanceError);
    });
  });

  describe('TimeoutError', () => {
    it('should have default message', () => {
      const error = new TimeoutError();
      expect(error.message).toBe('Timeout na requisição');
      expect(error.status).toBe(408);
      expect(error.name).toBe('TimeoutError');
    });

    it('should accept timeout value', () => {
      const error = new TimeoutError('Timeout', 30000);
      expect(error.timeoutMs).toBe(30000);
    });

    it('should always be retryable', () => {
      expect(new TimeoutError().isRetryable).toBe(true);
    });

    it('should be instanceof InfomanceError', () => {
      const error = new TimeoutError();
      expect(error).toBeInstanceOf(InfomanceError);
    });
  });

  describe('NetworkError', () => {
    it('should have default message', () => {
      const error = new NetworkError();
      expect(error.message).toBe('Erro de conexão com a API');
      expect(error.name).toBe('NetworkError');
    });

    it('should accept original error', () => {
      const original = new Error('Connection refused');
      const error = new NetworkError('Network failed', original);
      expect(error.originalError).toBe(original);
    });

    it('should always be retryable', () => {
      expect(new NetworkError().isRetryable).toBe(true);
    });

    it('should be instanceof InfomanceError', () => {
      const error = new NetworkError();
      expect(error).toBeInstanceOf(InfomanceError);
    });
  });
});
