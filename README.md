# Infomance SDK

TypeScript SDK for the Infomance API - Brazilian municipalities socioeconomic and geospatial data.

## Installation

```bash
npm install @infomance/sdk
```

## Quick Start

```typescript
import { InfomanceClient } from '@infomance/sdk';

const client = new InfomanceClient({
  apiKey: 'your-api-key',
});

// Get municipality indicators
const saopaulo = await client.getMunicipality('3550308');
console.log(saopaulo);

// List municipalities
const municipalities = await client.listMunicipalities({ state: 'SP', limit: 10 });
console.log(municipalities.items);

// Get consolidated data (all data in one call)
const consolidated = await client.getConsolidatedCity('3550308');
console.log(consolidated);
```

## API Reference

### Indicators

```typescript
// List municipalities with economic indicators
const municipalities = await client.listMunicipalities({
  state: 'SP',
  limit: 100
});

// Get detailed municipality data
const municipality = await client.getMunicipality('3550308');

// Get economic data
const economic = await client.getMunicipalityEconomic('3550308');

// Get infrastructure data (sanitation, internet)
const infra = await client.getMunicipalityInfrastructure('3550308');

// Get rankings
const pibRanking = await client.getIndicatorsRanking('pib', {
  limit: 10,
  state: 'SP'
});
```

### COMEX (Agricultural Exports)

```typescript
// Get export overview
const overview = await client.getComexOverview();

// Get municipality exports
const exports = await client.getComexMunicipality('3550308');

// Get export timeseries
const timeseries = await client.getComexMunicipalityTimeseries('3550308');

// Get products list
const products = await client.getComexProducts({ limit: 20 });

// Get export rankings
const ranking = await client.getComexRanking('value_usd', { limit: 10 });
```

### SICOR (Rural Credit)

```typescript
// Get rural credit overview
const overview = await client.getSicorOverview();

// Get state data
const spData = await client.getSicorState('SP');

// Get by purpose/activity
const byFinalidade = await client.getSicorByFinalidade();
const byAtividade = await client.getSicorByAtividade();
```

### Health (CNES)

```typescript
// List health establishments
const establishments = await client.listHealthEstablishments({
  state: 'SP',
  type: 'hospital',
  limit: 50
});

// Get specific establishment
const hospital = await client.getHealthEstablishment('2077485');

// Get municipality health stats
const healthStats = await client.getMunicipalityHealthStats('3550308');

// Search establishments
const results = await client.searchHealthEstablishments('einstein');
```

### Education (INEP)

```typescript
// List schools
const schools = await client.listSchools({
  state: 'SP',
  network: 'municipal'
});

// Get IDEB rankings
const idebRanking = await client.getIDEBRanking({ limit: 20 });

// Get municipality education data
const education = await client.getMunicipalityEducation('3550308');
```

### Security

```typescript
// Get crime statistics
const crimeStats = await client.listCrimeStats({ state: 'SP', year: 2023 });

// Get overview
const overview = await client.getSecurityOverview();

// Get municipality crime data
const cityCrimes = await client.getMunicipalityCrimeStats('sao_paulo');
```

### AGRO (Agriculture)

```typescript
// List agricultural municipalities
const municipalities = await client.listAgroMunicipalities({ state: 'MT' });

// Get municipality agricultural data
const agro = await client.getAgroMunicipality('5103403');

// Get land use (MapBiomas)
const landUse = await client.getAgroLandUse('5103403');

// Get emissions (SEEG)
const emissions = await client.getAgroEmissions('5103403');
```

### POIs (Points of Interest)

```typescript
// Search POIs
const pois = await client.searchPOIs({
  city: 'sao_paulo',
  category: 'restaurant',
  limit: 20
});

// Search nearby
const nearby = await client.searchNearbyPOIs(-23.55, -46.63, 1000, {
  category: 'bank'
});

// Get city POI stats
const stats = await client.getCityPOIStats('sao_paulo');
```

### Consolidated

Get all data about a city in a single call:

```typescript
const city = await client.getConsolidatedCity('3550308');
console.log(city.indicators);
console.log(city.health);
console.log(city.education);
console.log(city.security);
console.log(city.employment);
console.log(city.agro);
```

### Export to CSV/Excel

```typescript
// Export to CSV
const csv = await client.exportToCSV('/api/v1/indicators/municipalities', {
  state: 'SP',
  limit: 100
});

// Export to Excel
const excel = await client.exportToExcel('/api/v1/comex/products', {
  year: 2024
});
```

## Error Handling

```typescript
import { InfomanceClient, InfomanceError } from '@infomance/sdk';

try {
  const data = await client.getMunicipality('invalid-code');
} catch (error) {
  if (error instanceof InfomanceError) {
    console.error(`API Error ${error.status}: ${error.message}`);
  } else {
    console.error('Network error:', error);
  }
}
```

## Configuration

```typescript
const client = new InfomanceClient({
  apiKey: 'your-api-key',            // Required - get yours at infomance.com.br
  baseUrl: 'https://api.infomance.com.br',  // Optional (default)
  timeout: 30000,                    // Request timeout in ms (default: 30000)
});
```

## TypeScript Support

The SDK is fully typed. All response types are exported:

```typescript
import {
  Municipality,
  MunicipalityIndicators,
  HealthEstablishment,
  School,
  POI,
  // ... and more
} from '@infomance/sdk';
```

## Security / Segurança

### Credential Storage / Armazenamento de Credenciais

Never hardcode your API key in source code. Use environment variables:

Nunca hardcode sua API key no código. Use variáveis de ambiente:

```typescript
import { InfomanceClient } from '@infomance/sdk';

const apiKey = process.env.INFOMANCE_API_KEY;
if (!apiKey) {
  throw new Error('INFOMANCE_API_KEY not set');
}

const client = new InfomanceClient({ apiKey });
```

### Secure Logging / Logging Seguro

The SDK **never** logs your API key. When using the logger option, only the following is logged:

O SDK **nunca** loga sua API key. Ao usar a opção logger, apenas o seguinte é logado:

- HTTP method and URL / Método HTTP e URL
- Response status code and timing / Status code e tempo de resposta
- Error messages (without credentials) / Mensagens de erro (sem credenciais)

```typescript
const client = new InfomanceClient({
  apiKey: process.env.INFOMANCE_API_KEY!,
  logger: console, // Safe - API key is never logged
});
```

### TLS/SSL

All connections use HTTPS with TLS certificate verification. The SDK does not provide an option to disable SSL verification.

Todas as conexões usam HTTPS com verificação de certificado TLS. O SDK não oferece opção para desabilitar a verificação SSL.

## Rate Limits

| Plan | Requests/month |
|------|---------------|
| Free | 1,000 |
| Starter | 10,000 |
| Professional | 50,000 |
| Business | 200,000 |

## Documentation

- [API Documentation](https://infomance.com.br/docs)
- [Pricing](https://infomance.com.br/pricing)

## Support

- Email: suporte@infomance.com.br
- Issues: https://github.com/infomance/sdk/issues
