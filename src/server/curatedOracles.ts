import type { PredictOracleListItem } from '../deepbook/predictServer';
import { fetchActiveBtcOracles, fetchOracleMarket, fetchPredictStatus } from '../deepbook/predictServer';
import { DEEPBOOK_PREDICT } from '../config/deepbook';

const MIN_PRODUCT_READY_EXPIRY_MS = 12 * 60 * 60_000;
const CURATED_ORACLE_CACHE_MS = 15_000;

let cachedCuratedResponse: CuratedOracleMarketResponse | null = null;
let cachedCuratedAt = 0;
let inFlightCuratedResponse: Promise<CuratedOracleMarketResponse> | null = null;

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
  oracles: CuratedOracleListItem[];
}

function dedupeKey(oracle: PredictOracleListItem) {
  return `${oracle.underlying_asset}-${oracle.expiry}-${oracle.min_strike}-${oracle.tick_size}`;
}

export function curateBtcOracles(
  oracles: PredictOracleListItem[],
  readinessByOracleId: Map<string, OracleReadiness>,
  nowMs = Date.now(),
  minProductReadyExpiryMs = MIN_PRODUCT_READY_EXPIRY_MS,
): CuratedOracleListItem[] {
  const bestByKey = new Map<string, CuratedOracleListItem>();

  oracles
    .filter((oracle) => oracle.underlying_asset === 'BTC')
    .filter((oracle) => oracle.status === 'active')
    .filter((oracle) => oracle.expiry > nowMs)
    .forEach((oracle) => {
      const readiness = readinessByOracleId.get(oracle.oracle_id);
      const timeToExpiryMs = oracle.expiry - nowMs;
      const productReady = Boolean(readiness?.stateReady && timeToExpiryMs >= minProductReadyExpiryMs);
      const item: CuratedOracleListItem = {
        ...oracle,
        stateReady: Boolean(readiness?.stateReady),
        quoteReady: Boolean(readiness?.quoteReady),
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
      Boolean(market.spotTimestampMs) &&
      Boolean(market.sviTimestampMs);

    if (!stateReady) {
      return { stateReady: false, quoteReady: false, reason: 'Oracle state is incomplete.' };
    }

    return { stateReady: true, quoteReady: true };
  } catch (error) {
    return {
      stateReady: false,
      quoteReady: false,
      reason: error instanceof Error ? error.message : 'Oracle readiness check failed.',
    };
  }
}

async function computeCuratedBtcOracleResponse(nowMs: number): Promise<CuratedOracleMarketResponse> {
  const [status, rawOracles] = await Promise.all([
    fetchPredictStatus(),
    fetchActiveBtcOracles(DEEPBOOK_PREDICT.predictObjectId),
  ]);
  const candidateOracles = rawOracles.filter((oracle) => oracle.expiry - nowMs >= MIN_PRODUCT_READY_EXPIRY_MS);
  const readinessEntries = await Promise.all(
    candidateOracles.map(async (oracle) => [
      oracle.oracle_id,
      await getOracleReadiness({
        oracle,
        serverLagSeconds: status.maxTimeLagSeconds,
      }),
    ] as const),
  );

  cachedCuratedAt = nowMs;
  cachedCuratedResponse = {
    generatedAt: nowMs,
    oracles: curateBtcOracles(candidateOracles, new Map(readinessEntries), nowMs),
  };
  return cachedCuratedResponse;
}

export async function buildCuratedBtcOracleResponse(nowMs = Date.now()): Promise<CuratedOracleMarketResponse> {
  if (
    cachedCuratedResponse &&
    nowMs >= cachedCuratedAt &&
    nowMs - cachedCuratedAt < CURATED_ORACLE_CACHE_MS
  ) {
    return cachedCuratedResponse;
  }

  if (inFlightCuratedResponse) {
    return inFlightCuratedResponse;
  }

  inFlightCuratedResponse = computeCuratedBtcOracleResponse(nowMs).finally(() => {
    inFlightCuratedResponse = null;
  });
  return inFlightCuratedResponse;
}
