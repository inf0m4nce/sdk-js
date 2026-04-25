# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-25

### Added

- **Initial release** of the Infomance TypeScript SDK

#### Client Features
- `InfomanceClient` class for interacting with the Infomance API
- Full TypeScript support with complete type definitions
- Pluggable logger interface (`Logger`) for debugging
- Rate limit tracking via `rateLimit` property
- Request ID tracking via `lastRequestId` property
- Per-request timeout and AbortSignal support
- Custom User-Agent support

#### Retry System
- Automatic retry with exponential backoff
- Configurable retry parameters (maxRetries, initialDelay, maxDelay, backoffFactor)
- Jitter support to prevent thundering herd
- Respect for `Retry-After` header on 429 responses
- Retryable status codes: 429, 500, 502, 503, 504

#### Error Handling
- 9 specialized error classes for granular error handling:
  - `InfomanceError` - Base error class
  - `AuthenticationError` - 401 errors
  - `ForbiddenError` - 403 errors (includes `requiredPlan`)
  - `NotFoundError` - 404 errors
  - `ValidationError` - 400/422 errors (includes field-level `errors`)
  - `RateLimitError` - 429 errors (includes `retryAfter`, `limit`, `remaining`)
  - `ServerError` - 5xx errors
  - `TimeoutError` - Request timeouts
  - `NetworkError` - Connection failures
- `isRetryable` property on all error classes

#### Export Features
- `exportToCSV()` - Export any endpoint to CSV format
- `exportToExcel()` - Export any endpoint to Excel (XLSX) format

### API Coverage

#### Indicators API
- `listMunicipalities()` - List municipalities with socioeconomic indicators
- `getMunicipality()` - Get detailed municipality data
- `getMunicipalityEconomic()` - Get economic indicators (PIB, sectors)
- `getMunicipalityInfrastructure()` - Get infrastructure indicators (water, sewage, internet)
- `getIndicatorsRanking()` - Rank municipalities by indicator

#### COMEX API (Agricultural Exports)
- `getComexOverview()` - Overview of Brazilian agricultural exports
- `getComexMunicipality()` - Export data for a specific municipality
- `getComexMunicipalityTimeseries()` - Historical export data
- `getComexProducts()` - List exported products
- `getComexCountries()` - List destination countries
- `getComexRanking()` - Rank municipalities by export metrics

#### SICOR API (Rural Credit)
- `getSicorOverview()` - Overview of rural credit operations
- `getSicorState()` - Rural credit data by state
- `getSicorStateTimeseries()` - Historical state data
- `getSicorByFinalidade()` - Credit by purpose
- `getSicorByAtividade()` - Credit by activity
- `getSicorByPrograma()` - Credit by program
- `getSicorRanking()` - Rank by rural credit metrics

#### Health API
- `listHealthEstablishments()` - List health establishments (CNES)
- `getHealthEstablishment()` - Get establishment details
- `getMunicipalityHealthStats()` - Health stats for a municipality
- `getHealthStats()` - National health statistics
- `searchHealthEstablishments()` - Search establishments by name

#### Education API
- `listSchools()` - List schools (INEP census)
- `getEducationOverview()` - Education overview statistics
- `getIDEBRanking()` - IDEB score ranking
- `getMunicipalityEducation()` - Education data for a municipality

#### Security API
- `listCrimeStats()` - List crime statistics
- `getSecurityOverview()` - Security overview (safest/most dangerous)
- `getCrimeTypes()` - List crime types
- `getCrimeRanking()` - Rank by crime metrics
- `getMunicipalityCrimeStats()` - Crime stats for a municipality

#### Employment API (CAGED)
- `listEmploymentMunicipalities()` - List employment data
- `getMunicipalityEmployment()` - Employment for a municipality
- `getEmploymentTimeseries()` - Historical employment data
- `getEmploymentRanking()` - Rank by employment metrics
- `getEmploymentOverview()` - National employment overview

#### AGRO API (Agriculture)
- `listAgroMunicipalities()` - List agricultural municipalities
- `getAgroMunicipality()` - Agricultural data for a municipality
- `getAgroTimeseries()` - Historical agricultural production
- `getAgroLandUse()` - Land use data
- `getAgroEmissions()` - Agricultural emissions (CO2, CH4, N2O)
- `getAgroRanking()` - Rank by agricultural metrics
- `getAgroStats()` - National agricultural statistics

#### POI API (Points of Interest)
- `searchPOIs()` - Search points of interest
- `searchNearbyPOIs()` - Location-based POI search
- `getPOICategories()` - List POI categories
- `getCityPOIStats()` - POI statistics for a city

#### Consolidated API
- `getConsolidatedCity()` - All data for a city in one call
- `getConsolidatedCitySummary()` - Summary of city data
