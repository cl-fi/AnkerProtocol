import { describe, expect, it } from 'vitest';
import { lastKnownMarketSnapshot } from '../deepbook/fixtures';
import { oracleMarketFromFixture } from '../test/oracleMarketFixture';
import { buildDualInvestmentScanInputs, scanQuoteDisplayMetrics } from './dualInvestmentScan';

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

  it('uses oracle SVI to avoid a too-deep default floor when pricing parameters are available', () => {
    const market = oracleMarketFromFixture();
    const [row] = buildDualInvestmentScanInputs({
      market,
      principal: 1_000,
      targetRows: 1,
    });

    expect(row.targetPrice).toBe(73_000);
    expect(row.floorPrice).toBeGreaterThan(68_000);
    expect(row.floorPrice).toBeLessThan(row.targetPrice);
  });
});

describe('scanQuoteDisplayMetrics', () => {
  it('zeros coupon and hides protocol economics when a scan quote is missing', () => {
    expect(
      scanQuoteDisplayMetrics({
        quote: null,
      }),
    ).toEqual({
      coupon: 0,
      apr: null,
      totalLegCost: null,
    });
  });

  it('zeros APR when the indicative coupon is not positive', () => {
    expect(
      scanQuoteDisplayMetrics({
        quote: {
          coupon: -0.01,
          apr: -0.5937,
          totalLegCost: 0.38,
        },
      }),
    ).toEqual({
      coupon: 0,
      apr: null,
      totalLegCost: null,
    });
  });

  it('shows net APR after the protocol coupon fee for positive indicative quotes', () => {
    expect(
      scanQuoteDisplayMetrics({
        quote: {
          coupon: 0.04,
          apr: 1.8861,
          totalLegCost: 0.34,
        },
      }),
    ).toEqual({
      coupon: 0.04,
      apr: 1.69749,
      totalLegCost: 0.34,
    });
  });
});
