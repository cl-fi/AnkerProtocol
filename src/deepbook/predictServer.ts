import { DEEPBOOK_PREDICT, PREDICT_SERVER_URL } from '../config/deepbook';
import type { OracleMarket, PredictPricingState } from '../products/types';
import { fromChainPrice } from '../products/units';

export interface PredictStatus {
  maxCheckpointLag: number;
  maxTimeLagSeconds: number;
}

export interface PredictOracleListItem {
  predict_id: string;
  oracle_id: string;
  underlying_asset: string;
  expiry: number;
  min_strike: number;
  tick_size: number;
  status: string;
}

const MIN_TRADABLE_TIME_MS = 5 * 60_000;
const MIN_PRODUCT_EXPIRY_MS = 2 * 86_400_000;
const SVI_SCALE = 1_000_000_000;
const QUOTE_ASSET_SCALE = 10 ** DEEPBOOK_PREDICT.quoteAssetDecimals;

export function parseStatus(payload: unknown): PredictStatus {
  const data = payload as { max_checkpoint_lag?: number; max_time_lag_seconds?: number };
  return {
    maxCheckpointLag: Number(data.max_checkpoint_lag ?? 0),
    maxTimeLagSeconds: Number(data.max_time_lag_seconds ?? 0),
  };
}

export function parseOracleState(
  payload: unknown,
  input: { serverLagSeconds: number },
): OracleMarket {
  const data = payload as {
    oracle: {
      predict_id: string;
      oracle_id: string;
      underlying_asset: 'BTC';
      expiry: number;
      min_strike: number;
      tick_size: number;
      status: string;
    };
    latest_price: {
      spot: number | string;
      forward: number | string;
      onchain_timestamp: number;
    };
    latest_svi: {
      a?: number | string;
      b?: number | string;
      rho?: number | string;
      rho_negative?: boolean;
      m?: number | string;
      m_negative?: boolean;
      sigma?: number | string;
      onchain_timestamp: number;
    };
  };

  const svi = parseSvi(data.latest_svi);
  return {
    predictId: data.oracle.predict_id,
    oracleId: data.oracle.oracle_id,
    underlyingAsset: data.oracle.underlying_asset,
    expiryMs: data.oracle.expiry,
    minStrike: fromChainPrice(data.oracle.min_strike),
    tickSize: fromChainPrice(data.oracle.tick_size),
    status: data.oracle.status,
    spot: fromChainPrice(data.latest_price.spot),
    forward: fromChainPrice(data.latest_price.forward),
    spotTimestampMs: data.latest_price.onchain_timestamp,
    sviTimestampMs: data.latest_svi.onchain_timestamp,
    serverLagSeconds: input.serverLagSeconds,
    ...(svi ? { svi } : {}),
  };
}

function scaledSviValue(value: number | string | undefined, negative = false) {
  if (value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return (negative ? -numeric : numeric) / SVI_SCALE;
}

function parseSvi(input: {
  a?: number | string;
  b?: number | string;
  rho?: number | string;
  rho_negative?: boolean;
  m?: number | string;
  m_negative?: boolean;
  sigma?: number | string;
}) {
  const a = scaledSviValue(input.a);
  const b = scaledSviValue(input.b);
  const rho = scaledSviValue(input.rho, input.rho_negative);
  const m = scaledSviValue(input.m, input.m_negative);
  const sigma = scaledSviValue(input.sigma);
  if (a === null || b === null || rho === null || m === null || sigma === null) return null;
  return { a, b, rho, m, sigma };
}

function finiteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

  return {
    baseSpread: DEEPBOOK_PREDICT.baseSpread,
    minSpread: DEEPBOOK_PREDICT.minSpread,
    utilizationMultiplier: DEEPBOOK_PREDICT.utilizationMultiplier,
    minAskPrice: DEEPBOOK_PREDICT.minAskPrice,
    maxAskPrice: DEEPBOOK_PREDICT.maxAskPrice,
    vaultBalance: vaultBalanceBaseUnits / QUOTE_ASSET_SCALE,
    vaultTotalMtm: vaultTotalMtmBaseUnits / QUOTE_ASSET_SCALE,
    vaultUtilization,
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const baseUrl = typeof window === 'undefined' ? PREDICT_SERVER_URL : '/api/predict';
  const response = await fetch(`${baseUrl}${path}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Predict server request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchPredictStatus(): Promise<PredictStatus> {
  return parseStatus(await fetchJson('/status'));
}

export async function fetchPredictPricingState(
  predictObjectId = DEEPBOOK_PREDICT.predictObjectId,
): Promise<PredictPricingState> {
  const parsed = parsePredictPricingState(await fetchJson(`/predicts/${predictObjectId}/vault/summary`));
  if (!parsed) throw new Error('Predict vault summary is missing balance or MTM fields.');
  return parsed;
}

export async function fetchActiveBtcOracles(predictId: string): Promise<PredictOracleListItem[]> {
  const data = await fetchJson<PredictOracleListItem[]>(`/predicts/${predictId}/oracles`);
  return data.filter((oracle) => oracle.underlying_asset === 'BTC' && oracle.status === 'active');
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
  minTimeToExpiryMs = MIN_PRODUCT_EXPIRY_MS,
) {
  return [...oracles]
    .filter((oracle) => oracle.expiry - nowMs >= minTimeToExpiryMs)
    .sort((a, b) => a.expiry - b.expiry);
}

export async function fetchOracleMarket(
  oracleId: string,
  input: { serverLagSeconds: number },
): Promise<OracleMarket> {
  return parseOracleState(await fetchJson(`/oracles/${oracleId}/state`), input);
}
