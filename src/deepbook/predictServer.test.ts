import { describe, expect, it } from 'vitest';
import statusFixture from '../test/fixtures/status.json';
import oracleFixture from '../test/fixtures/oracleState.json';
import {
  filterProductExpiryOracles,
  parseOracleState,
  parseStatus,
  selectNearestTradableOracle,
} from './predictServer';

describe('predictServer parsers', () => {
  it('parses server status freshness', () => {
    expect(parseStatus(statusFixture).maxCheckpointLag).toBe(5);
    expect(parseStatus(statusFixture).maxTimeLagSeconds).toBe(1);
  });

  it('parses oracle state into normalized market data', () => {
    const parsed = parseOracleState(oracleFixture, { serverLagSeconds: 1 });
    expect(parsed.oracleId).toBe('0xb46fdd7aee8b5b729358a254a74ec4eb59c2a07ca8878cc77df09b843bae6c38');
    expect(parsed.underlyingAsset).toBe('BTC');
    expect(parsed.spot).toBeCloseTo(73264.292161574);
    expect(parsed.forward).toBeCloseTo(73264.782323624);
    expect(parsed.minStrike).toBe(50000);
    expect(parsed.tickSize).toBe(1);
    expect(parsed.status).toBe('active');
  });

  it('skips active oracles that are too close to expiry', () => {
    const now = 1_000;
    const selected = selectNearestTradableOracle(
      [
        {
          predict_id: 'p',
          oracle_id: 'near',
          underlying_asset: 'BTC',
          expiry: now + 60_000,
          min_strike: 0,
          tick_size: 1,
          status: 'active',
        },
        {
          predict_id: 'p',
          oracle_id: 'tradable',
          underlying_asset: 'BTC',
          expiry: now + 10 * 60_000,
          min_strike: 0,
          tick_size: 1,
          status: 'active',
        },
      ],
      now,
    );

    expect(selected?.oracle_id).toBe('tradable');
  });

  it('can prefer day-level product expiries over short rolling markets', () => {
    const now = 1_000;
    const selected = selectNearestTradableOracle(
      [
        {
          predict_id: 'p',
          oracle_id: 'hourly',
          underlying_asset: 'BTC',
          expiry: now + 4 * 60 * 60_000,
          min_strike: 0,
          tick_size: 1,
          status: 'active',
        },
        {
          predict_id: 'p',
          oracle_id: 'ten-day',
          underlying_asset: 'BTC',
          expiry: now + 10 * 86_400_000,
          min_strike: 0,
          tick_size: 1,
          status: 'active',
        },
      ],
      now,
      7 * 86_400_000,
    );

    expect(selected?.oracle_id).toBe('ten-day');
  });

  it('filters selector options to day-level product expiries', () => {
    const now = 1_000;
    const options = filterProductExpiryOracles(
      [
        {
          predict_id: 'p',
          oracle_id: 'hourly',
          underlying_asset: 'BTC',
          expiry: now + 4 * 60 * 60_000,
          min_strike: 0,
          tick_size: 1,
          status: 'active',
        },
        {
          predict_id: 'p',
          oracle_id: 'three-day',
          underlying_asset: 'BTC',
          expiry: now + 3 * 86_400_000,
          min_strike: 0,
          tick_size: 1,
          status: 'active',
        },
        {
          predict_id: 'p',
          oracle_id: 'ten-day',
          underlying_asset: 'BTC',
          expiry: now + 10 * 86_400_000,
          min_strike: 0,
          tick_size: 1,
          status: 'active',
        },
      ],
      now,
    );

    expect(options.map((oracle) => oracle.oracle_id)).toEqual(['three-day', 'ten-day']);
  });
});
