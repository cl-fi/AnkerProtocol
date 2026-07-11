import { dayScaleFixtureMarkets } from '../deepbook/dayScaleFixtures';
import { fetchAllExpiryMarketSummaries } from '../deepbook/predictAdapter';
import {
  expiryMarketToListItem,
  fetchActiveBtcOracles,
  fetchOracleMarket,
  fetchPredictStatus,
  type PredictOracleListItem,
} from '../deepbook/predictServer';
import {
  resolveProductLineDataSource,
  type ProductLine,
  type ProductLineDataSource,
} from '../products/productLineMarkets';

const CURATED_ORACLE_CACHE_MS = 15_000;

export interface OracleReadiness {
  stateReady: boolean;
  quoteReady: boolean;
  reason?: string;
}

export interface CuratedOracleListItem extends PredictOracleListItem {
  stateReady: boolean;
  quoteReady: boolean;
  productReady: boolean;
  timeToExpiryMs: number;
  reason?: string;
}

export interface CuratedOracleMarketResponse {
  generatedAt: number;
  dataSource: 'live' | 'fixture';
  reason?: Extract<ProductLineDataSource, { kind: 'fixture' }>['reason'];
  oracles: CuratedOracleListItem[];
}

const curatedCache = new Map<
  ProductLine,
  {
    at: number;
    response: CuratedOracleMarketResponse | null;
    inFlight: Promise<CuratedOracleMarketResponse> | null;
  }
>();

function dedupeKey(oracle: PredictOracleListItem) {
  return `${oracle.underlying_asset}-${oracle.expiry}-${oracle.min_strike}-${oracle.tick_size}`;
}

function cacheSlot(productLine: ProductLine) {
  const existing = curatedCache.get(productLine);
  if (existing) return existing;
  const created = {
    at: 0,
    response: null as CuratedOracleMarketResponse | null,
    inFlight: null as Promise<CuratedOracleMarketResponse> | null,
  };
  curatedCache.set(productLine, created);
  return created;
}

export function curateBtcOracles(
  oracles: PredictOracleListItem[],
  readinessByOracleId: Map<string, OracleReadiness>,
  nowMs = Date.now(),
): CuratedOracleListItem[] {
  const bestByKey = new Map<string, CuratedOracleListItem>();

  oracles
    .filter((oracle) => oracle.underlying_asset === 'BTC')
    .filter((oracle) => oracle.status === 'active')
    .filter((oracle) => oracle.expiry > nowMs)
    .forEach((oracle) => {
      const readiness = readinessByOracleId.get(oracle.oracle_id);
      const timeToExpiryMs = oracle.expiry - nowMs;
      const stateReady = Boolean(readiness?.stateReady);
      const quoteReady = Boolean(readiness?.quoteReady);
      // Turbo 1h markets are product-ready once discovered and state-readable (ADR-0002).
      const productReady = stateReady;
      const item: CuratedOracleListItem = {
        ...oracle,
        stateReady,
        quoteReady,
        productReady,
        timeToExpiryMs,
        reason: readiness?.reason,
      };

      if (!item.productReady) return;

      const key = dedupeKey(item);
      const current = bestByKey.get(key);
      if (!current || Number(item.quoteReady) > Number(current.quoteReady)) {
        bestByKey.set(key, item);
      }
    });

  return [...bestByKey.values()].sort((a, b) => a.expiry - b.expiry);
}

function fixtureCuratedOracles(nowMs: number): CuratedOracleListItem[] {
  return dayScaleFixtureMarkets(nowMs).map((market) => {
    const item = expiryMarketToListItem(market, 'multi-day');
    return {
      ...item,
      stateReady: true,
      quoteReady: true,
      productReady: true,
      timeToExpiryMs: market.expiryMs - nowMs,
    };
  });
}

