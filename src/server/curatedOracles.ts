import { fetchAllExpiryMarketSummaries } from '../deepbook/predictAdapter';
import {
  legacyOracleToMarket,
  type LegacyOracleState,
} from '../deepbook/legacyOracles';
import {
  expiryMarketToListItem,
  fetchActiveBtcOracles,
  fetchOracleMarket,
  fetchPredictStatus,
  type PredictOracleListItem,
} from '../deepbook/predictServer';
import {
  filterMarketsForTenorGroup,
  type TenorSource,
} from '../products/tenorMarkets';
import type { OracleMarket } from '../products/types';
import { loadDaySnapshot, type DaySnapshotMeta } from './daySnapshot';

const CURATED_ORACLE_CACHE_MS = 15_000;

export type { DaySnapshotMeta } from './daySnapshot';

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
  /** Row-level provenance (CONTEXT: Snapshot). Only 'live' rows are tradable. */
  source: TenorSource;
  /** Embedded browse market for rows the 6-24 indexer cannot serve (snapshot). */
  market?: OracleMarket;
}

export interface CuratedOracleMarketResponse {
  generatedAt: number;
  /** Day rows first (primary product), then hourly rows; expiry-sorted within each group. */
  oracles: CuratedOracleListItem[];
  /** Present when day rows come from the committed Snapshot (photograph model). */
  snapshot?: DaySnapshotMeta;
}

const cache: {
  at: number;
  response: CuratedOracleMarketResponse | null;
  inFlight: Promise<CuratedOracleMarketResponse> | null;
} = { at: 0, response: null, inFlight: null };

function dedupeKey(oracle: PredictOracleListItem) {
  return `${oracle.underlying_asset}-${oracle.expiry}-${oracle.min_strike}-${oracle.tick_size}`;
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
      // Live rows are product-ready once discovered and state-readable (ADR-0002).
      const productReady = stateReady;
      const item: CuratedOracleListItem = {
        ...oracle,
        stateReady,
        quoteReady,
        productReady,
        timeToExpiryMs,
        reason: readiness?.reason,
        source: 'live',
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

/** Day tenor row backed by the Snapshot; browse state embedded. */
export function legacyOracleToListItem(
  state: LegacyOracleState,
  input: { nowMs: number; source: Extract<TenorSource, 'snapshot'> },
): CuratedOracleListItem {
  const market = legacyOracleToMarket(state);
  return {
    predict_id: market.predictId,
    oracle_id: state.oracleId,
    underlying_asset: 'BTC',
    expiry: state.expiryMs,
    min_strike: market.minStrike,
    tick_size: market.tickSize,
    admission_tick_size: market.tickSize,
    status: 'active',
    group: 'day',
    stateReady: true,
    quoteReady: true,
    productReady: true,
    // For snapshot rows the caller passes the capture clock (photograph model).
    timeToExpiryMs: state.expiryMs - input.nowMs,
    source: input.source,
    market,
  };
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

async function curateWithReadiness(candidateOracles: PredictOracleListItem[], nowMs: number) {
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
  return curateBtcOracles(candidateOracles, new Map(readinessEntries), nowMs);
}

async function computeHourlyRows(nowMs: number): Promise<CuratedOracleListItem[]> {
  const candidateOracles = await fetchActiveBtcOracles('hourly');
  return curateWithReadiness(candidateOracles, nowMs);
}

/**
 * Day ladder: live 6-24 day-scale Expiry Markets → committed Snapshot
 * (ADR-0004). Live rows self-retire the Snapshot with no code change; error
 * and empty discovery both fall to the same photograph. Invented fixtures
 * never appear here.
 */
async function computeDayRows(nowMs: number): Promise<{
  oracles: CuratedOracleListItem[];
  snapshot?: DaySnapshotMeta;
}> {
  try {
    const discovered = await fetchAllExpiryMarketSummaries();
    const dayMarkets = filterMarketsForTenorGroup(discovered, 'day', { nowMs });
    if (dayMarkets.length > 0) {
      const curated = await curateWithReadiness(
        dayMarkets.map((market) => expiryMarketToListItem(market, 'day')),
        nowMs,
      );
      if (curated.length > 0) return { oracles: curated };
    }
  } catch {
    // Live day discovery down — fall through to the committed Snapshot.
  }

  const snapshot = loadDaySnapshot();
  return {
    oracles: snapshot.oracles.map((state) =>
      legacyOracleToListItem(state, { nowMs: snapshot.capturedAtMs, source: 'snapshot' }),
    ),
    snapshot: { capturedAtMs: snapshot.capturedAtMs, binanceProducts: snapshot.binanceProducts },
  };
}

async function computeMergedResponse(nowMs: number): Promise<CuratedOracleMarketResponse> {
  const [day, hourly] = await Promise.all([
    computeDayRows(nowMs),
    // Hourly discovery failure must not blank the day group; the client refetches on its 15s cycle.
    computeHourlyRows(nowMs).catch(() => [] as CuratedOracleListItem[]),
  ]);

  return {
    generatedAt: nowMs,
    oracles: [...day.oracles, ...hourly],
    snapshot: day.snapshot,
  };
}

export async function buildCuratedBtcOracleResponse(
  nowMs = Date.now(),
): Promise<CuratedOracleMarketResponse> {
  if (cache.response && nowMs >= cache.at && nowMs - cache.at < CURATED_ORACLE_CACHE_MS) {
    return cache.response;
  }

  if (cache.inFlight) {
    return cache.inFlight;
  }

  cache.inFlight = computeMergedResponse(nowMs)
    .then((response) => {
      cache.at = nowMs;
      cache.response = response;
      return response;
    })
    .finally(() => {
      cache.inFlight = null;
    });
  return cache.inFlight;
}
