import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuoteRiskSummary } from './DualInvestmentPage';
import type { StructuredProductQuote } from '../products/types';

function quoteFixture(): StructuredProductQuote {
  return {
    id: 'dual-demo',
    productType: 'dual-investment',
    title: 'Target Buy BTC at 66,000',
    principal: 5,
    oracle: {
      predictId: '0x1',
      oracleId: '0x2',
      underlyingAsset: 'BTC',
      expiryMs: 1_781_683_200_000,
      minStrike: 50_000,
      tickSize: 1,
      status: 'active',
      spot: 66_172,
      forward: 66_167,
      spotTimestampMs: 1,
      sviTimestampMs: 1,
      serverLagSeconds: 1,
    },
    legs: [
      {
        id: 'up-64667',
        instrumentType: 'binary-up',
        oracleId: '0x2',
        expiryMs: 1,
        strike: 64_667,
        isUp: true,
        quantity: 0.063588,
        description: 'UP 64,667',
        askPrice: 0.88,
        askCost: 0.056135,
        redeemPreview: 0,
        quoteTimestampMs: 1,
        executable: true,
      },
    ],
    totalLegCost: 0.056135,
    reserve: 4.936412,
    coupon: 0.007453,
    apr: 0.916,
    executable: true,
    scenarios: [],
  };
}

describe('QuoteRiskSummary', () => {
  it('renders quote validity, max-cost slippage, and liquidity risk next to payout risk', () => {
    render(<QuoteRiskSummary quote={quoteFixture()} />);

    expect(screen.getByText('Minimum Payout')).toBeVisible();
    expect(screen.getByText('Quote Validity')).toBeVisible();
    expect(screen.getByText('30s')).toBeVisible();
    expect(screen.getByText('Slippage Limit')).toBeVisible();
    expect(screen.getByText('1% max cost')).toBeVisible();
    expect(screen.getByText('Liquidity')).toBeVisible();
    expect(screen.getByText('Verified')).toBeVisible();
  });
});
