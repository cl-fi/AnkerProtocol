import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PredictMarketState } from '../deepbook/predictMarketState';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import { ClaimActionView } from './DashboardClaimAction';

const MARKET_ID = `0x${'5'.repeat(64)}`;

function noteFixture(overrides: Partial<AnkerProductNoteRecord> = {}): AnkerProductNoteRecord {
  return {
    noteId: `0x${'c'.repeat(64)}`,
    productType: 'dual-investment',
    productId: 'dual-demo',
    owner: `0x${'a'.repeat(64)}`,
    wrapperId: `0x${'b'.repeat(64)}`,
    oracleId: MARKET_ID,
    expiryMs: 1_000,
    principal: 5,
    principalBaseUnits: 5_000_000n,
    reserve: 4.936412,
    reserveBaseUnits: 4_936_412n,
    coupon: 0.007453,
    couponBaseUnits: 7_453n,
    targetPrice: 65_500,
    floorPrice: 64_667,
    lowerBound: 0,
    upperBound: 0,
    isBullish: false,
    usesMockCurrentDeposit: false,
    apr: 0.916,
    feeBps: 1_000,
    legs: [{ strike: 64_667, quantity: 0.063588, quantityBaseUnits: 63_588n, cost: 0.056135, costBaseUnits: 56_135n }],
    orderIds: [11n],
    status: 'open',
    redeemedPayout: 0,
    redeemedPayoutBaseUnits: 0n,
    redeemedFee: 0,
    redeemedFeeBaseUnits: 0n,
    ...overrides,
  };
}

function marketState(settlementPrice: number | null): PredictMarketState {
  return {
    expiryMarketId: MARKET_ID,
    expiryMs: 1_000,
    settlementPrice,
    settlementPriceBaseUnits: settlementPrice === null ? null : BigInt(Math.round(settlementPrice * 1_000_000_000)),
    settledAtMs: settlementPrice === null ? null : 1_001,
  };
}

describe('ClaimActionView settlement lifecycle', () => {
  it('keeps an expired market disabled while its settlement event is unavailable', () => {
    render(
      <ClaimActionView
        note={noteFixture()}
        nowMs={1_001}
        marketState={marketState(null)}
        isPending={false}
        onClaim={() => undefined}
      />,
    );

    expect(screen.getByText('Awaiting settlement — claim opens as soon as the market fixes its final price.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Claim payout' })).toBeDisabled();
  });

  it('shows the exact settled payout and fee before enabling one-click claim', () => {
    render(
      <ClaimActionView
        note={noteFixture()}
        nowMs={1_001}
        marketState={marketState(65_000)}
        isPending={false}
        onClaim={() => undefined}
      />,
    );

    expect(screen.getByText("You'll receive")).toBeVisible();
    expect(screen.getByText('5.006708 dUSDC')).toBeVisible();
    expect(screen.getByText('after 0.000745 dUSDC fee')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Claim payout' })).toBeEnabled();
  });

  it('renders the recorded payout and fee after the Note is claimed', () => {
    render(
      <ClaimActionView
        note={noteFixture({
          status: 'redeemed',
          redeemedPayout: 6.125,
          redeemedPayoutBaseUnits: 6_125_000n,
          redeemedFee: 0.1125,
          redeemedFeeBaseUnits: 112_500n,
        })}
        nowMs={1_001}
        marketState={marketState(65_000)}
        isPending={false}
        onClaim={() => undefined}
      />,
    );

    expect(screen.getByText('You received')).toBeVisible();
    expect(screen.getByText('6.0125 dUSDC')).toBeVisible();
    expect(screen.getByText('after 0.1125 dUSDC fee')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Claim payout' })).toBeDisabled();
  });
});
