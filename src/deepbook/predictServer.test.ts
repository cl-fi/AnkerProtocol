import { describe, expect, it } from 'vitest';
import statusFixture from '../test/fixtures/status.json';
import {
  filterProductExpiryOracles,
  parsePredictPricingState,
  parseStatus,
  selectNearestTradableOracle,
  type PredictOracleListItem,
} from './predictServer';

function listItem(
  input: Partial<PredictOracleListItem> & { oracle_id: string; expiry: number },
): PredictOracleListItem {
  return {
    predict_id: 'pool-vault',
    oracle_id: input.oracle_id,
    underlying_asset: 'BTC',
    expiry: input.expiry,
    min_strike: 1,
    tick_size: 0.01,
    admission_tick_size: 1,
    status: 'active',
    cadence: '1h',
    productLine: 'turbo',
  };
}

describe('predictServer parsers', () => {
  it('parses server status freshness', () => {
    expect(parseStatus(statusFixture).maxCheckpointLag).toBe(5);
    expect(parseStatus(statusFixture).maxTimeLagSeconds).toBe(1);
  });

  it('parses Predict vault utilization pricing state', () => {
    expect(
      parsePredictPricingState({
        vault_balance: '1000000000',
        total_mtm: '250000000',
        utilization: '0.25',
      }),
    ).toEqual({
      baseSpread: 0.02,
      minSpread: 0.005,
      baseFee: 0.02,
      minFee: 0.005,
      utilizationMultiplier: 2,
      minAskPrice: 0.01,
      maxAskPrice: 0.99,
      vaultBalance: 1000,
      vaultTotalMtm: 250,
      vaultUtilization: 0.25,
      ewmaPenaltyRate: 0,
      expiryFeeWindowMs: undefined,
      expiryFeeMaxMultiplier: undefined,
    });
  });

  it('skips active markets that are too close to expiry', () => {
    const now = 1_000;
    const selected = selectNearestTradableOracle(
      [
        listItem({ oracle_id: 'near', expiry: now + 60_000 }),
        listItem({ oracle_id: 'tradable', expiry: now + 10 * 60_000 }),
      ],
      now,
    );

    expect(selected?.oracle_id).toBe('tradable');
  });

  it('filters selector options by remaining time to expiry', () => {
    const now = 1_000;
    const options = filterProductExpiryOracles(
      [
        listItem({ oracle_id: 'one-hour', expiry: now + 1 * 60 * 60_000 }),
        listItem({ oracle_id: 'two-hour', expiry: now + 2 * 60 * 60_000 }),
        listItem({ oracle_id: 'three-hour', expiry: now + 3 * 60 * 60_000 }),
      ],
      now,
      90 * 60_000,
    );

    expect(options.map((oracle) => oracle.oracle_id)).toEqual(['two-hour', 'three-hour']);
  });
});
