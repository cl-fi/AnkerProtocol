import { describe, expect, it, vi } from 'vitest';
import { lastKnownMarketSnapshot } from '../deepbook/fixtures';
import type { QuoteProvider } from '../deepbook/quoteProvider';
import { buildDualInvestmentLegIntents } from '../products/dualInvestment';
import { DEFAULT_MIN_PREDICT_ASK } from '../products/predictPricing';
import type { OracleMarket } from '../products/types';
import { buildDualInvestmentScan, buildVerifiedDualInvestmentQuote } from './useDualInvestmentScan';

function futureMarket(): OracleMarket {
  return {
    ...lastKnownMarketSnapshot,
    spot: 73_500,
    forward: 73_500,
    expiryMs: Date.now() + 14 * 24 * 60 * 60 * 1000,
    tickSize: 500,
    minStrike: 50_000,
  };
}

describe('buildDualInvestmentScan', () => {
  it('builds the scan from local indicative pricing without a live quote provider', async () => {
    const market = futureMarket();
    const principal = 1_000;

    const rows = await buildDualInvestmentScan({
      market,
      principal,
    });

    expect(rows).toHaveLength(8);
    expect(rows.every((row) => row.quote?.legs.length)).toBe(true);
    expect(rows[0]).not.toHaveProperty('status');
    expect(rows[0].quote?.legs.every((leg) => leg.askPrice >= DEFAULT_MIN_PREDICT_ASK && leg.askPrice <= 1)).toBe(true);
  });

  it('keeps local indicative asks above the 0.02 floor when fallback pricing undershoots', async () => {
    const rows = await buildDualInvestmentScan({
      market: {
        ...futureMarket(),
        forward: 20_000,
        svi: undefined,
      },
      principal: 1_000,
    });

    expect(rows[0].quote?.legs.some((leg) => leg.askPrice === DEFAULT_MIN_PREDICT_ASK)).toBe(true);
    expect(
      rows.every((row) => row.quote?.legs.every((leg) => leg.askPrice >= DEFAULT_MIN_PREDICT_ASK)),
    ).toBe(true);
  });
});

describe('buildVerifiedDualInvestmentQuote', () => {
  it('keeps live preview wired to the quote provider', async () => {
    const market = futureMarket();
    const productInput = {
      principal: 1_000,
      targetPrice: 71_000,
      floorPrice: 69_000,
      targetLegCount: 2,
    };
    const quoteLegs = vi.fn<QuoteProvider['quoteLegs']>(async (legs) =>
      legs.map((leg) => ({
        ...leg,
        askPrice: 0.05,
        askCost: leg.quantity * 0.05,
        redeemPreview: 0,
        quoteTimestampMs: 1_700_000_000_000,
        executable: true,
      })),
    );

    const quote = await buildVerifiedDualInvestmentQuote({
      oracle: market,
      productInput,
      quoteProvider: { quoteLegs },
    });

    expect(quoteLegs).toHaveBeenCalledWith(buildDualInvestmentLegIntents(productInput, market));
    expect(quote.executable).toBe(true);
  });
});
