import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordSubscriptionDigest } from '../sui/subscriptionDigestStore';
import {
  ClaimActionView,
  AllocatedPositionsValue,
  IndexedTransactionDigestValue,
  OracleLastUpdateValue,
  SettlementRangeValue,
  SubscriptionDigestValue,
  claimActionViewModel,
  depositedCashText,
  managerValidationForNote,
  redeemEstimateForNote,
} from './DashboardPage';
import { ProductNoteCard } from './DashboardProductNoteCard';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import type { ProductNoteEventIndexEntry } from '../sui/productNoteEvents';
import type { DualInvestmentClaimState } from '../sui/predictManagerState';

const mocks = vi.hoisted(() => ({
  usePredictManagerState: vi.fn(),
}));

vi.mock('@mysten/dapp-kit-react', () => ({
  useCurrentAccount: () => null,
  useCurrentClient: () => ({}),
  useDAppKit: () => ({ signAndExecuteTransaction: vi.fn() }),
}));

vi.mock('../hooks/usePredictManagerState', () => ({
  usePredictManagerState: mocks.usePredictManagerState,
}));

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
    status: 'open',
    redeemedPayout: 0,
    redeemedPayoutBaseUnits: 0n,
    redeemedFee: 0,
    redeemedFeeBaseUnits: 0n,
    ...overrides,
  };
}

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function rpcResponse(result: unknown) {
  return new Response(JSON.stringify(result), {
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  mocks.usePredictManagerState.mockReturnValue({
    data: {
      managerId: `0x${'b'.repeat(64)}`,
      dusdcBalance: 4.943865,
      positions: [],
      generatedAt: 1,
    },
    isPending: false,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('redeemEstimateForNote', () => {
  it('uses reserve plus coupon when no option leg payout has been realized yet', () => {
    expect(redeemEstimateForNote(noteFixture())).toEqual({
      grossPayout: 4.943865,
      feeAmount: 0.000745,
      netPayout: 4.94312,
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
    missingLegs: [],
  };

  it('keeps claim disabled before expiry', () => {
    render(
      <ClaimActionView
        note={noteFixture({ expiryMs: 1_000 + 3 * 3_600_000 + 7 * 60_000 })}
        nowMs={1_000}
        claimState={claimState}
        isPending={false}
        onClaim={() => undefined}
      />,
    );

    expect(screen.getByText('Opens after settlement — nothing to do yet.')).toBeVisible();
    expect(screen.getByText('Settles in 0d 3h 7m')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Redeem positions' })).toBeDisabled();
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

    expect(screen.getByText('Ready to settle — redeem your positions, then claim your cash.')).toBeVisible();
    expect(screen.getByText("You'll receive ~4.94312 dUSDC")).toBeVisible();
    expect(screen.getByText('after 0.000745 dUSDC fee · cash-settled in dUSDC on testnet')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Redeem positions' })).toBeEnabled();
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

    expect(screen.getByText('Ready — claim your cash from this position.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Claim cash' })).toBeEnabled();
  });

  it('names the missing Predict leg when settlement is blocked by partial position availability', () => {
    render(
      <ClaimActionView
        note={noteFixture({ expiryMs: 1_000 })}
        nowMs={2_000}
        claimState={{
          ...claimState,
          path: 'partial-unavailable',
          availableLegCount: 1,
          missingLegCount: 1,
          missingLegs: [{ strike: 65_000, requiredQuantity: 0.012345, availableQuantity: 0 }],
        }}
        isPending={false}
        onClaim={() => undefined}
      />,
    );

    expect(
      screen.getByText('Settling — positions at 65,000 are still reconciling. Claim opens shortly.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Claim cash' })).toBeDisabled();
  });

  it('shows the real on-chain settlement amounts for an already claimed note', () => {
    render(
      <ClaimActionView
        note={noteFixture({
          expiryMs: 1_000,
          status: 'redeemed',
          redeemedPayout: 6.125,
          redeemedPayoutBaseUnits: 6_125_000n,
          redeemedFee: 0.1125,
          redeemedFeeBaseUnits: 112_500n,
        })}
        nowMs={2_000}
        claimState={{ ...claimState, path: 'already-claimed', availableLegCount: 0, missingLegCount: 0 }}
        isPending={false}
        onClaim={() => undefined}
      />,
    );

    expect(screen.getByText('Already claimed.')).toBeVisible();
    expect(screen.getByText('You received 6.0125 dUSDC')).toBeVisible();
    expect(screen.getByText('after 0.1125 dUSDC fee · cash-settled in dUSDC on testnet')).toBeVisible();
  });
});

describe('ProductNoteCard', () => {
  it('shows reward APR after the note fee bps', () => {
    const note = noteFixture();

    renderWithQuery(
      <ProductNoteCard
        note={note}
        managerValidation={{ label: 'Manager verified', tone: 'good' }}
        notes={[note]}
      />,
    );

    expect(screen.getByText('82.44% APR')).toBeVisible();
    expect(screen.queryByText('91.6% APR')).not.toBeInTheDocument();
  });
});

describe('claimActionViewModel', () => {
  const claimState: DualInvestmentClaimState = {
    path: 'redeem-and-withdraw',
    availableLegCount: 1,
    missingLegCount: 0,
    totalLegCount: 1,
    managerDusdcBalance: 9.664158,
    missingLegs: [],
  };

  it('derives action state from the product note lifecycle', () => {
    expect(
      claimActionViewModel({
        note: noteFixture({ expiryMs: 5_000 }),
        nowMs: 1_000,
        claimState,
        isPending: false,
      }),
    ).toMatchObject({
      lifecycle: 'active',
      canClaim: false,
      actionLabel: 'Redeem positions',
      status: 'Opens after settlement — nothing to do yet.',
      showMaturityCountdown: true,
    });

    expect(
      claimActionViewModel({
        note: noteFixture({ expiryMs: 1_000 }),
        nowMs: 5_000,
        claimState: { ...claimState, path: 'withdraw-only', availableLegCount: 0, missingLegCount: 1 },
        isPending: false,
      }),
    ).toMatchObject({
      lifecycle: 'claimable',
      canClaim: true,
      actionLabel: 'Claim cash',
      status: 'Ready — claim your cash from this position.',
      showMaturityCountdown: false,
    });
  });
});

describe('SubscriptionDigestValue', () => {
  it('shows a locally indexed subscription transaction digest for the note quote hash', async () => {
    recordSubscriptionDigest({
      owner: `0x${'a'.repeat(64)}`,
      quoteHash: '0xquote',
      digest: '0x1234567890abcdef',
    });

    render(<SubscriptionDigestValue owner={`0x${'a'.repeat(64)}`} quoteHash="0xquote" />);

    expect(await screen.findByText('0x123456...abcdef')).toBeVisible();
  });

  it('prefers the on-chain event-indexed subscription digest over the local cache', () => {
    recordSubscriptionDigest({
      owner: `0x${'a'.repeat(64)}`,
      quoteHash: '0xquote',
      digest: '0xlocal1234567890',
    });

    render(
      <SubscriptionDigestValue
        owner={`0x${'a'.repeat(64)}`}
        quoteHash="0xquote"
        eventDigest="0xabcdef1234567890"
      />,
    );

    expect(screen.getByText('0xabcdef...567890')).toBeVisible();
  });
});

describe('IndexedTransactionDigestValue', () => {
  it('shows an event-indexed lifecycle transaction digest', () => {
    render(<IndexedTransactionDigestValue digest="0xabcdef1234567890" />);

    expect(screen.getByText('0xabcdef...567890')).toBeVisible();
  });

  it('shows when a lifecycle transaction has not been indexed', () => {
    render(<IndexedTransactionDigestValue />);

    expect(screen.getByText('Not indexed')).toBeVisible();
  });
});

describe('AllocatedPositionsValue', () => {
  it('shows event-indexed allocated quantity and mint cost', () => {
    const entry: ProductNoteEventIndexEntry = {
      noteId: `0x${'c'.repeat(64)}`,
      transactionDigests: [],
      allocatedPositions: [
        { strikeBaseUnits: 64_667_000_000_000n, quantityBaseUnits: 63_588n, costBaseUnits: 56_135n },
        { strikeBaseUnits: 65_000_000_000_000n, quantityBaseUnits: 12_345n, costBaseUnits: 10_000n },
      ],
    };

    render(<AllocatedPositionsValue entry={entry} />);

    expect(screen.getByText('2 indexed / 0.075933 dUSDC qty / 0.066135 dUSDC cost')).toBeVisible();
  });

  it('shows when allocated position events have not been indexed', () => {
    render(<AllocatedPositionsValue />);

    expect(screen.getByText('Not indexed')).toBeVisible();
  });
});

describe('depositedCashText', () => {
  it('prefers event-indexed deposited cash from ProductSubscribed events', () => {
    const entry: ProductNoteEventIndexEntry = {
      noteId: `0x${'c'.repeat(64)}`,
      transactionDigests: [],
      allocatedPositions: [],
      principalBaseUnits: 5_250_000n,
    };

    expect(depositedCashText(noteFixture(), entry)).toBe('5.25');
  });

  it('falls back to the owned ProductNote principal before subscription events are indexed', () => {
    expect(depositedCashText(noteFixture())).toBe('5');
  });
});

describe('OracleLastUpdateValue', () => {
  it('loads and displays the last on-chain oracle update timestamp', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        expect(String(url)).toBe('/api/predict/oracles/0xoracle/state');
        return rpcResponse({
          oracle: {
            predict_id: '0xpredict',
            oracle_id: '0xoracle',
            underlying_asset: 'BTC',
            expiry: 1_781_683_200_000,
            min_strike: 50_000_000_000_000,
            tick_size: 1_000_000_000,
            status: 'active',
          },
          latest_price: {
            spot: '65000000000000',
            forward: '65100000000000',
            onchain_timestamp: Date.UTC(2026, 5, 1, 1, 2, 0),
          },
          latest_svi: {
            onchain_timestamp: Date.UTC(2026, 5, 1, 1, 1, 0),
          },
        });
      }),
    );

    renderWithQuery(<OracleLastUpdateValue oracleId="0xoracle" />);

    expect(await screen.findByText('Jun 01, 01:02 AM')).toBeVisible();
  });
});

describe('SettlementRangeValue', () => {
  it('shows the current estimated gross payout range for a Target Buy note', () => {
    render(<SettlementRangeValue note={noteFixture()} />);

    expect(screen.getByText('4.943865 - 5.007453 dUSDC')).toBeVisible();
  });

  it('formats large base-unit payout ranges without losing bigint precision', () => {
    render(
      <SettlementRangeValue
        note={noteFixture({
          principalBaseUnits: 9_007_199_254_740_993n,
          reserveBaseUnits: 9_007_199_254_740_993n,
          couponBaseUnits: 1n,
          legs: [{ strike: 64_667, quantity: 0.000001, quantityBaseUnits: 1n, cost: 0, costBaseUnits: 0n }],
        })}
      />,
    );

    expect(screen.getByText('9007199254.740994 - 9007199254.740995 dUSDC')).toBeVisible();
  });
});
