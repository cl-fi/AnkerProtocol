import { describe, expect, it } from 'vitest';
import { DEEPBOOK_PREDICT } from '../config/deepbook';
import type { ExpiryMarketSummary } from '../deepbook/predictAdapter';
import { DAY_MS, filterMarketsForTenorGroup, isTenorTradingEnabled } from './tenorMarkets';

const HOUR_ALLOC = DEEPBOOK_PREDICT.turboCadence.maxExpiryAllocation;
const HOUR_CASH = DEEPBOOK_PREDICT.turboCadence.initialExpiryCash;
const MINUTE_ALLOC = '50000000000';
const MINUTE_CASH = '10000000000';
const HOUR_MS = 3_600_000;

function market(input: {
  id: string;
  expiryMs: number;
  createdAtMs?: number;
  maxExpiryAllocation?: string;
  initialExpiryCash?: string;
}): ExpiryMarketSummary {
  return {
    expiryMarketId: input.id,
    expiryMs: input.expiryMs,
    ...(input.createdAtMs !== undefined ? { createdAtMs: input.createdAtMs } : {}),
    tickSize: 0.01,
    admissionTickSize: 1,
    maxExpiryAllocation: input.maxExpiryAllocation ?? HOUR_ALLOC,
    initialExpiryCash: input.initialExpiryCash ?? HOUR_CASH,
    packageId: DEEPBOOK_PREDICT.packageId,
    poolVaultId: DEEPBOOK_PREDICT.poolVaultId,
    propbookUnderlyingId: 1,
    baseFee: 0.02,
    minFee: 0.005,
    minEntryProbability: 0.01,
    maxEntryProbability: 0.99,
  };
}

describe('filterMarketsForTenorGroup', () => {
  const nowMs = 1_700_000_000_000;

  it('keeps hourly rows on the 1h cadence fingerprint with sub-day birth tenor', () => {
    const markets = [
      market({
        id: '0x1m',
        expiryMs: nowMs + 60_000,
        createdAtMs: nowMs - 60_000,
        maxExpiryAllocation: MINUTE_ALLOC,
        initialExpiryCash: MINUTE_CASH,
      }),
      market({
        id: '0x1h',
        expiryMs: nowMs + 3 * HOUR_MS,
        createdAtMs: nowMs,
      }),
      market({
        id: '0x3d-same-fingerprint',
        expiryMs: nowMs + 3 * DAY_MS,
        createdAtMs: nowMs,
      }),
      market({
        id: '0x3d',
        expiryMs: nowMs + 3 * DAY_MS,
        createdAtMs: nowMs,
        maxExpiryAllocation: '999000000000',
        initialExpiryCash: '999000000000',
      }),
    ];

    expect(filterMarketsForTenorGroup(markets, 'hourly', { nowMs }).map((row) => row.expiryMarketId)).toEqual([
      '0x1h',
    ]);
  });

  it('classifies a true hourly market born at 3.0h as hourly (ADR-0007)', () => {
    const expiryMs = nowMs + 2 * HOUR_MS;
    const markets = [
      market({
        id: '0xborn-3h',
        expiryMs,
        createdAtMs: expiryMs - 3 * HOUR_MS,
      }),
    ];

    expect(filterMarketsForTenorGroup(markets, 'hourly', { nowMs }).map((row) => row.expiryMarketId)).toEqual([
      '0xborn-3h',
    ]);
    expect(filterMarketsForTenorGroup(markets, 'day', { nowMs })).toEqual([]);
  });

  it('keeps a day-born market off the hourly shelf even with 9.5h remaining (ADR-0007 regression)', () => {
    // Live case: born 29.6h before expiry, 9.5h remaining — must stay day, never hourly.
    const remainingMs = 9.5 * HOUR_MS;
    const birthMs = 29.6 * HOUR_MS;
    const expiryMs = nowMs + remainingMs;
    const markets = [
      market({
        id: '0xdecayed-day',
        expiryMs,
        createdAtMs: expiryMs - birthMs,
      }),
      market({
        id: '0xtrue-hourly',
        expiryMs: nowMs + 3 * HOUR_MS,
        createdAtMs: nowMs,
      }),
    ];

    expect(filterMarketsForTenorGroup(markets, 'hourly', { nowMs }).map((row) => row.expiryMarketId)).toEqual([
      '0xtrue-hourly',
    ]);
    expect(filterMarketsForTenorGroup(markets, 'day', { nowMs }).map((row) => row.expiryMarketId)).toEqual([
      '0xdecayed-day',
    ]);
  });

  it('keeps day-born markets on the day shelf while unexpired, including sub-day remaining', () => {
    const markets = [
      market({
        id: '0x1h',
        expiryMs: nowMs + HOUR_MS,
        createdAtMs: nowMs,
      }),
      market({
        id: '0xdecayed-day',
        expiryMs: nowMs + DAY_MS - 1,
        createdAtMs: nowMs - 2 * DAY_MS,
      }),
      market({
        id: '0x1d',
        expiryMs: nowMs + DAY_MS,
        createdAtMs: nowMs - DAY_MS,
        maxExpiryAllocation: '999000000000',
        initialExpiryCash: '999000000000',
      }),
      market({
        id: '0x7d',
        expiryMs: nowMs + 7 * DAY_MS,
        createdAtMs: nowMs,
        maxExpiryAllocation: '999000000000',
        initialExpiryCash: '999000000000',
      }),
    ];

    expect(filterMarketsForTenorGroup(markets, 'day', { nowMs }).map((row) => row.expiryMarketId)).toEqual([
      '0xdecayed-day',
      '0x1d',
      '0x7d',
    ]);
  });

  it('falls back to remaining-tenor classification when creation timestamp is missing', () => {
    const markets = [
      market({ id: '0x9h-no-birth', expiryMs: nowMs + 9.5 * HOUR_MS }),
      market({
        id: '0x2d-no-birth',
        expiryMs: nowMs + 2 * DAY_MS,
        maxExpiryAllocation: '999000000000',
        initialExpiryCash: '999000000000',
      }),
    ];

    expect(filterMarketsForTenorGroup(markets, 'hourly', { nowMs }).map((row) => row.expiryMarketId)).toEqual([
      '0x9h-no-birth',
    ]);
    expect(filterMarketsForTenorGroup(markets, 'day', { nowMs }).map((row) => row.expiryMarketId)).toEqual([
      '0x2d-no-birth',
    ]);
  });
});

describe('isTenorTradingEnabled', () => {
  it('trades only live 6-24 rows outside demo mode', () => {
    expect(isTenorTradingEnabled({ source: 'live', demoMode: false })).toBe(true);
    expect(isTenorTradingEnabled({ source: 'snapshot', demoMode: false })).toBe(false);
    expect(isTenorTradingEnabled({ source: undefined, demoMode: false })).toBe(false);
    expect(isTenorTradingEnabled({ source: 'live', demoMode: true })).toBe(false);
  });
});
