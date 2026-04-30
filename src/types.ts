// ============================================
// Geo Data Service SDK - TypeScript Types
// ============================================

// Common Types
export interface Pagination {
  limit?: number;
  offset?: number;
}

export interface StateFilter {
  state?: string;
}

export interface YearFilter {
  year?: number;
}

// Municipality Types
export interface Municipality {
  ibge_code: string;
  name: string;
  state: string;
  region?: string;
}

export interface MunicipalityIndicators extends Municipality {
  population?: number;
  pib?: number;
  pib_per_capita?: number;
  area_km2?: number;
}

// Indicators Types
export interface EconomicData {
  pib: number;
  pib_per_capita: number;
  agriculture?: number;
  industry?: number;
  services?: number;
  taxes?: number;
  year: number;
}

export interface InfrastructureData {
  water_coverage?: number;
  sewage_collection?: number;
  sewage_treatment?: number;
  water_loss?: number;
  internet_accesses?: number;
  fiber_coverage?: number;
  year: number;
}

export interface IndicatorsMunicipality extends MunicipalityIndicators {
  economic?: EconomicData;
  infrastructure?: InfrastructureData;
}

// COMEX Types
export interface ComexProduct {
  code_sh4: string;
  value_usd: number;
  volume_kg: number;
  countries: number;
  year: number;
}

export interface ComexOverview {
  total_value_usd: number;
  total_volume_kg: number;
  total_products: number;
  total_countries: number;
  top_products: ComexProduct[];
  years: number[];
}

export interface ComexMunicipality {
  ibge_code: string;
  name: string;
  state: string;
  total_value_usd: number;
  total_volume_kg: number;
  products: ComexProduct[];
}

// SICOR Types
export interface SicorOverview {
  total_contracts: number;
  total_value_brl: number;
  total_area_ha: number;
  by_finalidade: SicorByCategory[];
  by_atividade: SicorByCategory[];
  years: number[];
}

export interface SicorByCategory {
  category: string;
  contracts: number;
  value_brl: number;
  area_ha: number;
}

export interface SicorState {
  uf: string;
  contracts: number;
  value_brl: number;
  area_ha: number;
  year: number;
}

// Health Types
export interface HealthEstablishment {
  cnes_code: string;
  name: string;
  establishment_type: string;
  management_type: string;
  ibge_code: string;
  state: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  total_beds: number;
  has_emergency: boolean;
  is_active: boolean;
}

export interface HealthStats {
  total_establishments: number;
  total_beds: number;
  by_type: { type: string; count: number }[];
  by_management: { management: string; count: number }[];
}

// Education Types
export interface School {
  inep_code: string;
  name: string;
  network: string;
  ibge_code: string;
  state: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  has_internet: boolean;
  has_library: boolean;
}

export interface IDEBScore {
  ibge_code: string;
  name: string;
  ideb_inicial?: number;
  ideb_final?: number;
  year: number;
}

// Security Types
export interface CrimeStats {
  city: string;
  state: string;
  crime_type: string;
  count: number;
  rate_per_100k?: number;
  year: number;
  month?: number;
}

export interface CrimeOverview {
  total_crimes: number;
  by_type: { type: string; count: number }[];
  most_dangerous: { city: string; rate: number }[];
  safest: { city: string; rate: number }[];
}

// Employment Types
export interface EmploymentData {
  ibge_code: string;
  name: string;
  admissions: number;
  dismissals: number;
  balance: number;
  formal_jobs: number;
  average_salary: number;
  year: number;
  month?: number;
}

// AGRO Types
export interface AgroMunicipality {
  ibge_code: string;
  name: string;
  state: string;
  total_estabelecimentos: number;
  area_total_ha: number;
  efetivo_bovino: number;
  valor_producao_mil_brl: number;
}

export interface AgroTimeseries {
  year: number;
  product: string;
  quantity: number;
  value_brl: number;
  area_ha?: number;
}

export interface LandUseData {
  year: number;
  class: string;
  area_ha: number;
  percentage: number;
}

export interface EmissionsData {
  year: number;
  sector: string;
  co2_tons: number;
  ch4_tons?: number;
  n2o_tons?: number;
}

// POI Types
export interface POI {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  city: string;
  latitude: number;
  longitude: number;
  address?: string;
  brand?: string;
  opening_hours?: string;
}

export interface POISearchParams extends Pagination {
  city?: string;
  category?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  q?: string;
}

