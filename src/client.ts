// ============================================
// Infomance SDK - API Client
// ============================================

import {
  Municipality,
  MunicipalityIndicators,
  IndicatorsMunicipality,
  EconomicData,
  InfrastructureData,
  ComexOverview,
  ComexMunicipality,
  ComexProduct,
  SicorOverview,
  SicorState,
  SicorByCategory,
  HealthEstablishment,
  HealthStats,
  School,
  IDEBScore,
  CrimeStats,
  CrimeOverview,
  EmploymentData,
  AgroMunicipality,
  AgroTimeseries,
  LandUseData,
  EmissionsData,
  POI,
  POISearchParams,
  ConsolidatedCity,
  RankingEntry,
  RankingParams,
  Pagination,
  StateFilter,
  YearFilter,
  ExportFormat,
  ListResponse,
  // European Types
  GeoJSONFeatureCollection,
  GeoJSONFeature,
  PortugalMunicipalityParams,
  FranceCommuneParams,
  GermanyGemeindeParams,
  NetherlandsGemeenteParams,
  ItalyComuneParams,
  SpainMunicipioParams,
  // Unified EU API Types
  EUCountry,
  EULAUMunicipality,
  EUNUTSRegion,
  EULAUParams,
  EUNUTSParams,
} from './types';

import {
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

import {
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  calculateBackoffDelay,
  isRetryableStatus,
  isRetryableNetworkError,
  sleep,
} from './retry';

const SDK_VERSION = '1.0.0';
const DEFAULT_BASE_URL = 'https://api.infomance.com.br';

// ============================================
// Types
// ============================================

/**
 * Rate limit information from the last API response.
 */
export interface RateLimitInfo {
  /** Maximum requests per time window */
  limit: number;
  /** Remaining requests in current window */
  remaining: number;
  /** Unix timestamp when the window resets */
  reset: number;
  /** Date object for when the window resets */
  resetDate: Date;
}

/**
 * Logger interface for SDK debugging.
 */
export interface Logger {
  debug?(message: string, ...args: unknown[]): void;
  info?(message: string, ...args: unknown[]): void;
  warn?(message: string, ...args: unknown[]): void;
  error?(message: string, ...args: unknown[]): void;
}

/**
 * Configuration options for the Infomance client.
 */
export interface InfomanceClientConfig {
  /** Your Infomance API key */
  apiKey: string;
  /** Base URL for the API (default: https://api.infomance.com.br) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Retry configuration */
  retry?: Partial<RetryConfig>;
  /** Logger instance for debugging */
  logger?: Logger;
  /** Custom User-Agent header suffix */
  userAgent?: string;
}

/**
 * Options for individual requests.
 */
export interface RequestOptions {
  /** AbortSignal for request cancellation */
  signal?: AbortSignal;
  /** Override timeout for this specific request (in milliseconds) */
  timeout?: number;
}

interface InternalRequestOptions extends RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  format?: ExportFormat;
}

// ============================================
// Client
// ============================================

