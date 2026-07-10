import { DEEPBOOK_PREDICT, PREDICT_SERVER_URL, PROPBOOK_SERVER_URL } from '../config/deepbook';
import type { OracleMarket, PredictPricingState } from '../products/types';
import { fromChainPrice } from '../products/units';
import { fetchBlockScholesForward, fetchBlockScholesSpot, fetchBlockScholesSvi } from './blockScholesFeeds';
import { predictAdapter, type ExpiryMarketSummary } from './predictAdapter';
import {
  isOracleTimestampFresh,
  parsePythSpotObservation,
  resolveLiveForward,
} from './propbookOracle';

export interface PredictStatus {
  maxCheckpointLag: number;
  maxTimeLagSeconds: number;
}

/** List-row shape kept for curated API / UI compatibility during the 6-24 migration. */
export interface PredictOracleListItem {
  predict_id: string;
  oracle_id: string;
  underlying_asset: string;
  expiry: number;
  min_strike: number;
  tick_size: number;
  admission_tick_size: number;
  status: string;
  cadence: '1h';
}

const MIN_TRADABLE_TIME_MS = 5 * 60_000;
const QUOTE_ASSET_SCALE = 10 ** DEEPBOOK_PREDICT.quoteAssetDecimals;
/** Pyth freshness window for re-anchoring forward (matches typical Predict defaults). */
const PYTH_SPOT_FRESHNESS_MS = 60_000;
const FLOAT_SCALE = 1_000_000_000;

