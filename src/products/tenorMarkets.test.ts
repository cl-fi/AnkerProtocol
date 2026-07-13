import { describe, expect, it } from 'vitest';
import { DEEPBOOK_PREDICT } from '../config/deepbook';
import type { ExpiryMarketSummary } from '../deepbook/predictAdapter';
import { DAY_MS, filterMarketsForTenorGroup, isTenorTradingEnabled } from './tenorMarkets';

const HOUR_ALLOC = DEEPBOOK_PREDICT.turboCadence.maxExpiryAllocation;
const HOUR_CASH = DEEPBOOK_PREDICT.turboCadence.initialExpiryCash;
const MINUTE_ALLOC = '50000000000';
const MINUTE_CASH = '10000000000';

function market(input: {
  id: string;
  expiryMs: number;
  maxExpiryAllocation?: string;
  initialExpiryCash?: string;
}): ExpiryMarketSummary {
  return {
    expiryMarketId: input.id,
    expiryMs: input.expiryMs,
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

  it('keeps hourly rows on the 1h cadence fingerprint and sub-day expiry distance (ADR-0002)', () => {
    const markets = [
      market({
        id: '0x1m',
        expiryMs: nowMs + 60_000,
        maxExpiryAllocation: MINUTE_ALLOC,
        initialExpiryCash: MINUTE_CASH,
      }),
      market({ id: '0x1h', expiryMs: nowMs + 3_600_000 }),
      market({
        id: '0x3d-same-fingerprint',
        expiryMs: nowMs + 3 * DAY_MS,
      }),
      market({
        id: '0x3d',
        expiryMs: nowMs + 3 * DAY_MS,
        maxExpiryAllocation: '999000000000',
        initialExpiryCash: '999000000000',
      }),
    ];

    expect(filterMarketsForTenorGroup(markets, 'hourly', { nowMs }).map((row) => row.expiryMarketId)).toEqual([
      '0x1h',
    ]);
  });

  it('keeps day rows by expiry distance (>= 1 day)', () => {
    const markets = [
      market({ id: '0x1h', expiryMs: nowMs + 3_600_000 }),
      market({ id: '0x23h', expiryMs: nowMs + DAY_MS - 1 }),
      market({
        id: '0x1d',
        expiryMs: nowMs + DAY_MS,
        maxExpiryAllocation: '999000000000',
        initialExpiryCash: '999000000000',
      }),
      market({
        id: '0x7d',
        expiryMs: nowMs + 7 * DAY_MS,
        maxExpiryAllocation: '999000000000',
        initialExpiryCash: '999000000000',
      }),
    ];

    expect(filterMarketsForTenorGroup(markets, 'day', { nowMs }).map((row) => row.expiryMarketId)).toEqual([
      '0x1d',
      '0x7d',
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
