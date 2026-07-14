import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PredictMarketState } from '../deepbook/predictMarketState';
import { productNoteType } from '../sui/ankerPortfolio';
import { DEFAULT_ANKER_CONFIG } from '../sui/ankerTransactions';
import { useAnkerPortfolio } from '../hooks/useAnkerPortfolio';
import { ClaimAction } from './PortfolioClaimAction';

const OWNER = `0x${'a'.repeat(64)}`;
const NOTE_ID = `0x${'c'.repeat(64)}`;
const MARKET_ID = `0x${'5'.repeat(64)}`;

// Mutable on-chain world the mocked client reads from.
const chain = {
  status: 'open' as 'open' | 'redeemed',
  executions: 0,
  rejectAfterBroadcast: false,
};

function noteFieldsJson() {
  const redeemed = chain.status === 'redeemed';
  return {
    owner: OWNER,
    product_kind: '0',
    product_id: 'ZHVhbC1kZW1v',
    wrapper_id: `0x${'b'.repeat(64)}`,
    oracle_id: MARKET_ID,
    expiry_ms: '1000',
    principal_amount: '5000000',
    reserve_amount: '4936412',
    coupon_amount: '7453',
    target_price: '65500000000000',
    floor_price: '64667000000000',
    lower_bound: '0',
    upper_bound: '0',
    is_bullish: false,
    uses_mock_current_deposit: false,
    apr_bps: '9160',
    fee_bps: '1000',
    strikes: ['64667000000000'],
    quantities: ['63588'],
    costs: ['56135'],
    order_ids: ['11'],
    status: redeemed ? '1' : '0',
    redeemed_payout_amount: redeemed ? '5006708' : '0',
    redeemed_fee_amount: redeemed ? '745' : '0',
  };
}

const mockClient = {
  listOwnedObjects: vi.fn(async () => ({
    objects: [
      {
        objectId: NOTE_ID,
        type: productNoteType(DEFAULT_ANKER_CONFIG.originalPackageId),
        json: noteFieldsJson(),
      },
    ],
    hasNextPage: false,
    cursor: null,
  })),
  simulateTransaction: vi.fn(async () =>
    chain.status === 'redeemed'
      ? {
          $kind: 'FailedTransaction',
          FailedTransaction: { status: { success: false, error: { message: 'MoveAbort EAlreadyRedeemed' } } },
        }
      : { $kind: 'Transaction', Transaction: { status: { success: true }, events: [] } },
  ),
  waitForTransaction: vi.fn(async () => ({ $kind: 'Transaction', Transaction: { digest: '11'.repeat(22) } })),
};

const mockDAppKit = {
  signAndExecuteTransaction: vi.fn(async () => {
    chain.executions += 1;
    chain.status = 'redeemed'; // the transaction lands on-chain either way
    if (chain.rejectAfterBroadcast) {
      throw new Error('Wallet reported an unexpected response.');
    }
    return { $kind: 'Transaction', Transaction: { digest: '11'.repeat(22) } };
  }),
};

vi.mock('@mysten/dapp-kit-react', () => ({
  useCurrentAccount: () => ({ address: OWNER }),
  useCurrentClient: () => mockClient,
  useDAppKit: () => mockDAppKit,
}));

const settledMarket: PredictMarketState = {
  expiryMarketId: MARKET_ID,
  expiryMs: 1_000,
  settlementPrice: 65_000,
  settlementPriceBaseUnits: 65_000_000_000_000n,
  settledAtMs: 1_001,
};

function Harness() {
  const portfolio = useAnkerPortfolio();
  const note = portfolio.data?.[0];
  if (!note) return <p>loading</p>;
  return <ClaimAction note={note} marketState={settledMarket} />;
}

function renderHarness() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  chain.status = 'open';
  chain.executions = 0;
  chain.rejectAfterBroadcast = false;
  vi.clearAllMocks();
});

describe('ClaimAction chain resync', () => {
  it('flips the note to claimed after a successful claim', async () => {
    renderHarness();
    const button = await screen.findByRole('button', { name: 'Claim payout' });
    expect(button).toBeEnabled();

    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText('You received')).toBeVisible());
    expect(screen.getByRole('button', { name: 'Claim payout' })).toBeDisabled();
    expect(chain.executions).toBe(1);
  });

  it('resyncs to the on-chain claimed state when the wallet rejects after broadcasting', async () => {
    chain.rejectAfterBroadcast = true;
    renderHarness();
    const button = await screen.findByRole('button', { name: 'Claim payout' });

    fireEvent.click(button);

    // The transaction landed on-chain; the UI must converge to the truth
    // instead of leaving a claimable-looking, error-on-reclick note.
    await waitFor(() => expect(screen.getByText('You received')).toBeVisible());
    expect(screen.getByRole('button', { name: 'Claim payout' })).toBeDisabled();
  });
});