export function parseStatus(payload: unknown): PredictStatus {
  const data = payload as { max_checkpoint_lag?: number; max_time_lag_seconds?: number };
  return {
    maxCheckpointLag: Number(data.max_checkpoint_lag ?? 0),
    maxTimeLagSeconds: Number(data.max_time_lag_seconds ?? 0),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finiteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function scaledProbability(value: unknown): number | null {
  const raw = finiteNumber(value);
  if (raw === null) return null;
  return raw / FLOAT_SCALE;
}

export function expiryMarketToListItem(market: ExpiryMarketSummary): PredictOracleListItem {
  return {
    predict_id: market.poolVaultId,
    oracle_id: market.expiryMarketId,
    underlying_asset: DEEPBOOK_PREDICT.underlyingAsset,
    expiry: market.expiryMs,
    min_strike: market.admissionTickSize,
    tick_size: market.tickSize,
    admission_tick_size: market.admissionTickSize,
    status: 'active',
    cadence: '1h',
  };
}

export function parsePredictPricingState(payload: unknown): PredictPricingState | null {
  if (!isRecord(payload)) return null;
  const vaultBalanceBaseUnits = finiteNumber(payload.vault_balance);
  const vaultTotalMtmBaseUnits = finiteNumber(payload.total_mtm);
  if (vaultBalanceBaseUnits === null || vaultTotalMtmBaseUnits === null) return null;

  const utilization = finiteNumber(payload.utilization);
  const vaultUtilization =
    utilization === null
      ? vaultBalanceBaseUnits <= 0 || vaultTotalMtmBaseUnits <= 0
        ? 0
        : Math.min(1, vaultTotalMtmBaseUnits / vaultBalanceBaseUnits)
      : Math.min(1, Math.max(0, utilization));

  const baseFee = scaledProbability(payload.base_fee) ?? DEEPBOOK_PREDICT.baseSpread;
  const minFee = scaledProbability(payload.min_fee) ?? DEEPBOOK_PREDICT.minSpread;

  return {
    baseSpread: baseFee,
    minSpread: minFee,
    baseFee,
    minFee,
    utilizationMultiplier: DEEPBOOK_PREDICT.utilizationMultiplier,
    minAskPrice: DEEPBOOK_PREDICT.minAskPrice,
    maxAskPrice: DEEPBOOK_PREDICT.maxAskPrice,
    vaultBalance: vaultBalanceBaseUnits / QUOTE_ASSET_SCALE,
    vaultTotalMtm: vaultTotalMtmBaseUnits / QUOTE_ASSET_SCALE,
    vaultUtilization,
    ewmaPenaltyRate: 0,
    expiryFeeWindowMs: finiteNumber(payload.expiry_fee_window_ms) ?? undefined,
    expiryFeeMaxMultiplier: scaledProbability(payload.expiry_fee_max_multiplier) ?? undefined,
  };
}

async function fetchPredictJson<T>(path: string): Promise<T> {
  const baseUrl = typeof window === 'undefined' ? PREDICT_SERVER_URL : '/api/predict';
  const response = await fetch(`${baseUrl}${path}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Predict server request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

async function fetchPropbookJson<T>(path: string): Promise<T> {
  const baseUrl = typeof window === 'undefined' ? PROPBOOK_SERVER_URL : '/api/propbook';
  const response = await fetch(`${baseUrl}${path}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Propbook request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchPredictStatus(): Promise<PredictStatus> {
  return parseStatus(await fetchPredictJson('/status'));
}

export async function fetchActiveBtcOracles(): Promise<PredictOracleListItem[]> {
  const markets = await predictAdapter.discoverMarkets();
  return markets.map(expiryMarketToListItem);
}

export function selectNearestTradableOracle(
  oracles: PredictOracleListItem[],
  nowMs = Date.now(),
  minTimeToExpiryMs = MIN_TRADABLE_TIME_MS,
) {
  const sorted = [...oracles].sort((a, b) => a.expiry - b.expiry);
  return sorted.find((oracle) => oracle.expiry - nowMs > minTimeToExpiryMs) ?? sorted[0];
}

export function filterProductExpiryOracles(
  oracles: PredictOracleListItem[],
  nowMs = Date.now(),
  minTimeToExpiryMs = 0,
) {
  return [...oracles]
    .filter((oracle) => oracle.expiry - nowMs >= minTimeToExpiryMs)
    .sort((a, b) => a.expiry - b.expiry);
}

function parseMarketStateRow(payload: unknown): {
  expiryMarketId: string;
  expiryMs: number;
  tickSize: number;
  admissionTickSize: number;
  poolVaultId: string;
  baseFee: number;
  minFee: number;
  expiryFeeWindowMs: number;
  expiryFeeMaxMultiplier: number;
} | null {
  if (!isRecord(payload)) return null;
  const market = isRecord(payload.market) ? payload.market : payload;
  const expiryMarketId = typeof market.expiry_market_id === 'string' ? market.expiry_market_id : null;
  const expiryMs = finiteNumber(market.expiry);
  const tickSizeRaw = finiteNumber(market.tick_size);
  const admissionTickSizeRaw = finiteNumber(market.admission_tick_size);
  const poolVaultId =
    (typeof market.pool_vault_id === 'string' && market.pool_vault_id) || DEEPBOOK_PREDICT.poolVaultId;
  const baseFee = scaledProbability(market.base_fee) ?? DEEPBOOK_PREDICT.baseSpread;
  const minFee = scaledProbability(market.min_fee) ?? DEEPBOOK_PREDICT.minSpread;
  const expiryFeeWindowMs = finiteNumber(market.expiry_fee_window_ms) ?? 0;
  const expiryFeeMaxMultiplier = scaledProbability(market.expiry_fee_max_multiplier) ?? 1;
  if (!expiryMarketId || expiryMs === null || tickSizeRaw === null || admissionTickSizeRaw === null) {
    return null;
  }
  return {
    expiryMarketId,
    expiryMs,
    tickSize: fromChainPrice(tickSizeRaw),
    admissionTickSize: fromChainPrice(admissionTickSizeRaw),
    poolVaultId,
    baseFee,
    minFee,
    expiryFeeWindowMs,
    expiryFeeMaxMultiplier,
  };
}

function defaultPredictPricing(fees: {
  baseFee: number;
  minFee: number;
  expiryFeeWindowMs: number;
  expiryFeeMaxMultiplier: number;
}): PredictPricingState {
  return {
    baseSpread: fees.baseFee,
    minSpread: fees.minFee,
    baseFee: fees.baseFee,
    minFee: fees.minFee,
    utilizationMultiplier: DEEPBOOK_PREDICT.utilizationMultiplier,
    minAskPrice: DEEPBOOK_PREDICT.minAskPrice,
    maxAskPrice: DEEPBOOK_PREDICT.maxAskPrice,
    vaultBalance: 0,
    vaultTotalMtm: 0,
    vaultUtilization: 0,
    ewmaPenaltyRate: 0,
    expiryFeeWindowMs: fees.expiryFeeWindowMs,
    expiryFeeMaxMultiplier: fees.expiryFeeMaxMultiplier,
  };
}

/**
 * Server-side assembly for browse quotes.
 * Propbook HTTP currently exposes pyth/latest; Block Scholes spot/forward/SVI
 * are indexed but their REST routes 404, so we read the same feed objects
 * on-chain via gRPC (same data the propbook indexer consumes).
 */
export async function fetchOracleMarketServer(
  expiryMarketId: string,
  input: { serverLagSeconds: number; nowMs?: number },
): Promise<OracleMarket> {
  const nowMs = input.nowMs ?? Date.now();
  const [statePayload, pythPayload] = await Promise.all([
    fetchPredictJson<unknown>(`/markets/${expiryMarketId}/state`),
    fetchPropbookJson<unknown>(`/oracles/${DEEPBOOK_PREDICT.feeds.pyth}/pyth/latest`),
  ]);

  const market = parseMarketStateRow(statePayload);
  if (!market) {
    throw new Error(`Expiry market state is incomplete for ${expiryMarketId}`);
  }
  const pyth = parsePythSpotObservation(pythPayload);
  if (!pyth) {
    throw new Error('Propbook pyth spot is unavailable.');
  }

  const [bsSpot, bsForward, bsSvi] = await Promise.all([
    fetchBlockScholesSpot().catch(() => null),
    fetchBlockScholesForward(market.expiryMs).catch(() => null),
    fetchBlockScholesSvi(market.expiryMs).catch(() => null),
  ]);

  const pythFresh = isOracleTimestampFresh({
    sourceTimestampMs: pyth.sourceTimestampMs,
    nowMs,
    freshnessMs: PYTH_SPOT_FRESHNESS_MS,
  });

  const forward =
    bsSpot && bsForward
      ? resolveLiveForward({
          pythSpot: pyth.spot,
          pythFresh,
          bsSpot: bsSpot.spot,
          bsForward: bsForward.forward,
        })
      : (bsForward?.forward ?? pyth.spot);

  return {
    predictId: market.poolVaultId,
    oracleId: market.expiryMarketId,
    underlyingAsset: 'BTC',
    expiryMs: market.expiryMs,
    minStrike: market.admissionTickSize,
    tickSize: market.tickSize,
    admissionTickSize: market.admissionTickSize,
    status: 'active',
    spot: pyth.spot,
    forward,
    spotTimestampMs: pyth.sourceTimestampMs,
    sviTimestampMs: bsSvi?.sourceTimestampMs ?? pyth.sourceTimestampMs,
    serverLagSeconds: input.serverLagSeconds,
    svi: bsSvi?.svi,
    predictPricing: defaultPredictPricing(market),
  };
}

export async function fetchOracleMarket(
  expiryMarketId: string,
  input: { serverLagSeconds: number },
): Promise<OracleMarket> {
  if (typeof window !== 'undefined') {
    const response = await fetch(
      `/api/oracles/${expiryMarketId}/market?lag=${encodeURIComponent(String(input.serverLagSeconds))}`,
      { cache: 'no-store' },
    );
    if (!response.ok) {
      throw new Error(`Oracle market request failed: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<OracleMarket>;
  }
  return fetchOracleMarketServer(expiryMarketId, input);
}

/** Vault summary endpoint was removed in 6-24; keep a no-op for callers until PLP wiring lands. */
export async function fetchPredictPricingState(): Promise<PredictPricingState> {
  return {
    baseSpread: DEEPBOOK_PREDICT.baseSpread,
    minSpread: DEEPBOOK_PREDICT.minSpread,
    baseFee: DEEPBOOK_PREDICT.baseSpread,
    minFee: DEEPBOOK_PREDICT.minSpread,
    utilizationMultiplier: DEEPBOOK_PREDICT.utilizationMultiplier,
    minAskPrice: DEEPBOOK_PREDICT.minAskPrice,
    maxAskPrice: DEEPBOOK_PREDICT.maxAskPrice,
    vaultBalance: 0,
    vaultTotalMtm: 0,
    vaultUtilization: 0,
    ewmaPenaltyRate: 0,
  };
}
