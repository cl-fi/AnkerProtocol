import { PREDICT_SERVER_URL } from '../config/deepbook';
import type { OracleMarket } from '../products/types';
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
      onchain_timestamp: number;
    };
  };

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
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${PREDICT_SERVER_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Predict server request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchPredictStatus(): Promise<PredictStatus> {
  return parseStatus(await fetchJson('/status'));
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
