// ============================================
// Infomance SDK - Error Classes
// ============================================

/**
 * Base error class for all Infomance API errors.
 * All specific error types inherit from this class.
 */
export class InfomanceError extends Error {
  public readonly status?: number;
  public readonly requestId?: string;
  public readonly responseBody?: Record<string, unknown>;

  constructor(
    message: string,
    status?: number,
    requestId?: string,
    responseBody?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'InfomanceError';
    this.status = status;
    this.requestId = requestId;
    this.responseBody = responseBody;
    Object.setPrototypeOf(this, InfomanceError.prototype);
  }

  /**
   * Whether this error is retryable.
   * Returns true for 429, 5xx errors.
   */
  get isRetryable(): boolean {
    return this.status
      ? [429, 500, 502, 503, 504].includes(this.status)
      : false;
  }
}

/**
 * Thrown when authentication fails (401).
 * Usually indicates an invalid or expired API key.
 */
export class AuthenticationError extends InfomanceError {
  constructor(
    message = 'API Key inválida ou expirada',
    requestId?: string,
    responseBody?: Record<string, unknown>
  ) {
    super(message, 401, requestId, responseBody);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Thrown when access is forbidden (403).
 * Usually indicates insufficient permissions or wrong plan tier.
 */
export class ForbiddenError extends InfomanceError {
  public readonly requiredPlan?: string;

  constructor(
    message = 'Acesso não autorizado para este recurso',
    requiredPlan?: string,
    requestId?: string,
    responseBody?: Record<string, unknown>
  ) {
    super(message, 403, requestId, responseBody);
    this.name = 'ForbiddenError';
    this.requiredPlan = requiredPlan;
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * Thrown when the requested resource is not found (404).
 */
export class NotFoundError extends InfomanceError {
  constructor(
    message = 'Recurso não encontrado',
    requestId?: string,
    responseBody?: Record<string, unknown>
  ) {
    super(message, 404, requestId, responseBody);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Thrown when request validation fails (400, 422).
 * Contains detailed field-level errors when available.
 */
export class ValidationError extends InfomanceError {
  public readonly errors?: Array<{ field: string; message: string }>;

  constructor(
    message = 'Parâmetros inválidos',
    errors?: Array<{ field: string; message: string }>,
    requestId?: string,
    responseBody?: Record<string, unknown>
  ) {
    super(message, 400, requestId, responseBody);
    this.name = 'ValidationError';
    this.errors = errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Thrown when rate limit is exceeded (429).
 * Contains retry information when available.
 */
export class RateLimitError extends InfomanceError {
  public readonly retryAfter?: number;
  public readonly limit?: number;
  public readonly remaining?: number;

  constructor(
    message = 'Limite de requisições excedido',
    retryAfter?: number,
    limit?: number,
    remaining?: number,
    requestId?: string,
    responseBody?: Record<string, unknown>
  ) {
    super(message, 429, requestId, responseBody);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    this.limit = limit;
    this.remaining = remaining;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }

  override get isRetryable(): boolean {
    return true;
  }
}

/**
 * Thrown when the server encounters an error (5xx).
 */
export class ServerError extends InfomanceError {
  constructor(
    message = 'Erro interno do servidor',
    status = 500,
    requestId?: string,
    responseBody?: Record<string, unknown>
  ) {
    super(message, status, requestId, responseBody);
    this.name = 'ServerError';
    Object.setPrototypeOf(this, ServerError.prototype);
  }

  override get isRetryable(): boolean {
    return true;
  }
}

/**
 * Thrown when a request times out.
 */
export class TimeoutError extends InfomanceError {
  public readonly timeoutMs?: number;

  constructor(message = 'Timeout na requisição', timeoutMs?: number) {
    super(message, 408);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }

  override get isRetryable(): boolean {
    return true;
  }
}

/**
 * Thrown when a network error occurs (connection refused, DNS failure, etc.).
 */
export class NetworkError extends InfomanceError {
  public readonly originalError?: Error;

  constructor(message = 'Erro de conexão com a API', originalError?: Error) {
    super(message);
    this.name = 'NetworkError';
    this.originalError = originalError;
    Object.setPrototypeOf(this, NetworkError.prototype);
  }

  override get isRetryable(): boolean {
    return true;
  }
}
