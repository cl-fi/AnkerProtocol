import { describe, expect, it } from 'vitest';
import { lastKnownMarketSnapshot } from '../deepbook/fixtures';
import { buildDualInvestmentScanInputs, classifyScanQuote } from './dualInvestmentScan';

describe('buildDualInvestmentScanInputs', () => {
  it('builds descending 500-dollar target-buy rows from spot with six legs by default', () => {
    const rows = buildDualInvestmentScanInputs({
      market: { ...lastKnownMarketSnapshot, spot: 71_560, minStrike: 50_000, tickSize: 1 },
      principal: 1_000,
    });

    expect(rows.map((row) => row.targetPrice)).toEqual([
      71_500, 71_000, 70_500, 70_000, 69_500, 69_000, 68_500, 68_000,
    ]);
    expect(rows.every((row) => row.targetLegCount === 6)).toBe(true);
    expect(rows[0].floorPrice).toBe(66_500);
  });

  it('only builds target-buy rows that are strictly below spot', () => {
    const rows = buildDualInvestmentScanInputs({
      market: { ...lastKnownMarketSnapshot, spot: 67_801, minStrike: 50_000, tickSize: 1 },
      principal: 1_000,
    });

    expect(rows.map((row) => row.targetPrice)).toEqual([
      67_500, 67_000, 66_500, 66_000, 65_500, 65_000, 64_500, 64_000,
    ]);
    expect(rows.every((row) => row.targetPrice < 67_801)).toBe(true);
  });

  it('skips the spot grid level when spot is exactly on the target grid', () => {
    const rows = buildDualInvestmentScanInputs({
      market: { ...lastKnownMarketSnapshot, spot: 67_500, minStrike: 50_000, tickSize: 1 },
      principal: 1_000,
    });

    expect(rows[0].targetPrice).toBe(67_000);
    expect(rows.every((row) => row.targetPrice < 67_500)).toBe(true);
  });
});

describe('classifyScanQuote', () => {
  it('does not mark a fully quoted row live when the coupon is not positive', () => {
    expect(classifyScanQuote({ executable: false, coupon: 0 })).toBe('no-coupon');
    expect(classifyScanQuote({ executable: true, coupon: 1 })).toBe('live');
  });
});