// Consolidated Types
export interface ConsolidatedCity {
  municipality: Municipality;
  indicators?: IndicatorsMunicipality;
  health?: HealthStats;
  education?: { schools: number; ideb_inicial?: number; ideb_final?: number };
  security?: { total_crimes: number; rate_per_100k?: number };
  employment?: { formal_jobs: number; average_salary?: number };
  agro?: AgroMunicipality;
}

// Ranking Types
export interface RankingEntry {
  position: number;
  ibge_code: string;
  name: string;
  state: string;
  value: number;
}

export interface RankingParams extends Pagination, StateFilter, YearFilter {
  order?: 'asc' | 'desc';
}

// API Response Types
export interface ListResponse<T> {
  items: T[];
  total?: number;
  limit?: number;
  offset?: number;
}

export interface OverviewResponse<T> {
  summary: T;
  updated_at?: string;
}

// Export Format
export type ExportFormat = 'json' | 'csv' | 'xlsx';

// ============================================
// European Data Types
// ============================================

/** Supported countries for European data */
export type EuropeanCountry = 'pt' | 'fr' | 'de' | 'nl' | 'it' | 'es' | 'be' | 'at';

/** GeoJSON Feature for geographic data */
export interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: unknown;
  };
}

/** GeoJSON FeatureCollection */
export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

// Portugal Types
export interface PortugalMunicipality {
  dicofre: string;
  name: string;
  distrito: string;
  region: 'Continental' | 'Açores' | 'Madeira';
  area_km2?: number;
  population?: number;
}

export interface PortugalMunicipalityParams {
  distrito?: string;
  region?: 'continental' | 'acores' | 'madeira';
  simplify?: number;
  limit?: number;
  offset?: number;
}

// France Types
export interface FranceCommune {
  code_insee: string;
  nom: string;
  code_departement: string;
  code_region: string;
  population?: number;
  area_km2?: number;
}

export interface FranceCommuneParams {
  departement?: string;
  region?: string;
  limit?: number;
  offset?: number;
}

// Germany Types
export interface GermanyGemeinde {
  ags: string;
  ars: string;
  name: string;
  bundesland: string;
  kreis?: string;
  population?: number;
  area_km2?: number;
}

export interface GermanyGemeindeParams {
  bundesland?: string;
  kreis?: string;
  limit?: number;
  offset?: number;
}

// Netherlands Types
export interface NetherlandsGemeente {
  statcode: string;
  statnaam: string;
  province?: string;
  population?: number;
  area_km2?: number;
}

export interface NetherlandsGemeenteParams {
  province?: string;
  limit?: number;
  offset?: number;
}

// Italy Types
export interface ItalyComune {
  pro_com: string;
  comune: string;
  provincia?: string;
  regione?: string;
  population?: number;
  area_km2?: number;
}

export interface ItalyComuneParams {
  regione?: string;
  provincia?: string;
  limit?: number;
  offset?: number;
}

// Spain Types
export interface SpainMunicipio {
  codigo_ine: string;
  nombre: string;
  provincia?: string;
  comunidad_autonoma?: string;
  population?: number;
  area_km2?: number;
}

export interface SpainMunicipioParams {
  comunidad?: string;
  provincia?: string;
  limit?: number;
  offset?: number;
}

// ============================================
// Unified EU API Types (BFF endpoints)
// ============================================

/** EU Country from /api/v1/eu/countries */
export interface EUCountry {
  code: string;
  name: string;
  lau_count: number;
  population?: number;
  area_km2?: number;
}

/** EU LAU Municipality from /api/v1/eu/lau */
export interface EULAUMunicipality {
  lau_id: string;
  name: string;
  country_code: string;
  nuts3_code?: string;
  population?: number;
  population_density?: number;
  area_km2?: number;
  gdp_per_capita?: number;
  unemployment_rate?: number;
  data_completeness?: number;
}

/** EU NUTS Region from /api/v1/eu/nuts */
export interface EUNUTSRegion {
  code: string;
  name: string;
  level: number;
  country_code: string;
  parent_code?: string;
  lau_count?: number;
  population?: number;
  area_km2?: number;
}

/** Parameters for listing EU LAU municipalities */
export interface EULAUParams {
  country?: string;
  nuts3?: string;
  min_population?: number;
  max_population?: number;
  limit?: number;
  offset?: number;
}

/** Parameters for listing EU NUTS regions */
export interface EUNUTSParams {
  country?: string;
  level?: number;
  parent?: string;
  limit?: number;
  offset?: number;
}