async function getOracleReadiness(input: {
  oracle: PredictOracleListItem;
  serverLagSeconds: number;
}): Promise<OracleReadiness> {
  try {
    const market = await fetchOracleMarket(input.oracle.oracle_id, {
      serverLagSeconds: input.serverLagSeconds,
    });
    const stateReady =
      Number.isFinite(market.spot) &&
      market.spot > 0 &&
      Number.isFinite(market.forward) &&
      market.forward > 0 &&
      Boolean(market.spotTimestampMs);

    if (!stateReady) {
      return { stateReady: false, quoteReady: false, reason: 'Expiry market state is incomplete.' };
    }

    // Full SVI quote path: quote-ready when SVI params are present for browse pricing.
    return { stateReady: true, quoteReady: Boolean(market.svi) };
  } catch (error) {
    return {
      stateReady: false,
      quoteReady: false,
      reason: error instanceof Error ? error.message : 'Oracle readiness check failed.',
    };
  }
}

async function computeTurboCuratedResponse(nowMs: number): Promise<CuratedOracleMarketResponse> {
  const [status, candidateOracles] = await Promise.all([fetchPredictStatus(), fetchActiveBtcOracles('turbo')]);
  const readinessEntries = await Promise.all(
    candidateOracles.map(
      async (oracle) =>
        [
          oracle.oracle_id,
          await getOracleReadiness({
            oracle,
            serverLagSeconds: status.maxTimeLagSeconds,
          }),
        ] as const,
    ),
  );

  return {
    generatedAt: nowMs,
    dataSource: 'live',
    oracles: curateBtcOracles(candidateOracles, new Map(readinessEntries), nowMs),
  };
}

async function computeMultiDayCuratedResponse(nowMs: number): Promise<CuratedOracleMarketResponse> {
  const discovered = await fetchAllExpiryMarketSummaries();
  const source = resolveProductLineDataSource({
    line: 'multi-day',
    discovered,
    fixtures: dayScaleFixtureMarkets(nowMs),
    nowMs,
  });

  if (source.kind === 'fixture') {
    return {
      generatedAt: nowMs,
      dataSource: 'fixture',
      reason: source.reason,
      oracles: fixtureCuratedOracles(nowMs),
    };
  }

  const candidateOracles = source.markets.map((market) => expiryMarketToListItem(market, 'multi-day'));
  const status = await fetchPredictStatus();
  const readinessEntries = await Promise.all(
    candidateOracles.map(
      async (oracle) =>
        [
          oracle.oracle_id,
          await getOracleReadiness({
            oracle,
            serverLagSeconds: status.maxTimeLagSeconds,
          }),
        ] as const,
    ),
  );

  return {
    generatedAt: nowMs,
    dataSource: 'live',
    oracles: curateBtcOracles(candidateOracles, new Map(readinessEntries), nowMs),
  };
}

async function computeCuratedBtcOracleResponse(
  nowMs: number,
  productLine: ProductLine,
): Promise<CuratedOracleMarketResponse> {
  if (productLine === 'multi-day') {
    return computeMultiDayCuratedResponse(nowMs);
  }
  return computeTurboCuratedResponse(nowMs);
}

export async function buildCuratedBtcOracleResponse(
  nowMs = Date.now(),
  productLine: ProductLine = 'turbo',
): Promise<CuratedOracleMarketResponse> {
  const slot = cacheSlot(productLine);
  if (slot.response && nowMs >= slot.at && nowMs - slot.at < CURATED_ORACLE_CACHE_MS) {
    return slot.response;
  }

  if (slot.inFlight) {
    return slot.inFlight;
  }

  slot.inFlight = computeCuratedBtcOracleResponse(nowMs, productLine)
    .then((response) => {
      slot.at = nowMs;
      slot.response = response;
      return response;
    })
    .finally(() => {
      slot.inFlight = null;
    });
  return slot.inFlight;
}

export function parseProductLineParam(value: string | null): ProductLine {
  return value === 'multi-day' ? 'multi-day' : 'turbo';
}
