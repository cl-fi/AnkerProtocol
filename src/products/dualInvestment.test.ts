import { describe, expect, it } from 'vitest';
import { buildDualInvestmentLegIntents, compileDualInvestment } from './dualInvestment';
import { lastKnownMarketSnapshot } from '../deepbook/fixtures';

describe('compileDualInvestment', () => {
  it('builds an UP ladder and computes positive coupon from quoted legs', () => {
    const quote = compileDualInvestment({
      input: {
        principal: 1_000,
        targetPrice: 73_000,
        floorPrice: 58_000,
        stepSize: 2_000,
      },
      oracle: lastKnownMarketSnapshot,
      quotedLegs: [
        { id: 'up-58000', askCost: 3, askPrice: 0.21, redeemPreview: 0, executable: true, quoteTimestampMs: 1 },
        { id: 'up-60000', askCost: 3, askPrice: 0.2, redeemPreview: 0, executable: true, quoteTimestampMs: 1 },
        { id: 'up-62000', askCost: 3, askPrice: 0.19, redeemPreview: 0, executable: true, quoteTimestampMs: 1 },
        { id: 'up-64000', askCost: 3, askPrice: 0.18, redeemPreview: 0, executable: true, quoteTimestampMs: 1 },
        { id: 'up-66000', askCost: 3, askPrice: 0.17, redeemPreview: 0, executable: true, quoteTimestampMs: 1 },
        { id: 'up-68000', askCost: 3, askPrice: 0.16, redeemPreview: 0, executable: true, quoteTimestampMs: 1 },
        { id: 'up-70000', askCost: 3, askPrice: 0.15, redeemPreview: 0, executable: true, quoteTimestampMs: 1 },
        { id: 'up-72000', askCost: 3, askPrice: 0.14, redeemPreview: 0, executable: true, quoteTimestampMs: 1 },
      ],
    });

    expect(quote.legs).toHaveLength(8);
    expect(quote.reserve).toBeCloseTo(794.5205479452);
    expect(quote.totalLegCost).toBe(24);
    expect(quote.coupon).toBeCloseTo(181.4794520548);
    expect(quote.executable).toBe(true);
  });

  it('builds the requested number of legs and sizes the final interval to the target', () => {
    const legs = buildDualInvestmentLegIntents(
      {
        principal: 1_000,
        targetPrice: 73_000,
        floorPrice: 58_000,
        targetLegCount: 6,
      },
      lastKnownMarketSnapshot,
    );

    expect(legs.map((leg) => leg.strike)).toEqual([58_000, 60_500, 63_000, 65_500, 68_000, 70_500]);
    expect(legs).toHaveLength(6);
    expect(legs.reduce((sum, leg) => sum + leg.quantity, 0)).toBeCloseTo(
      (1_000 / 73_000) * (73_000 - 58_000),
    );
  });

  it('surfaces non-mintable leg errors as the quote warning', () => {
    const quote = compileDualInvestment({
      input: {
        principal: 1_000,
        targetPrice: 73_000,
        floorPrice: 72_000,
        targetLegCount: 1,
      },
      oracle: lastKnownMarketSnapshot,
      quotedLegs: [
        {
          id: 'up-72000',
          askCost: 1,
          askPrice: 1.001,
          redeemPreview: 0,
          executable: false,
          quoteTimestampMs: 1,
          error: 'Ask price 1.0010 is outside Predict mint bounds 0.01-0.99.',
        },
      ],
    });

    expect(quote.coupon).toBeGreaterThan(0);
    expect(quote.executable).toBe(false);
    expect(quote.warning).toContain('outside Predict mint bounds');
  });
});
