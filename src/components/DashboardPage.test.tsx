import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClaimActionView, managerValidationForNote, redeemEstimateForNote } from './DashboardPage';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import type { DualInvestmentClaimState } from '../sui/predictManagerState';

function noteFixture(overrides: Partial<AnkerProductNoteRecord> = {}): AnkerProductNoteRecord {
  return {
    noteId: `0x${'c'.repeat(64)}`,
    productType: 'dual-investment',
    productId: 'dual-demo',
    owner: `0x${'a'.repeat(64)}`,
    managerId: `0x${'b'.repeat(64)}`,
    oracleId: `0x${'5'.repeat(64)}`,
    expiryMs: 1_000,
    principal: 5,
    reserve: 4.936412,
    coupon: 0.007453,
    targetPrice: 65_500,
    floorPrice: 64_667,
    lowerBound: 0,
    upperBound: 0,
    isBullish: false,
    usesMockCurrentDeposit: false,
    apr: 0.916,
    feeBps: 1_000,
    legs: [{ strike: 64_667, quantity: 0.063588, cost: 0.056135 }],
    status: 'open',
    redeemedPayout: 0,
    redeemedFee: 0,
    ...overrides,
  };
}

describe('redeemEstimateForNote', () => {
  it('estimates performance fee from product yield', () => {
    expect(redeemEstimateForNote(noteFixture())).toEqual({
      grossPayout: 5.007453,
      feeAmount: 0.000745,
      netPayout: 5.006708,
    });
  });
});

describe('managerValidationForNote', () => {
  it('marks a product note as verified when the Predict manager endpoint returns its manager id', () => {
    expect(
      managerValidationForNote(noteFixture(), [
        { managerId: `0x${'b'.repeat(64)}` },
      ]),
    ).toEqual({ label: 'Manager verified', tone: 'good' });
  });

  it('marks a product note as missing when the Predict manager endpoint does not return its manager id', () => {
    expect(managerValidationForNote(noteFixture(), [])).toEqual({
      label: 'Manager not found',
      tone: 'warn',
    });
  });
});

describe('RedeemActionView', () => {
  const claimState: DualInvestmentClaimState = {
    path: 'redeem-and-withdraw',
    availableLegCount: 1,
    missingLegCount: 0,
    totalLegCount: 1,
    managerDusdcBalance: 9.664158,
  };

  it('keeps claim disabled before expiry', () => {
    render(
      <ClaimActionView
        note={noteFixture({ expiryMs: 2_000 })}
        nowMs={1_000}
        claimState={claimState}
        isPending={false}
        onClaim={() => undefined}
      />,
    );

    expect(screen.getByText('Claim opens after expiry.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Claim DUSDC' })).toBeDisabled();
  });

  it('enables claim for an expired open dual investment note with live Predict legs', () => {
    render(
      <ClaimActionView
        note={noteFixture({ expiryMs: 1_000 })}
        nowMs={2_000}
        claimState={claimState}
        isPending={false}
        onClaim={() => undefined}
      />,
    );

    expect(screen.getByText('Claim will redeem open Predict legs, then withdraw DUSDC.')).toBeVisible();
    expect(screen.getByText('Claim 5.007453 dUSDC')).toBeVisible();
    expect(screen.getByText('Fee 0.000745 dUSDC')).toBeVisible();
    expect(screen.getByText('Net 5.006708 dUSDC')).toBeVisible();
    expect(screen.getByText('BTC delivery route unavailable on testnet.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Claim DUSDC' })).toBeEnabled();
  });

  it('enables withdraw-only claim when every Predict leg was already redeemed', () => {
    render(
      <ClaimActionView
        note={noteFixture({ expiryMs: 1_000 })}
        nowMs={2_000}
        claimState={{ ...claimState, path: 'withdraw-only', availableLegCount: 0, missingLegCount: 1 }}
        isPending={false}
        onClaim={() => undefined}
      />,
    );

    expect(screen.getByText('Predict legs already redeemed. Claim withdraws DUSDC from PredictManager.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Claim DUSDC' })).toBeEnabled();
  });
});
