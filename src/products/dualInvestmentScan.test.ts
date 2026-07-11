import { describe, expect, it } from 'vitest';
import { lastKnownMarketSnapshot } from '../deepbook/fixtures';
import { oracleMarketFromFixture } from '../test/oracleMarketFixture';
import {
  buildDualInvestmentScanInputs,
  filterMeaningfulScanRows,
  isSubDayTenor,
  scanQuoteDisplayMetrics,
  TURBO_DISPLAY_TARGET_STEP,
  TURBO_MIN_PERIOD_RETURN_BPS,
} from './dualInvestmentScan';

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

  it('uses $50 Turbo display steps when admission tick is present (not $1 admission grid)', () => {
    const rows = buildDualInvestmentScanInputs({
      market: {
        ...lastKnownMarketSnapshot,
        spot: 64_050.4,
        minStrike: 1,
        tickSize: 0.01,
        admissionTickSize: 1,
      },
      principal: 100,
      targetRows: 3,
    });

    expect(TURBO_DISPLAY_TARGET_STEP).toBe(50);
    expect(rows.map((row) => row.targetPrice)).toEqual([64_050, 64_000, 63_950]);
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
  const multiDayOracle = { ...lastKnownMarketSnapshot, expiryMs: Date.now() + 3 * 86_400_000 };
  const turboOracle = { ...lastKnownMarketSnapshot, expiryMs: Date.now() + 2 * 3_600_000 };

  it('zeros coupon and hides protocol economics when a scan quote is missing', () => {
    expect(scanQuoteDisplayMetrics({ quote: null })).toEqual({
      coupon: 0,
      apr: null,
      referenceApr: null,
      periodReturn: null,
      periodReturnBps: null,
      totalLegCost: null,
      showApr: false,
    });
  });

  it('zeros APR when the indicative coupon is not positive', () => {
    expect(
      scanQuoteDisplayMetrics({
        quote: {
          coupon: -0.01,
          apr: -0.5937,
          totalLegCost: 0.38,
          principal: 100,
          oracle: multiDayOracle,
        },
      }),
    ).toEqual({
      coupon: 0,
      apr: null,
      referenceApr: null,
      periodReturn: null,
      periodReturnBps: null,
      totalLegCost: null,
      showApr: false,
    });
  });

  it('shows net APR after the protocol coupon fee for multi-day quotes', () => {
    expect(
      scanQuoteDisplayMetrics({
        quote: {
          coupon: 0.04,
          apr: 1.8861,
          totalLegCost: 0.34,
          principal: 1,
          oracle: multiDayOracle,
        },
      }),
    ).toEqual({
      coupon: 0.04,
      apr: 1.69749,
      referenceApr: 1.69749,
      periodReturn: 0.04,
      periodReturnBps: 400,
      totalLegCost: 0.34,
      showApr: true,
    });
  });

  it('keeps period return primary and exposes reference APR for Turbo sub-day tenors (ADR-0002)', () => {
    expect(isSubDayTenor(turboOracle.expiryMs)).toBe(true);
    expect(
      scanQuoteDisplayMetrics({
        quote: {
          coupon: 0.04,
          apr: 175.2,
          totalLegCost: 0.34,
          principal: 1,
          oracle: turboOracle,
        },
      }),
    ).toEqual({
      coupon: 0.04,
      apr: null,
      referenceApr: 157.68,
      periodReturn: 0.04,
      periodReturnBps: 400,
      totalLegCost: 0.34,
      showApr: false,
    });
  });
});

describe('filterMeaningfulScanRows', () => {
  const turboOracle = { ...lastKnownMarketSnapshot, expiryMs: Date.now() + 2 * 3_600_000 };
  const multiDayOracle = { ...lastKnownMarketSnapshot, expiryMs: Date.now() + 3 * 86_400_000 };

  it('drops Turbo rows below the minimum period-return bps threshold', () => {
    const rows = filterMeaningfulScanRows([
      {
        input: { principal: 1, targetPrice: 64_000, floorPrice: 60_000, targetLegCount: 6 },
        quote: {
          coupon: 0.00005,
          apr: 0.2,
          totalLegCost: 0.1,
          principal: 1,
          oracle: turboOracle,
        } as never,
      },
      {
        input: { principal: 1, targetPrice: 63_500, floorPrice: 59_500, targetLegCount: 6 },
        quote: {
          coupon: 0.0002,
          apr: 0.8,
          totalLegCost: 0.1,
          principal: 1,
          oracle: turboOracle,
        } as never,
      },
    ]);

    expect(TURBO_MIN_PERIOD_RETURN_BPS).toBe(1);
    // 0.5 bps dropped; 2 bps kept
    expect(rows.map((row) => row.input.targetPrice)).toEqual([63_500]);
  });

  it('keeps multi-day rows regardless of thin period return', () => {
    const rows = filterMeaningfulScanRows([
      {
        input: { principal: 1, targetPrice: 64_000, floorPrice: 60_000, targetLegCount: 6 },
        quote: {
          coupon: 0.0005,
          apr: 0.2,
          totalLegCost: 0.1,
          principal: 1,
          oracle: multiDayOracle,
        } as never,
      },
    ]);

    expect(rows).toHaveLength(1);
  });
});
