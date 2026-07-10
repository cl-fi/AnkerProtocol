import { fromChainPrice } from '../products/units';
import type { SviParameters } from '../products/types';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function finiteNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function signedFixed(value: unknown): number | null {
  if (typeof value === 'number' || typeof value === 'string') {
    return finiteNumber(value);
  }
  if (!isRecord(value)) return null;
  const magnitude = finiteNumber(value.magnitude);
  if (magnitude === null) return null;
  const negative = Boolean(value.is_negative ?? value.negative);
  return negative ? -magnitude : magnitude;
}

export interface PropbookSpotRead {
  spot: number;
  sourceTimestampMs: number;
  updateTimestampMs: number;
}

export interface PropbookForwardRead {
  forward: number;
  expiryMs: number;
  sourceTimestampMs: number;
  updateTimestampMs: number;
}

export interface PropbookSviRead {
  svi: SviParameters;
  expiryMs: number;
  sourceTimestampMs: number;
  updateTimestampMs: number;
}

/** Propbook `/oracles/:id/pyth/latest` observation. */
export function parsePythSpotObservation(payload: unknown): PropbookSpotRead | null {
  if (!isRecord(payload)) return null;
  const spotRaw = finiteNumber(payload.normalized_spot);
  const sourceTimestampMs = finiteNumber(payload.source_timestamp_ms ?? payload.update_timestamp_ms);
  const updateTimestampMs = finiteNumber(payload.update_timestamp_ms ?? payload.source_timestamp_ms);
  if (spotRaw === null || sourceTimestampMs === null || updateTimestampMs === null) return null;
  const spot = fromChainPrice(spotRaw);
  if (!(spot > 0)) return null;
  return { spot, sourceTimestampMs, updateTimestampMs };
}

/** On-chain / GraphQL `BlockScholesSpotFeed` JSON (lane.latest). */
export function parseBlockScholesSpotObservation(payload: unknown): PropbookSpotRead | null {
  if (!isRecord(payload)) return null;
  const lane = isRecord(payload.lane) ? payload.lane : payload;
  const latest = isRecord(lane.latest) ? lane.latest : null;
  if (!latest) return null;
  const value = isRecord(latest.value) ? latest.value : latest;
  const spotRaw = finiteNumber(value.spot ?? value.normalized_spot);
  const sourceTimestampMs = finiteNumber(latest.source_timestamp_ms);
  const updateTimestampMs = finiteNumber(latest.update_timestamp_ms ?? latest.source_timestamp_ms);
  if (spotRaw === null || sourceTimestampMs === null || updateTimestampMs === null) return null;
  const spot = fromChainPrice(spotRaw);
  if (!(spot > 0)) return null;
  return { spot, sourceTimestampMs, updateTimestampMs };
}

/** Dynamic-field `OracleLane<RawForward>` JSON (`latest`). */
export function parseBlockScholesForwardObservation(payload: unknown): PropbookForwardRead | null {
  if (!isRecord(payload)) return null;
  const latest = isRecord(payload.latest) ? payload.latest : isRecord(payload.value) ? payload : null;
  if (!latest) return null;
  const value = isRecord(latest.value) ? latest.value : latest;
  const forwardRaw = finiteNumber(value.forward ?? value.normalized_forward);
  const expiryMs = finiteNumber(value.expiry_ms ?? payload.expiry_ms);
  const sourceTimestampMs = finiteNumber(latest.source_timestamp_ms);
  const updateTimestampMs = finiteNumber(latest.update_timestamp_ms ?? latest.source_timestamp_ms);
  if (forwardRaw === null || expiryMs === null || sourceTimestampMs === null || updateTimestampMs === null) {
    return null;
  }
  const forward = fromChainPrice(forwardRaw);
  if (!(forward > 0)) return null;
  return { forward, expiryMs, sourceTimestampMs, updateTimestampMs };
}

/** Dynamic-field `OracleLane<RawSVI>` JSON (`latest`). */
export function parseBlockScholesSviObservation(payload: unknown): PropbookSviRead | null {
  if (!isRecord(payload)) return null;
  const latest = isRecord(payload.latest) ? payload.latest : isRecord(payload.value) ? payload : null;
  if (!latest) return null;
  const value = isRecord(latest.value) ? latest.value : latest;
  const sviRaw = isRecord(value.svi) ? value.svi : value;
  const a = finiteNumber(sviRaw.a);
  const b = finiteNumber(sviRaw.b);
  const sigma = finiteNumber(sviRaw.sigma);
  const rhoMag = signedFixed(sviRaw.rho);
  const mMag = signedFixed(sviRaw.m);
  const expiryMs = finiteNumber(value.expiry_ms ?? payload.expiry_ms);
  const sourceTimestampMs = finiteNumber(latest.source_timestamp_ms);
  const updateTimestampMs = finiteNumber(latest.update_timestamp_ms ?? latest.source_timestamp_ms);
  if (
    a === null ||
    b === null ||
    sigma === null ||
    rhoMag === null ||
    mMag === null ||
    expiryMs === null ||
    sourceTimestampMs === null ||
    updateTimestampMs === null
  ) {
    return null;
  }
  return {
    expiryMs,
    sourceTimestampMs,
    updateTimestampMs,
    svi: {
      a: fromChainPrice(a),
      b: fromChainPrice(b),
      rho: fromChainPrice(rhoMag),
      m: fromChainPrice(mMag),
      sigma: fromChainPrice(sigma),
    },
  };
}

/**
 * Predict live-forward rule (pricing-and-oracles.md):
 * pyth fresh → pyth_spot × (bs.forward / bs.spot); else bs.forward.
 */
export function resolveLiveForward(input: {
  pythSpot: number;
  pythFresh: boolean;
  bsSpot: number;
  bsForward: number;
}): number {
  if (input.pythFresh && input.pythSpot > 0 && input.bsSpot > 0 && input.bsForward > 0) {
    return input.pythSpot * (input.bsForward / input.bsSpot);
  }
  return input.bsForward;
}

export function isOracleTimestampFresh(input: {
  sourceTimestampMs: number;
  nowMs: number;
  freshnessMs: number;
}): boolean {
  if (!(input.sourceTimestampMs > 0) || input.sourceTimestampMs > input.nowMs) return false;
  return input.nowMs - input.sourceTimestampMs <= input.freshnessMs;
}
