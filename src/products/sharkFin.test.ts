import { describe, expect, it } from 'vitest';
import { compileSharkFin } from './sharkFin';
import { lastKnownMarketSnapshot } from '../deepbook/fixtures';

describe('compileSharkFin', () => {
  it('uses yield budget to fund quoted range legs', () => {
    const quote = compileSharkFin({
      input: {
        principal: 1_000,
        lowerBound: 74_000,
        upperBound: 86_000,
        stepSize: 2_000,
        baseApr: 0.5,
      },
      oracle: { ...lastKnownMarketSnapshot, expiryMs: Date.now() + 7 * 86_400_000 },
      quotedLegs: [
        { id: 'range-74000-86000', askCost: 5, askPrice: 0.2, redeemPreview: 0, executable: true, quoteTimestampMs: 1 },
      ],
      nowMs: Date.now(),
    });

    expect(quote.productType).toBe('shark-fin');
    expect(quote.reserve).toBe(1_000);
    expect(quote.totalLegCost).toBe(5);
    expect(quote.coupon).toBeGreaterThan(0);
    expect(quote.executable).toBe(true);
  });
});
