import { DEEPBOOK_PREDICT } from '../config/deepbook';
import { LEGACY_PREDICT } from '../config/legacyPredict';
import { fromChainPrice } from '../products/units';
import type { OracleMarket, SviParameters } from '../products/types';

/**
 * Parsers for oracle objects from the retired 4-16 deployment (CONTEXT:
 * Legacy Oracle). Only used to parse the committed Snapshot — the app never
 * reads these objects from chain anymore (ADR-0004).
 */

/** One oracle object captured from the retired 4-16 deployment (CONTEXT: Legacy Oracle). */
export interface LegacyOracleState {
  oracleId: string;
  underlyingAsset: string;
  expiryMs: number;
  active: boolean;
  settled: boolean;
  /** USD prices (chain values are 1e9-scaled). */
  spot: number;
  forward: number;
  svi: SviParameters;
  /** Last oracle push, from the object's own timestamp field. */
  updatedAtMs: number;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function finiteNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/** Move sign-magnitude fixed value ({ magnitude, is_negative }) or plain numeric. */
function signedFixed(value: unknown): number | null {
  if (typeof value === 'number' || typeof value === 'string') {
    return finiteNumber(value);
  }
  if (!isRecord(value)) return null;
  const magnitude = finiteNumber(value.magnitude);
  if (magnitude === null) return null;
  return (value.is_negative ?? value.negative) ? -magnitude : magnitude;
}

/** Parse the 4-16 `oracle::OracleSVI` object JSON into a LegacyOracleState. */
export function parseLegacyOracleObject(payload: unknown): LegacyOracleState | null {
  if (!isRecord(payload)) return null;
  const oracleId = typeof payload.id === 'string' ? payload.id : null;
  const underlyingAsset = typeof payload.underlying_asset === 'string' ? payload.underlying_asset : null;
  const expiryMs = finiteNumber(payload.expiry);
  const updatedAtMs = finiteNumber(payload.timestamp);
  const prices = isRecord(payload.prices) ? payload.prices : null;
  const spotRaw = prices ? finiteNumber(prices.spot) : null;
  const forwardRaw = prices ? finiteNumber(prices.forward) : null;
  const sviRaw = isRecord(payload.svi) ? payload.svi : null;
  const a = sviRaw ? finiteNumber(sviRaw.a) : null;
  const b = sviRaw ? finiteNumber(sviRaw.b) : null;
  const sigma = sviRaw ? finiteNumber(sviRaw.sigma) : null;
  const rho = sviRaw ? signedFixed(sviRaw.rho) : null;
  const m = sviRaw ? signedFixed(sviRaw.m) : null;

  if (
    !oracleId ||
    !underlyingAsset ||
    expiryMs === null ||
    updatedAtMs === null ||
    spotRaw === null ||
    forwardRaw === null ||
    a === null ||
    b === null ||
    sigma === null ||
    rho === null ||
    m === null
  ) {
    return null;
  }

  const spot = fromChainPrice(spotRaw);
  const forward = fromChainPrice(forwardRaw);
  if (!(spot > 0) || !(forward > 0)) return null;

  return {
    oracleId,
    underlyingAsset,
    expiryMs,
    active: payload.active === true,
    settled: payload.settlement_price !== null && payload.settlement_price !== undefined,
    spot,
    forward,
    svi: {
      a: fromChainPrice(a),
      b: fromChainPrice(b),
      rho: fromChainPrice(rho),
      m: fromChainPrice(m),
      sigma: fromChainPrice(sigma),
    },
    updatedAtMs,
  };
}

/** Captured Legacy Oracles usable as day tenors: BTC, active, unsettled, expiry after the capture clock. */
export function filterDayLegacyOracles(
  oracles: readonly (LegacyOracleState | null)[],
  nowMs: number,
): LegacyOracleState[] {
  return oracles
    .filter((oracle): oracle is LegacyOracleState => oracle !== null)
    .filter(
      (oracle) =>
        oracle.underlyingAsset === DEEPBOOK_PREDICT.underlyingAsset &&
        oracle.active &&
        !oracle.settled &&
        oracle.expiryMs > nowMs,
    )
    .sort((a, b) => a.expiryMs - b.expiryMs);
}

/**
 * Browse OracleMarket for a Snapshot row. Strike wiring uses the 4-16 $1
 * grid (tick 1e9); admissionTickSize stays unset so day rows keep the classic
 * $500 browse ladder. Never tradable — quotes are indicative only.
 */
export function legacyOracleToMarket(
  state: LegacyOracleState,
  input: { serverLagSeconds?: number } = {},
): OracleMarket {
  return {
    predictId: LEGACY_PREDICT.predictObjectId,
    oracleId: state.oracleId,
    underlyingAsset: 'BTC',
    expiryMs: state.expiryMs,
    minStrike: 1,
    tickSize: 1,
    status: 'active',
    spot: state.spot,
    forward: state.forward,
    spotTimestampMs: state.updatedAtMs,
    sviTimestampMs: state.updatedAtMs,
    serverLagSeconds: input.serverLagSeconds ?? 1,
    svi: state.svi,
    predictPricing: {
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
    },
  };
}
