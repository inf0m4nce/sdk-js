/**
 * Basic usage example for the Infomance SDK.
 *
 * This example demonstrates:
 * - Creating a client instance
 * - Listing municipalities with filters
 * - Fetching a specific municipality by IBGE code
 * - Accessing economic and infrastructure data
 */

import { InfomanceClient } from 'infomance';

async function main() {
  // Create client with your API key
  const client = new InfomanceClient({
    apiKey: 'your-api-key',
  });

  // List municipalities in Sao Paulo state
  const municipios = await client.listMunicipalities({
    state: 'SP',
    limit: 10,
  });
  console.log('Municipalities in SP:', municipios.items);
  console.log('Total:', municipios.total);

  // Fetch a specific municipality (Sao Paulo city)
  const sp = await client.getMunicipality('3550308');
  console.log('Sao Paulo:', sp);

  // Get economic indicators
  const economic = await client.getMunicipalityEconomic('3550308');
  console.log('PIB:', economic.pib);
  console.log('PIB per capita:', economic.pib_per_capita);

  // Get infrastructure indicators
  const infrastructure = await client.getMunicipalityInfrastructure('3550308');
  console.log('Water coverage:', infrastructure.water_coverage, '%');
  console.log('Sewage treatment:', infrastructure.sewage_treatment, '%');

  // Get ranking by PIB per capita
  const ranking = await client.getIndicatorsRanking('pib_per_capita', {
    state: 'SP',
    limit: 5,
    order: 'desc',
  });
  console.log('Top 5 by PIB per capita in SP:');
  ranking.forEach((entry) => {
    console.log(`  ${entry.position}. ${entry.name}: R$ ${entry.value}`);
  });

  // Access rate limit info after any request
  console.log('Rate limit remaining:', client.rateLimit?.remaining);
  console.log('Last request ID:', client.lastRequestId);
}

main().catch(console.error);
