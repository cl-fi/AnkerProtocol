import { describe, expect, it } from 'vitest';
import { DEEPBOOK_PREDICT } from '../config/deepbook';
import type { ExpiryMarketSummary } from '../deepbook/predictAdapter';
import {
  DAY_MS,
  filterMarketsForProductLine,
  isProductLineTradingEnabled,
  resolveProductLineDataSource,
} from './productLineMarkets';

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

describe('filterMarketsForProductLine', () => {
  const nowMs = 1_700_000_000_000;

  it('keeps Turbo on the hourly cadence fingerprint and sub-day expiry distance', () => {
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

    expect(filterMarketsForProductLine(markets, 'turbo', { nowMs }).map((row) => row.expiryMarketId)).toEqual([
      '0x1h',
    ]);
  });

  it('keeps multi-day markets by expiry distance (>= 1 day)', () => {
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

    expect(filterMarketsForProductLine(markets, 'multi-day', { nowMs }).map((row) => row.expiryMarketId)).toEqual([
      '0x1d',
      '0x7d',
    ]);
  });
});

describe('isProductLineTradingEnabled', () => {
  it('disables trading for fixture degradation and demo mode', () => {
    expect(isProductLineTradingEnabled({ dataSourceKind: 'live', demoMode: false })).toBe(true);
    expect(isProductLineTradingEnabled({ dataSourceKind: 'fixture', demoMode: false })).toBe(false);
    expect(isProductLineTradingEnabled({ dataSourceKind: 'live', demoMode: true })).toBe(false);
  });
});

describe('resolveProductLineDataSource', () => {
  const nowMs = 1_700_000_000_000;
  const fixtures = [market({ id: '0xfixture-7d', expiryMs: nowMs + 7 * DAY_MS })];

  it('uses live multi-day markets when day-scale discovery is non-empty', () => {
    const discovered = [market({ id: '0xlive-3d', expiryMs: nowMs + 3 * DAY_MS })];

    expect(
      resolveProductLineDataSource({
        line: 'multi-day',
        discovered,
        fixtures,
        nowMs,
      }),
    ).toEqual({
      kind: 'live',
      markets: discovered,
    });
  });

  it('falls back to labeled fixtures when no day-scale markets exist', () => {
    const discovered = [market({ id: '0x1h', expiryMs: nowMs + 3_600_000 })];

    expect(
      resolveProductLineDataSource({
        line: 'multi-day',
        discovered,
        fixtures,
        nowMs,
      }),
    ).toEqual({
      kind: 'fixture',
      reason: 'no-day-scale-markets',
      markets: fixtures,
    });
  });

  it('switches from fixture to live when day-scale markets appear (no code change)', () => {
    const empty = resolveProductLineDataSource({
      line: 'multi-day',
      discovered: [],
      fixtures,
      nowMs,
    });
    expect(empty.kind).toBe('fixture');

    const recovered = resolveProductLineDataSource({
      line: 'multi-day',
      discovered: [market({ id: '0xrecovered', expiryMs: nowMs + 2 * DAY_MS })],
      fixtures,
      nowMs,
    });
    expect(recovered).toEqual({
      kind: 'live',
      markets: [market({ id: '0xrecovered', expiryMs: nowMs + 2 * DAY_MS })],
    });
  });
});
