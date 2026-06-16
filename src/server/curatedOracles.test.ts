import { describe, expect, it } from 'vitest';
import type { PredictOracleListItem } from '../deepbook/predictServer';
import { curateBtcOracles, type OracleReadiness } from './curatedOracles';

function oracle(input: Partial<PredictOracleListItem> & { oracle_id: string; expiry: number }): PredictOracleListItem {
  return {
    predict_id: 'predict',
    oracle_id: input.oracle_id,
    underlying_asset: input.underlying_asset ?? 'BTC',
    expiry: input.expiry,
    min_strike: input.min_strike ?? 50_000_000_000_000,
    tick_size: input.tick_size ?? 1_000_000_000,
    status: input.status ?? 'active',
  };
}

describe('curateBtcOracles', () => {
  it('keeps quote-ready short product expiries and filters unavailable markets', () => {
    const now = 1_000;
    const readiness = new Map<string, OracleReadiness>([
      ['four-hour', { stateReady: true, quoteReady: false, reason: 'MoveAbort' }],
      ['eighteen-hour', { stateReady: true, quoteReady: true }],
      ['forty-two-hour', { stateReady: true, quoteReady: true }],
    ]);

    const curated = curateBtcOracles(
      [
        oracle({ oracle_id: 'four-hour', expiry: now + 4 * 60 * 60_000 }),
        oracle({ oracle_id: 'eighteen-hour', expiry: now + 18 * 60 * 60_000 }),
        oracle({ oracle_id: 'forty-two-hour', expiry: now + 42 * 60 * 60_000 }),
      ],
      readiness,
      now,
    );

    expect(curated.map((item) => item.oracle_id)).toEqual(['eighteen-hour', 'forty-two-hour']);
    expect(curated[0]).toMatchObject({
      oracle_id: 'eighteen-hour',
      productReady: true,
      quoteReady: true,
      stateReady: true,
    });
  });

  it('deduplicates markets with the same expiry and strike grid', () => {
    const now = 1_000;
    const expiry = now + 18 * 60 * 60_000;
    const readiness = new Map<string, OracleReadiness>([
      ['stale-duplicate', { stateReady: true, quoteReady: false, reason: 'no live quote' }],
      ['ready-duplicate', { stateReady: true, quoteReady: true }],
      ['next-expiry', { stateReady: true, quoteReady: true }],
    ]);

    const curated = curateBtcOracles(
      [
        oracle({ oracle_id: 'stale-duplicate', expiry }),
        oracle({ oracle_id: 'ready-duplicate', expiry }),
        oracle({ oracle_id: 'next-expiry', expiry: expiry + 24 * 60 * 60_000 }),
      ],
      readiness,
      now,
    );

    expect(curated.map((item) => item.oracle_id)).toEqual(['ready-duplicate', 'next-expiry']);
  });

  it('drops expired, non-BTC, inactive, and too-near markets', () => {
    const now = 1_000;
    const readiness = new Map<string, OracleReadiness>([
      ['ready', { stateReady: true, quoteReady: true }],
      ['too-near', { stateReady: true, quoteReady: true }],
      ['eth', { stateReady: true, quoteReady: true }],
      ['inactive', { stateReady: true, quoteReady: true }],
      ['expired', { stateReady: true, quoteReady: true }],
    ]);

    const curated = curateBtcOracles(
      [
        oracle({ oracle_id: 'ready', expiry: now + 18 * 60 * 60_000 }),
        oracle({ oracle_id: 'too-near', expiry: now + 4 * 60 * 60_000 }),
        oracle({ oracle_id: 'eth', underlying_asset: 'ETH', expiry: now + 18 * 60 * 60_000 }),
        oracle({ oracle_id: 'inactive', status: 'settled', expiry: now + 18 * 60 * 60_000 }),
        oracle({ oracle_id: 'expired', expiry: now - 1 }),
      ],
      readiness,
      now,
    );

    expect(curated.map((item) => item.oracle_id)).toEqual(['ready']);
  });
});
