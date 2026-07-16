import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordSubscriptionDigest } from '../sui/subscriptionDigestStore';
import {
  IndexedTransactionDigestValue,
  OracleLastUpdateValue,
  SettlementRangeValue,
  SubscriptionDigestValue,
  depositedCashText,
  claimEstimateForNote,
} from './PortfolioPage';
import { ProductNoteCard } from './PortfolioProductNoteCard';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import type { ProductNoteEventIndexEntry } from '../sui/productNoteEvents';

vi.mock('@mysten/dapp-kit-react', () => ({
  useCurrentAccount: () => null,
  useCurrentClient: () => ({}),
  useCurrentWallet: () => null,
  useDAppKit: () => ({ signTransaction: vi.fn() }),
}));


function noteFixture(overrides: Partial<AnkerProductNoteRecord> = {}): AnkerProductNoteRecord {
  return {
    noteId: `0x${'c'.repeat(64)}`,
    productType: 'dual-investment',
    productId: 'dual-demo',
    owner: `0x${'a'.repeat(64)}`,
    wrapperId: `0x${'b'.repeat(64)}`,
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
    orderIds: [11n],
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('claimEstimateForNote', () => {
  it('uses reserve plus coupon when no option leg payout has been realized yet', () => {
    expect(claimEstimateForNote(noteFixture())).toEqual({
      grossPayout: 4.943865,
      feeAmount: 0.000745,
      netPayout: 4.94312,
    });
  });
});

describe('ProductNoteCard', () => {
  it('shows reward APR after the note fee bps', () => {
    const note = noteFixture();

    renderWithQuery(
      <ProductNoteCard
        note={note}
        onClaimSuccess={() => {}}
      />,
    );

    expect(screen.getByText('82.44% APR')).toBeVisible();
    expect(screen.queryByText('91.6% APR')).not.toBeInTheDocument();
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
    expect(depositedCashText(noteFixture())).toBe('5.00');
  });
});

describe('OracleLastUpdateValue', () => {
  it('loads and displays the last on-chain oracle update timestamp', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        const href = String(url);
        if (href.startsWith('/api/oracles/0xoracle/market')) {
          return rpcResponse({
            predictId: '0xvault',
            oracleId: '0xoracle',
            underlyingAsset: 'BTC',
            expiryMs: Date.now() + 3_600_000,
            minStrike: 1,
            tickSize: 0.01,
            status: 'active',
            spot: 65_000,
            forward: 65_000,
            spotTimestampMs: Date.UTC(2026, 5, 1, 1, 2, 0),
            sviTimestampMs: Date.UTC(2026, 5, 1, 1, 2, 0),
            serverLagSeconds: 0,
          });
        }
        throw new Error(`Unexpected fetch: ${href}`);
      }),
    );

    renderWithQuery(<OracleLastUpdateValue oracleId="0xoracle" />);

    // Jun 1 01:02 UTC rendered in the viewer's timezone (tests pin Asia/Shanghai).
    expect(await screen.findByText('Jun 01, 09:02 AM (UTC+8)')).toBeVisible();
  });
});

describe('SettlementRangeValue', () => {
  it('shows the current estimated gross payout range for a Target Buy note', () => {
    render(<SettlementRangeValue note={noteFixture()} />);

    expect(screen.getByText('4.94 - 5.01 dUSDC')).toBeVisible();
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

    // Values above 2^53 base units stay exact via the bigint path; a float
    // detour would drift the cents.
    expect(screen.getByText('9,007,199,254.74 - 9,007,199,254.74 dUSDC')).toBeVisible();
  });
});
