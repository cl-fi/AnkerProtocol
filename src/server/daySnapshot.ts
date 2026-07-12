import rawSnapshot from './daySnapshot.data.json';
import {
  parseBinanceDualInvestmentRows,
  type BinanceDualInvestmentProduct,
} from '../deepbook/binanceDualInvestment';
import {
  filterDayLegacyOracles,
  parseLegacyOracleObject,
  type LegacyOracleState,
} from '../deepbook/legacyOracles';

/**
 * The committed day-tenor Snapshot (CONTEXT: Snapshot — photograph model).
 * Everything renders as of `capturedAtMs`: the oracle set is filtered against
 * the capture clock, and the Binance benchmark is the one captured at the same
 * instant — never a live fetch stitched onto old prices.
 */
export interface DaySnapshot {
  capturedAtMs: number;
  oracles: LegacyOracleState[];
  binanceProducts: BinanceDualInvestmentProduct[];
}

/** Metadata surfaced to the client so snapshot rows can freeze their clock and benchmark. */
export interface DaySnapshotMeta {
  capturedAtMs: number;
  binanceProducts: BinanceDualInvestmentProduct[];
}

let cached: DaySnapshot | null = null;

export function loadDaySnapshot(): DaySnapshot {
  if (cached) return cached;
  const capturedAtMs = Number(rawSnapshot.capturedAtMs);
  if (!Number.isFinite(capturedAtMs) || capturedAtMs <= 0) {
    throw new Error('daySnapshot.data.json has no valid capturedAtMs — re-run scripts/capture-day-snapshot.mjs');
  }
  const oracles = filterDayLegacyOracles(
    (rawSnapshot.oracleObjects as unknown[]).map(parseLegacyOracleObject),
    capturedAtMs,
  );
  if (oracles.length === 0) {
    throw new Error('daySnapshot.data.json contains no usable day oracles — re-run scripts/capture-day-snapshot.mjs');
  }
  cached = {
    capturedAtMs,
    oracles,
    binanceProducts: parseBinanceDualInvestmentRows(rawSnapshot.binanceRows as unknown[]),
  };
  return cached;
}