export class InfomanceClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly retryConfig: RetryConfig;
  private readonly logger?: Logger;
  private readonly userAgent: string;

  private _rateLimit?: RateLimitInfo;
  private _lastRequestId?: string;

  constructor(config: InfomanceClientConfig) {
    if (!config.apiKey) {
      throw new Error('API Key is required');
    }

    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retry };
    this.logger = config.logger;

    // Build User-Agent string
    const baseAgent = `infomance-js/${SDK_VERSION}`;
    this.userAgent = config.userAgent
      ? `${baseAgent} ${config.userAgent}`
      : baseAgent;
  }

  // ============================================
  // Properties
  // ============================================

  /**
   * Rate limit information from the last API response.
   */
  get rateLimit(): RateLimitInfo | undefined {
    return this._rateLimit;
  }

  /**
   * Request ID from the last API request (useful for support).
   */
  get lastRequestId(): string | undefined {
    return this._lastRequestId;
  }

  // ============================================
  // Private Methods
  // ============================================

  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    ...args: unknown[]
  ): void {
    if (this.logger && this.logger[level]) {
      this.logger[level]!(message, ...args);
    }
  }

  private combineSignals(
    signal1: AbortSignal,
    signal2: AbortSignal
  ): AbortSignal {
    const controller = new AbortController();
    const abort = () => controller.abort();

    if (signal1.aborted || signal2.aborted) {
      controller.abort();
      return controller.signal;
    }

    signal1.addEventListener('abort', abort, { once: true });
    signal2.addEventListener('abort', abort, { once: true });

    return controller.signal;
  }

  private extractRateLimit(headers: Headers): RateLimitInfo | undefined {
    const limit = headers.get('X-RateLimit-Limit');
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');

    if (limit && remaining && reset) {
      const resetTimestamp = parseInt(reset, 10);
      return {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: resetTimestamp,
        resetDate: new Date(resetTimestamp * 1000),
      };
    }
    return undefined;
  }

  private async handleErrorResponse(
    response: Response,
    requestId?: string
  ): Promise<never> {
    let body: Record<string, unknown> = {};
    try {
      body = await response.json();
    } catch {
      body = { detail: response.statusText };
    }

    // Extract message from response body
    let message: string;
    const detail = body.detail || body.error || body.message;
    if (detail && typeof detail === 'object') {
      const detailObj = detail as Record<string, unknown>;
      message =
        (detailObj.error as string) ||
        (detailObj.detail as string) ||
        (detailObj.message as string) ||
        JSON.stringify(detail);
    } else {
      message = (detail as string) || `HTTP ${response.status}`;
    }

    switch (response.status) {
      case 400:
      case 422:
        throw new ValidationError(
          message,
          body.errors as Array<{ field: string; message: string }>,
          requestId,
          body
        );
      case 401:
        throw new AuthenticationError(message, requestId, body);
      case 403:
        throw new ForbiddenError(
          message,
          body.required_plan as string,
          requestId,
          body
        );
      case 404:
        throw new NotFoundError(message, requestId, body);
      case 429:
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError(
          message,
          retryAfter ? parseInt(retryAfter, 10) : undefined,
          this._rateLimit?.limit,
          this._rateLimit?.remaining,
          requestId,
          body
        );
      case 500:
      case 502:
      case 503:
      case 504:
        throw new ServerError(message, response.status, requestId, body);
      default:
        throw new InfomanceError(message, response.status, requestId, body);
    }
  }

  private async request<T>(
    path: string,
    options: InternalRequestOptions = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (options.format && options.format !== 'json') {
      url.searchParams.set('format', options.format);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-API-Key': this.apiKey,
      'User-Agent': this.userAgent,
    };

    const requestTimeout = options.timeout ?? this.timeout;
    const externalSignal = options.signal;

    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt <= this.retryConfig.maxRetries) {
      if (externalSignal?.aborted) {
        throw new InfomanceError('Request aborted');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

      const combinedSignal = externalSignal
        ? this.combineSignals(externalSignal, controller.signal)
        : controller.signal;

      try {
        this.log(
          'debug',
          `Request: ${options.method || 'GET'} ${url}`,
          options.body ? { body: options.body } : {}
        );

        const startTime = Date.now();

        const response = await fetch(url.toString(), {
          method: options.method || 'GET',
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: combinedSignal,
        });

        clearTimeout(timeoutId);

        const elapsedMs = Date.now() - startTime;

        // Extract rate limit and request ID from headers
        this._rateLimit = this.extractRateLimit(response.headers);
        this._lastRequestId =
          response.headers.get('X-Request-ID') || undefined;

        this.log(
          'debug',
          `Response: ${response.status} ${url} (${elapsedMs}ms)`
        );

        if (response.ok) {
          if (options.format === 'csv') {
            return (await response.text()) as unknown as T;
          }
          if (options.format === 'xlsx') {
            return (await response.blob()) as unknown as T;
          }
          return await response.json();
        }

        // Check if we should retry
        if (
          isRetryableStatus(response.status, this.retryConfig) &&
          attempt < this.retryConfig.maxRetries
        ) {
          // Extract Retry-After header if present (for 429 responses)
          const retryAfterHeader = response.headers.get('Retry-After');
          const retryAfterSeconds = retryAfterHeader
            ? parseInt(retryAfterHeader, 10)
            : undefined;
          const delay = calculateBackoffDelay(
            attempt,
            this.retryConfig,
            retryAfterSeconds
          );
          this.log(
            'warn',
            `Request failed with ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${this.retryConfig.maxRetries})`
          );
          await sleep(delay);
          attempt++;
          continue;
        }

        await this.handleErrorResponse(response, this._lastRequestId);
      } catch (error) {
        clearTimeout(timeoutId);

        // If it's already an InfomanceError, rethrow
        if (error instanceof InfomanceError) {
          throw error;
        }

        if (error instanceof Error) {
          // Convert to appropriate error type
          if (error.name === 'AbortError') {
            lastError = new TimeoutError(
              `Request timed out after ${requestTimeout}ms`,
              requestTimeout
            );
          } else if (isRetryableNetworkError(error)) {
            lastError = new NetworkError(
              `Network error: ${error.message}`,
              error
            );
          } else {
            lastError = error;
          }

          // Retry on network/timeout errors
          if (
            attempt < this.retryConfig.maxRetries &&
            (lastError instanceof TimeoutError ||
              lastError instanceof NetworkError)
          ) {
            const delay = calculateBackoffDelay(attempt, this.retryConfig);
            this.log(
              'warn',
              `Request failed: ${error.message}, retrying in ${delay}ms (attempt ${attempt + 1}/${this.retryConfig.maxRetries})`
            );
            await sleep(delay);
            attempt++;
            continue;
          }
        }

        throw lastError || error;
      }
    }

    throw lastError || new InfomanceError('Max retries exceeded');
  }

  private buildQuery(params: object): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        query.set(key, String(value));
      }
    }
    const queryStr = query.toString();
    return queryStr ? `?${queryStr}` : '';
  }

  // ============================================
  // Indicators API
  // ============================================

  /**
   * Lists municipalities with socioeconomic indicators.
   *
   * Retrieves a paginated list of Brazilian municipalities with basic
   * socioeconomic data such as population, PIB, and area.
   *
   * @param params - Filter and pagination parameters
   * @param params.state - Filter by state UF code (e.g., "SP", "RJ", "MG")
   * @param params.limit - Maximum number of results (default: 20, max: 100)
   * @param params.offset - Number of results to skip for pagination
   * @param options - Request options (timeout, AbortSignal)
   * @returns Paginated list of municipalities with indicators
   *
   * @example
   * ```typescript
   * // List first 10 municipalities in Sao Paulo
   * const result = await client.listMunicipalities({ state: 'SP', limit: 10 });
   * console.log(result.items);
   * console.log(`Total: ${result.total}`);
   * ```
   *
   * @example
   * ```typescript
   * // Paginate through results
   * const page1 = await client.listMunicipalities({ limit: 20, offset: 0 });
   * const page2 = await client.listMunicipalities({ limit: 20, offset: 20 });
   * ```
   */
  async listMunicipalities(
    params?: Pagination & StateFilter,
    options?: RequestOptions
  ): Promise<ListResponse<MunicipalityIndicators>> {
    return this.request(
      `/api/v1/indicators/municipalities${this.buildQuery(params || {})}`,
      options
    );
  }

  /**
   * Gets detailed data for a specific municipality.
   *
   * Retrieves comprehensive information about a municipality including
   * population, economic data, and infrastructure indicators.
   *
   * @param ibgeCode - The 7-digit IBGE municipality code (e.g., "3550308" for Sao Paulo)
   * @param options - Request options (timeout, AbortSignal)
   * @returns Municipality data with economic and infrastructure indicators
   * @throws {NotFoundError} If the municipality code is invalid or not found
   *
   * @example
   * ```typescript
   * // Get Sao Paulo city data
   * const sp = await client.getMunicipality('3550308');
   * console.log(sp.name); // "Sao Paulo"
   * console.log(sp.population); // 12396372
   * ```
   */
  async getMunicipality(
    ibgeCode: string,
    options?: RequestOptions
  ): Promise<IndicatorsMunicipality> {
    return this.request(
      `/api/v1/indicators/municipalities/${ibgeCode}`,
      options
    );
  }

  /**
   * Gets economic indicators for a municipality.
   *
   * Retrieves detailed economic data including PIB breakdown by sector
   * (agriculture, industry, services) and tax revenue.
   *
   * @param ibgeCode - The 7-digit IBGE municipality code
   * @param options - Request options (timeout, AbortSignal)
   * @returns Economic data for the municipality
   * @throws {NotFoundError} If the municipality is not found
   *
   * @example
   * ```typescript
   * const economic = await client.getMunicipalityEconomic('3550308');
   * console.log(`PIB: R$ ${economic.pib.toLocaleString()}`);
   * console.log(`Services: ${(economic.services / economic.pib * 100).toFixed(1)}%`);
   * ```
   */
  async getMunicipalityEconomic(
    ibgeCode: string,
    options?: RequestOptions
  ): Promise<EconomicData> {
    return this.request(
      `/api/v1/indicators/municipalities/${ibgeCode}/economic`,
      options
    );
  }

  /**
   * Gets infrastructure indicators for a municipality.
   *
   * Retrieves infrastructure data including water coverage, sewage treatment,
   * water loss rates, and internet/fiber coverage.
   *
   * @param ibgeCode - The 7-digit IBGE municipality code
   * @param options - Request options (timeout, AbortSignal)
   * @returns Infrastructure data for the municipality
   * @throws {NotFoundError} If the municipality is not found
   *
   * @example
   * ```typescript
   * const infra = await client.getMunicipalityInfrastructure('3550308');
   * console.log(`Water coverage: ${infra.water_coverage}%`);
   * console.log(`Water loss: ${infra.water_loss}%`);
   * ```
   */
  async getMunicipalityInfrastructure(
    ibgeCode: string,
    options?: RequestOptions
  ): Promise<InfrastructureData> {
    return this.request(
      `/api/v1/indicators/municipalities/${ibgeCode}/infrastructure`,
      options
    );
  }

  /**
   * Gets a ranking of municipalities by a specific indicator.
   *
   * Returns municipalities ranked by indicators such as PIB per capita,
   * population, or infrastructure metrics.
   *
   * @param indicator - The indicator to rank by (e.g., "pib_per_capita", "population")
   * @param params - Filter and pagination parameters
   * @param params.state - Filter by state UF code
   * @param params.year - Filter by year
   * @param params.limit - Maximum results (default: 10)
   * @param params.order - Sort order: "asc" or "desc" (default: "desc")
   * @param options - Request options (timeout, AbortSignal)
   * @returns Array of ranking entries with position, municipality, and value
   *
   * @example
   * ```typescript
   * // Get top 5 cities by PIB per capita in SP
   * const ranking = await client.getIndicatorsRanking('pib_per_capita', {
   *   state: 'SP',
   *   limit: 5,
   *   order: 'desc',
   * });
   * ranking.forEach(entry => {
   *   console.log(`${entry.position}. ${entry.name}: R$ ${entry.value}`);
   * });
   * ```
   */
  async getIndicatorsRanking(
    indicator: string,
    params?: RankingParams,
    options?: RequestOptions
  ): Promise<RankingEntry[]> {
    return this.request(
      `/api/v1/indicators/ranking/${indicator}${this.buildQuery(params || {})}`,
      options
    );
  }

  // ============================================
  // COMEX API (Agricultural Exports)
  // ============================================

  /**
   * Gets an overview of Brazilian agricultural exports (COMEX data).
   *
   * Returns aggregated export data including total value, volume,
   * top products, and destination countries.
   *
   * @param options - Request options (timeout, AbortSignal)
   * @returns Overview of agricultural exports with totals and top products
   *
   * @example
   * ```typescript
   * const overview = await client.getComexOverview();
   * console.log(`Total exports: USD ${overview.total_value_usd.toLocaleString()}`);
   * console.log('Top products:', overview.top_products);
   * ```
   */
  async getComexOverview(options?: RequestOptions): Promise<ComexOverview> {
    return this.request('/api/v1/comex/overview', options);
  }

  /**
   * Gets export data for a specific municipality.
   *
   * Retrieves agricultural export information for a municipality including
   * total value, volume, and breakdown by product.
   *
   * @param ibgeCode - The 7-digit IBGE municipality code
   * @param options - Request options (timeout, AbortSignal)
   * @returns Export data for the municipality
   * @throws {NotFoundError} If the municipality is not found
   *
   * @example
   * ```typescript
   * const exports = await client.getComexMunicipality('3550308');
   * console.log(`Total exports: USD ${exports.total_value_usd}`);
   * exports.products.forEach(p => {
   *   console.log(`  ${p.code_sh4}: USD ${p.value_usd}`);
   * });
   * ```
   */
  async getComexMunicipality(
    ibgeCode: string,
    options?: RequestOptions
  ): Promise<ComexMunicipality> {
    return this.request(`/api/v1/comex/municipalities/${ibgeCode}`, options);
  }

  async getComexMunicipalityTimeseries(
    ibgeCode: string,
    params?: YearFilter,
    options?: RequestOptions
  ): Promise<ComexProduct[]> {
    return this.request(
      `/api/v1/comex/municipalities/${ibgeCode}/timeseries${this.buildQuery(params || {})}`,
      options
    );
  }

  async getComexProducts(
    params?: Pagination & YearFilter,
    options?: RequestOptions
  ): Promise<{ products: ComexProduct[] }> {
    return this.request(
      `/api/v1/comex/products${this.buildQuery(params || {})}`,
      options
    );
  }

  async getComexCountries(
    params?: YearFilter,
    options?: RequestOptions
  ): Promise<{ countries: { country: string; value_usd: number }[] }> {
    return this.request(
      `/api/v1/comex/countries${this.buildQuery(params || {})}`,
      options
    );
  }

  async getComexRanking(
    indicator: string,
    params?: RankingParams,
    options?: RequestOptions
  ): Promise<RankingEntry[]> {
    return this.request(
      `/api/v1/comex/ranking/${indicator}${this.buildQuery(params || {})}`,
      options
    );
  }

  // ============================================
  // SICOR API (Rural Credit)
  // ============================================

  async getSicorOverview(options?: RequestOptions): Promise<SicorOverview> {
    return this.request('/api/v1/sicor/overview', options);
  }

  async getSicorState(
    uf: string,
    options?: RequestOptions
  ): Promise<SicorState[]> {
    return this.request(`/api/v1/sicor/states/${uf}`, options);
  }

  async getSicorStateTimeseries(
    uf: string,
    options?: RequestOptions
  ): Promise<SicorState[]> {
    return this.request(`/api/v1/sicor/states/${uf}/timeseries`, options);
  }

  async getSicorByFinalidade(
    options?: RequestOptions
  ): Promise<SicorByCategory[]> {
    return this.request('/api/v1/sicor/by-finalidade', options);
  }

  async getSicorByAtividade(
    options?: RequestOptions
  ): Promise<SicorByCategory[]> {
    return this.request('/api/v1/sicor/by-atividade', options);
  }

  async getSicorByPrograma(
    options?: RequestOptions
  ): Promise<SicorByCategory[]> {
    return this.request('/api/v1/sicor/by-programa', options);
  }

  async getSicorRanking(
    indicator: string,
    params?: RankingParams,
    options?: RequestOptions
  ): Promise<RankingEntry[]> {
    return this.request(
      `/api/v1/sicor/ranking/${indicator}${this.buildQuery(params || {})}`,
      options
    );
  }

  // ============================================
  // Health API
  // ============================================

  async listHealthEstablishments(
    params?: Pagination & StateFilter & { type?: string },
    options?: RequestOptions
  ): Promise<ListResponse<HealthEstablishment>> {
    return this.request(
      `/api/v1/health/establishments${this.buildQuery(params || {})}`,
      options
    );
  }

  async getHealthEstablishment(
    cnesCode: string,
    options?: RequestOptions
  ): Promise<HealthEstablishment> {
    return this.request(
      `/api/v1/health/establishments/${cnesCode}`,
      options
    );
  }

  async getMunicipalityHealthStats(
    ibgeCode: string,
    options?: RequestOptions
  ): Promise<HealthStats> {
    return this.request(
      `/api/v1/health/municipalities/${ibgeCode}`,
      options
    );
  }

  async getHealthStats(options?: RequestOptions): Promise<HealthStats> {
    return this.request('/api/v1/health/stats', options);
  }

  async searchHealthEstablishments(
    query: string,
    params?: Pagination,
    options?: RequestOptions
  ): Promise<ListResponse<HealthEstablishment>> {
    return this.request(
      `/api/v1/health/search${this.buildQuery({ q: query, ...params })}`,
      options
    );
  }

  // ============================================
  // Education API
  // ============================================

  async listSchools(
    params?: Pagination & StateFilter & { network?: string },
    options?: RequestOptions
  ): Promise<ListResponse<School>> {
    return this.request(
      `/api/v1/education/schools${this.buildQuery(params || {})}`,
      options
    );
  }

  async getEducationOverview(
    options?: RequestOptions
  ): Promise<{ total_schools: number; by_network: { network: string; count: number }[] }> {
    return this.request('/api/v1/education/overview', options);
  }

  async getIDEBRanking(
    params?: RankingParams,
    options?: RequestOptions
  ): Promise<IDEBScore[]> {
    return this.request(
      `/api/v1/education/ideb/ranking${this.buildQuery(params || {})}`,
      options
    );
  }

  async getMunicipalityEducation(
    ibgeCode: string,
    options?: RequestOptions
  ): Promise<{ schools: number; ideb?: IDEBScore }> {
    return this.request(
      `/api/v1/education/municipalities/${ibgeCode}`,
      options
    );
  }

  // ============================================
  // Security API
  // ============================================

  async listCrimeStats(
    params?: Pagination & StateFilter & YearFilter,
    options?: RequestOptions
  ): Promise<ListResponse<CrimeStats>> {
    return this.request(
      `/api/v1/security/stats${this.buildQuery(params || {})}`,
      options
    );
  }

  async getSecurityOverview(options?: RequestOptions): Promise<CrimeOverview> {
    return this.request('/api/v1/security/overview', options);
  }

  async getCrimeTypes(options?: RequestOptions): Promise<{ types: string[] }> {
    return this.request('/api/v1/security/types', options);
  }

  async getCrimeRanking(
    params?: RankingParams & { crime_type?: string },
    options?: RequestOptions
  ): Promise<RankingEntry[]> {
    return this.request(
      `/api/v1/security/ranking${this.buildQuery(params || {})}`,
      options
    );
  }

  async getMunicipalityCrimeStats(
    city: string,
    options?: RequestOptions
  ): Promise<CrimeStats[]> {
    return this.request(`/api/v1/security/municipalities/${city}`, options);
  }

  // ============================================
  // Employment API
  // ============================================

  async listEmploymentMunicipalities(
    params?: Pagination & StateFilter,
    options?: RequestOptions
  ): Promise<ListResponse<EmploymentData>> {
    return this.request(
      `/api/v1/employment/municipalities${this.buildQuery(params || {})}`,
      options
    );
  }

  async getMunicipalityEmployment(
    ibgeCode: string,
    options?: RequestOptions
  ): Promise<EmploymentData> {
    return this.request(
      `/api/v1/employment/municipalities/${ibgeCode}`,
      options
    );
  }

  async getEmploymentTimeseries(
    ibgeCode: string,
    options?: RequestOptions
  ): Promise<EmploymentData[]> {
    return this.request(
      `/api/v1/employment/municipalities/${ibgeCode}/timeseries`,
      options
    );
  }

  async getEmploymentRanking(
    indicator: string,
    params?: RankingParams,
    options?: RequestOptions
  ): Promise<RankingEntry[]> {
    return this.request(
      `/api/v1/employment/ranking/${indicator}${this.buildQuery(params || {})}`,
      options
    );
  }

  async getEmploymentOverview(
    options?: RequestOptions
  ): Promise<{ total_jobs: number; total_admissions: number; total_dismissals: number }> {
    return this.request('/api/v1/employment/overview', options);
  }

  // ============================================
  // AGRO API
  // ============================================

  async listAgroMunicipalities(
    params?: Pagination & StateFilter,
    options?: RequestOptions
  ): Promise<ListResponse<AgroMunicipality>> {
    return this.request(
      `/api/v1/agro/municipalities${this.buildQuery(params || {})}`,
      options
    );
  }

  async getAgroMunicipality(
    ibgeCode: string,
    options?: RequestOptions
  ): Promise<AgroMunicipality> {
    return this.request(
      `/api/v1/agro/municipalities/${ibgeCode}`,
      options
    );
  }

  async getAgroTimeseries(
    ibgeCode: string,
    options?: RequestOptions
  ): Promise<AgroTimeseries[]> {
    return this.request(
      `/api/v1/agro/municipalities/${ibgeCode}/timeseries`,
      options
    );
  }

  async getAgroLandUse(
    ibgeCode: string,
    options?: RequestOptions
  ): Promise<LandUseData[]> {
    return this.request(
      `/api/v1/agro/municipalities/${ibgeCode}/land-use`,
      options
    );
  }

  async getAgroEmissions(
    ibgeCode: string,
    options?: RequestOptions
  ): Promise<EmissionsData[]> {
    return this.request(
      `/api/v1/agro/municipalities/${ibgeCode}/emissions`,
      options
    );
  }

  async getAgroRanking(
    indicator: string,
    params?: RankingParams,
    options?: RequestOptions
  ): Promise<RankingEntry[]> {
    return this.request(
      `/api/v1/agro/ranking/${indicator}${this.buildQuery(params || {})}`,
      options
    );
  }

  async getAgroStats(
    options?: RequestOptions
  ): Promise<{ total_municipalities: number; total_area_ha: number }> {
    return this.request('/api/v1/agro/stats', options);
  }

  // ============================================
  // POI API
  // ============================================

  /**
   * Searches for Points of Interest (POIs).
   *
   * Searches across various POI categories including restaurants, banks,
   * gas stations, supermarkets, and more. Supports filtering by city,
   * category, and text search.
   *
   * @param params - Search parameters
   * @param params.city - Filter by city name
   * @param params.category - Filter by POI category (e.g., "restaurant", "bank")
   * @param params.q - Text search query
   * @param params.lat - Latitude for location-based search
   * @param params.lng - Longitude for location-based search
   * @param params.radius - Search radius in meters (when using lat/lng)
   * @param params.limit - Maximum results (default: 20)
   * @param params.offset - Pagination offset
   * @param options - Request options (timeout, AbortSignal)
   * @returns Paginated list of POIs matching the search criteria
   *
   * @example
   * ```typescript
   * // Find restaurants in Sao Paulo
   * const pois = await client.searchPOIs({
   *   city: 'Sao Paulo',
   *   category: 'restaurant',
   *   limit: 50,
   * });
   * pois.items.forEach(poi => {
   *   console.log(`${poi.name} - ${poi.address}`);
   * });
   * ```
   */
  async searchPOIs(
    params?: POISearchParams,
    options?: RequestOptions
  ): Promise<ListResponse<POI>> {
    return this.request(
      `/api/v1/pois${this.buildQuery(params || {})}`,
      options
    );
  }

  /**
   * Searches for POIs near a specific location.
   *
   * Convenience method for location-based POI search. Returns POIs
   * ordered by distance from the specified coordinates.
   *
   * @param lat - Latitude of the search center
   * @param lng - Longitude of the search center
   * @param radius - Search radius in meters (default: 1000)
   * @param params - Additional search filters (category, q, limit)
   * @param options - Request options (timeout, AbortSignal)
   * @returns POIs near the specified location, ordered by distance
   *
   * @example
   * ```typescript
   * // Find gas stations within 2km of a location
   * const nearby = await client.searchNearbyPOIs(
   *   -23.5505,  // lat
   *   -46.6333,  // lng
   *   2000,      // 2km radius
   *   { category: 'gas_station' }
   * );
   * nearby.items.forEach(poi => {
   *   console.log(`${poi.name} - ${poi.brand}`);
   * });
   * ```
   */
  async searchNearbyPOIs(
    lat: number,
    lng: number,
    radius?: number,
    params?: Omit<POISearchParams, 'lat' | 'lng' | 'radius'>,
    options?: RequestOptions
  ): Promise<ListResponse<POI>> {
    return this.request(
      `/api/v1/pois/nearby${this.buildQuery({ lat, lng, radius, ...params })}`,
      options
    );
  }

  async getPOICategories(
    options?: RequestOptions
  ): Promise<{ categories: string[] }> {
    return this.request('/api/v1/pois/categories', options);
  }

  async getCityPOIStats(
    city: string,
    options?: RequestOptions
  ): Promise<{ total: number; by_category: { category: string; count: number }[] }> {
    return this.request(`/api/v1/pois/cities/${city}/stats`, options);
  }

  // ============================================
  // Consolidated API
  // ============================================

  /**
   * Gets all available data for a city in a single call.
   *
   * Consolidates municipality indicators, health stats, education data,
   * security metrics, employment data, and agricultural information
   * into a single response. Ideal for dashboard views.
   *
   * @param ibgeCode - The 7-digit IBGE municipality code
   * @param options - Request options (timeout, AbortSignal)
   * @returns Consolidated city data from all available sources
   * @throws {NotFoundError} If the municipality is not found
   *
   * @example
   * ```typescript
   * const city = await client.getConsolidatedCity('3550308');
   * console.log(`${city.municipality.name}, ${city.municipality.state}`);
   * console.log(`Population: ${city.indicators?.population}`);
   * console.log(`Health establishments: ${city.health?.total_establishments}`);
   * console.log(`Schools: ${city.education?.schools}`);
   * ```
   */
  async getConsolidatedCity(
    ibgeCode: string,
    options?: RequestOptions
  ): Promise<ConsolidatedCity> {
    return this.request(
      `/api/v1/consolidated/cities/${ibgeCode}`,
      options
    );
  }

  /**
   * Gets a summary of city data (lighter version of getConsolidatedCity).
   *
   * Returns key metrics without full details. Useful for lists and
   * overview cards where full data is not needed.
   *
   * @param ibgeCode - The 7-digit IBGE municipality code
   * @param options - Request options (timeout, AbortSignal)
   * @returns Summary of city data
   * @throws {NotFoundError} If the municipality is not found
   *
   * @example
   * ```typescript
   * const summary = await client.getConsolidatedCitySummary('3550308');
   * console.log(summary.municipality.name);
   * ```
   */
  async getConsolidatedCitySummary(
    ibgeCode: string,
    options?: RequestOptions
  ): Promise<ConsolidatedCity> {
    return this.request(
      `/api/v1/consolidated/cities/${ibgeCode}/summary`,
      options
    );
  }

  // ============================================
  // Export Methods
  // ============================================

  /**
   * Exports data from any endpoint as CSV.
   *
   * Converts API response to CSV format. Useful for data analysis
   * in spreadsheets or importing into other systems.
   *
   * @param path - The API endpoint path (e.g., "/api/v1/indicators/municipalities")
   * @param params - Query parameters to pass to the endpoint
   * @param options - Request options (timeout, AbortSignal)
   * @returns CSV string with the requested data
   *
   * @example
   * ```typescript
   * const csv = await client.exportToCSV('/api/v1/indicators/municipalities', {
   *   state: 'SP',
   *   limit: 100,
   * });
   * // Save to file or process the CSV string
   * fs.writeFileSync('municipalities.csv', csv);
   * ```
   */
  async exportToCSV(
    path: string,
    params?: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<string> {
    return this.request(`${path}${this.buildQuery(params || {})}`, {
      ...options,
      format: 'csv',
    });
  }

  /**
   * Exports data from any endpoint as Excel (XLSX).
   *
   * Converts API response to Excel format. Returns a Blob that can be
   * saved as a file in Node.js or downloaded in the browser.
   *
   * @param path - The API endpoint path (e.g., "/api/v1/indicators/municipalities")
   * @param params - Query parameters to pass to the endpoint
   * @param options - Request options (timeout, AbortSignal)
   * @returns Blob containing the Excel file
   *
   * @example
   * ```typescript
   * const blob = await client.exportToExcel('/api/v1/indicators/municipalities', {
   *   state: 'SP',
   * });
   * // Node.js: save to file
   * const buffer = await blob.arrayBuffer();
   * fs.writeFileSync('municipalities.xlsx', Buffer.from(buffer));
   *
   * // Browser: trigger download
   * const url = URL.createObjectURL(blob);
   * const a = document.createElement('a');
   * a.href = url;
   * a.download = 'municipalities.xlsx';
   * a.click();
   * ```
   */
  async exportToExcel(
    path: string,
    params?: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<Blob> {
    return this.request(`${path}${this.buildQuery(params || {})}`, {
      ...options,
      format: 'xlsx',
    });
  }

  // ============================================
  // European Geo API - Portugal
  // ============================================

  /**
   * Lists Portuguese municipalities with boundaries.
   *
   * Returns all 308 Portuguese municipalities (Continental + Açores + Madeira)
   * as GeoJSON FeatureCollection for choropleth maps.
   *
   * @param params - Filter parameters
   * @param params.distrito - Filter by district (Lisboa, Porto, Faro, etc.)
   * @param params.region - Filter by region (continental, acores, madeira)
   * @param params.simplify - Geometry simplification tolerance (0.001-0.1)
   * @param params.limit - Maximum results (default: 310)
   * @param params.offset - Pagination offset
   * @param options - Request options
   * @returns GeoJSON FeatureCollection with municipality boundaries
   *
   * @example
   * ```typescript
   * // Get all Portuguese municipalities
   * const municipalities = await client.getPortugalMunicipalities();
   *
   * // Get only Lisbon district
   * const lisbon = await client.getPortugalMunicipalities({ distrito: 'Lisboa' });
   * ```
   */
  async getPortugalMunicipalities(
    params?: PortugalMunicipalityParams,
    options?: RequestOptions
  ): Promise<GeoJSONFeatureCollection> {
    return this.request(
      `/api/v1/geo/pt/municipalities${this.buildQuery(params || {})}`,
      options
    );
  }

  /**
   * Gets a single Portuguese municipality by DICOFRE code.
   *
   * @param dicofre - DICOFRE municipality code (e.g., "0806" for Odemira)
   * @param options - Request options
   * @returns GeoJSON Feature with municipality boundary and properties
   * @throws {NotFoundError} If the municipality is not found
   *
   * @example
   * ```typescript
   * const odemira = await client.getPortugalMunicipality('0806');
   * console.log(odemira.properties.name);
   * ```
   */
  async getPortugalMunicipality(
    dicofre: string,
    options?: RequestOptions
  ): Promise<GeoJSONFeature> {
    return this.request(`/api/v1/geo/pt/municipalities/${dicofre}`, options);
  }

  /**
   * Gets Portuguese district boundaries.
   *
   * Returns all 18 Portuguese districts as GeoJSON FeatureCollection.
   *
   * @param options - Request options
   * @returns GeoJSON FeatureCollection with district boundaries
   */
  async getPortugalDistricts(
    options?: RequestOptions
  ): Promise<GeoJSONFeatureCollection> {
    return this.request('/api/v1/geo/pt/districts', options);
  }

  // ============================================
  // European Geo API - France
  // ============================================

  /**
   * Lists French communes with boundaries.
   *
   * Returns French municipalities as GeoJSON FeatureCollection.
   * France has ~35,000 communes across 101 départements and 18 régions.
   *
   * @param params - Filter parameters
   * @param params.departement - Filter by département code (75, 13, etc.)
   * @param params.region - Filter by région code
   * @param params.limit - Maximum results
   * @param params.offset - Pagination offset
   * @param options - Request options
   * @returns GeoJSON FeatureCollection with commune boundaries
   *
   * @example
   * ```typescript
   * // Get communes in Paris département
   * const paris = await client.getFranceCommunes({ departement: '75' });
   * ```
   */
  async getFranceCommunes(
    params?: FranceCommuneParams,
    options?: RequestOptions
  ): Promise<GeoJSONFeatureCollection> {
    return this.request(
      `/api/v1/geo/fr/communes${this.buildQuery(params || {})}`,
      options
    );
  }

  /**
   * Gets a single French commune by INSEE code.
   *
   * @param codeInsee - INSEE commune code (e.g., "75056" for Paris)
   * @param options - Request options
   * @returns GeoJSON Feature with commune boundary
   */
  async getFranceCommune(
    codeInsee: string,
    options?: RequestOptions
  ): Promise<GeoJSONFeature> {
    return this.request(`/api/v1/geo/fr/communes/${codeInsee}`, options);
  }

  // ============================================
  // European Geo API - Germany
  // ============================================

  /**
   * Lists German municipalities (Gemeinden) with boundaries.
   *
   * Returns German municipalities as GeoJSON FeatureCollection.
   * Germany has ~11,000 Gemeinden across 401 Kreise and 16 Bundesländer.
   *
   * @param params - Filter parameters
   * @param params.bundesland - Filter by federal state (Bayern, Sachsen, etc.)
   * @param params.kreis - Filter by district
   * @param params.limit - Maximum results
   * @param params.offset - Pagination offset
   * @param options - Request options
   * @returns GeoJSON FeatureCollection with Gemeinde boundaries
   */
  async getGermanyGemeinden(
    params?: GermanyGemeindeParams,
    options?: RequestOptions
  ): Promise<GeoJSONFeatureCollection> {
    return this.request(
      `/api/v1/geo/de/gemeinden${this.buildQuery(params || {})}`,
      options
    );
  }

  /**
   * Gets a single German municipality by AGS code.
   *
   * @param ags - Amtlicher Gemeindeschlüssel (8 digits)
   * @param options - Request options
   * @returns GeoJSON Feature with Gemeinde boundary
   */
  async getGermanyGemeinde(
    ags: string,
    options?: RequestOptions
  ): Promise<GeoJSONFeature> {
    return this.request(`/api/v1/geo/de/gemeinden/${ags}`, options);
  }

  // ============================================
  // European Geo API - Netherlands
  // ============================================

  /**
   * Lists Dutch municipalities (Gemeenten) with boundaries.
   *
   * Returns Dutch municipalities as GeoJSON FeatureCollection.
   * Netherlands has 342 gemeenten across 12 provinces.
   *
   * @param params - Filter parameters
   * @param params.province - Filter by province
   * @param params.limit - Maximum results
   * @param params.offset - Pagination offset
   * @param options - Request options
   * @returns GeoJSON FeatureCollection with Gemeente boundaries
   */
  async getNetherlandsGemeenten(
    params?: NetherlandsGemeenteParams,
    options?: RequestOptions
  ): Promise<GeoJSONFeatureCollection> {
    return this.request(
      `/api/v1/geo/nl/gemeenten${this.buildQuery(params || {})}`,
      options
    );
  }

  /**
   * Gets a single Dutch municipality by CBS code.
   *
   * @param statcode - CBS gemeentecode
   * @param options - Request options
   * @returns GeoJSON Feature with Gemeente boundary
   */
  async getNetherlandsGemeente(
    statcode: string,
    options?: RequestOptions
  ): Promise<GeoJSONFeature> {
    return this.request(`/api/v1/geo/nl/gemeenten/${statcode}`, options);
  }

  // ============================================
  // European Geo API - Italy
  // ============================================

  /**
   * Lists Italian municipalities (Comuni) with boundaries.
   *
   * Returns Italian municipalities as GeoJSON FeatureCollection.
   * Italy has ~8,000 comuni across 107 province and 20 regioni.
   *
   * @param params - Filter parameters
   * @param params.regione - Filter by region
   * @param params.provincia - Filter by province
   * @param params.limit - Maximum results
   * @param params.offset - Pagination offset
   * @param options - Request options
   * @returns GeoJSON FeatureCollection with Comune boundaries
   */
  async getItalyComuni(
    params?: ItalyComuneParams,
    options?: RequestOptions
  ): Promise<GeoJSONFeatureCollection> {
    return this.request(
      `/api/v1/geo/it/comuni${this.buildQuery(params || {})}`,
      options
    );
  }

  /**
   * Gets a single Italian municipality by ISTAT code.
   *
   * @param proCom - ISTAT comune code
   * @param options - Request options
   * @returns GeoJSON Feature with Comune boundary
   */
  async getItalyComune(
    proCom: string,
    options?: RequestOptions
  ): Promise<GeoJSONFeature> {
    return this.request(`/api/v1/geo/it/comuni/${proCom}`, options);
  }

  // ============================================
  // European Geo API - Spain
  // ============================================

  /**
   * Lists Spanish municipalities (Municipios) with boundaries.
   *
   * Returns Spanish municipalities as GeoJSON FeatureCollection.
   * Spain has ~8,000 municipios across 52 provinces and 17 comunidades autónomas.
   *
   * @param params - Filter parameters
   * @param params.comunidad - Filter by autonomous community
   * @param params.provincia - Filter by province
   * @param params.limit - Maximum results
   * @param params.offset - Pagination offset
   * @param options - Request options
   * @returns GeoJSON FeatureCollection with Municipio boundaries
   */
  async getSpainMunicipios(
    params?: SpainMunicipioParams,
    options?: RequestOptions
  ): Promise<GeoJSONFeatureCollection> {
    return this.request(
      `/api/v1/geo/es/municipios${this.buildQuery(params || {})}`,
      options
    );
  }

  /**
   * Gets a single Spanish municipality by INE code.
   *
   * @param codigoIne - INE municipio code
   * @param options - Request options
   * @returns GeoJSON Feature with Municipio boundary
   */
  async getSpainMunicipio(
    codigoIne: string,
    options?: RequestOptions
  ): Promise<GeoJSONFeature> {
    return this.request(`/api/v1/geo/es/municipios/${codigoIne}`, options);
  }

  // ============================================
  // Unified EU API (BFF endpoints)
  // ============================================

  /**
   * Lists all EU countries with LAU coverage.
   *
   * Returns summary information for all 34 EU/EEA countries
   * including LAU municipality counts.
   *
   * @param options - Request options
   * @returns Array of EU countries with LAU counts
   *
   * @example
   * ```typescript
   * const countries = await client.getEUCountries();
   * console.log(countries.length);  // 34
   * countries.forEach(c => console.log(`${c.name}: ${c.lau_count} LAUs`));
   * ```
   */
  async getEUCountries(options?: RequestOptions): Promise<EUCountry[]> {
    return this.request('/api/v1/eu/countries', options);
  }

  /**
   * Lists EU LAU municipalities with optional filtering.
   *
   * Returns municipalities (Local Administrative Units) across
   * all EU/EEA countries. Use filters to narrow results by country,
   * NUTS3 region, or population range.
   *
   * @param params - Filter and pagination parameters
   * @param params.country - Filter by country code (e.g., "PT", "DE", "FR")
   * @param params.nuts3 - Filter by NUTS3 region code
   * @param params.min_population - Minimum population filter
   * @param params.max_population - Maximum population filter
   * @param params.limit - Maximum results (default: 100)
   * @param params.offset - Pagination offset
   * @param options - Request options
   * @returns Paginated list of LAU municipalities
   *
   * @example
   * ```typescript
   * // List Portuguese municipalities
   * const portugal = await client.getEULAU({ country: 'PT', limit: 100 });
   * console.log(`Found ${portugal.items.length} Portuguese LAUs`);
   *
   * // Filter by population
   * const largeCities = await client.getEULAU({
   *   country: 'DE',
   *   min_population: 500000
   * });
   * ```
   */
  async getEULAU(
    params?: EULAUParams,
    options?: RequestOptions
  ): Promise<ListResponse<EULAUMunicipality>> {
    return this.request(
      `/api/v1/eu/lau${this.buildQuery(params || {})}`,
      options
    );
  }

  /**
   * Gets a single EU LAU municipality by ID.
   *
   * @param lauId - The LAU ID (e.g., "PT_030875" for Lisboa, "DE_05315000" for Köln)
   * @param options - Request options
   * @returns LAU municipality details
   * @throws {NotFoundError} If the LAU ID is not found
   *
   * @example
   * ```typescript
   * const lisbon = await client.getEULAUById('PT_030875');
   * console.log(lisbon.name);             // "Lisboa"
   * console.log(lisbon.population);       // 545923
   * console.log(lisbon.country_code);     // "PT"
   * ```
   */
  async getEULAUById(
    lauId: string,
    options?: RequestOptions
  ): Promise<EULAUMunicipality> {
    return this.request(`/api/v1/eu/lau/${lauId}`, options);
  }

  /**
   * Lists EU NUTS regions with optional filtering.
   *
   * Returns NUTS (Nomenclature of Territorial Units for Statistics)
   * regions at any level (0-3). Use to understand the administrative
   * hierarchy of EU countries.
   *
   * @param params - Filter and pagination parameters
   * @param params.country - Filter by country code
   * @param params.level - Filter by NUTS level (0=country, 1=major region, 2=region, 3=province)
   * @param params.parent - Filter by parent NUTS code
   * @param params.limit - Maximum results
   * @param params.offset - Pagination offset
   * @param options - Request options
   * @returns Paginated list of NUTS regions
   *
   * @example
   * ```typescript
   * // Get all NUTS3 regions in Germany
   * const germanyNuts3 = await client.getEUNUTS({
   *   country: 'DE',
   *   level: 3
   * });
   *
   * // Get regions under a specific parent
   * const subRegions = await client.getEUNUTS({
   *   parent: 'DEA'  // North Rhine-Westphalia
   * });
   * ```
   */
  async getEUNUTS(
    params?: EUNUTSParams,
    options?: RequestOptions
  ): Promise<ListResponse<EUNUTSRegion>> {
    return this.request(
      `/api/v1/eu/nuts${this.buildQuery(params || {})}`,
      options
    );
  }
}
