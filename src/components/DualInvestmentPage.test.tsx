import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DualInvestmentPage, QuoteRiskSummary } from './DualInvestmentPage';
import { BuyLowControls, ReferenceTable } from './DualInvestmentQuoteSections';
import { DualInvestmentConfirm, ReturnOverview } from './DualInvestmentQuoteDetail';
import type { ReactNode } from 'react';
import type { BinanceDualInvestmentProduct } from '../deepbook/binanceDualInvestment';
import type { DualInvestmentScanRow } from '../products/dualInvestmentScan';
import type { DualInvestmentInput, OracleMarket, StructuredProductQuote } from '../products/types';

const mocks = vi.hoisted(() => ({
  buildVerifiedDualInvestmentQuote: vi.fn(),
  buildIndicativeDualInvestmentQuote: vi.fn(),
  refetchScan: vi.fn(),
  binanceProducts: [] as BinanceDualInvestmentProduct[],
  marketData: undefined as
    | {
        data: {
          market: OracleMarket;
          productOracles: Array<{ oracle_id: string; expiry: number }>;
          staleSnapshot: boolean;
        };
      }
    | undefined,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => <button className="wallet-loading">Connect Wallet</button>,
}));

vi.mock('lucide-react', () => ({
  RefreshCw: () => <span data-testid="refresh-icon" />,
  ChevronDown: () => <span data-testid="chevron-icon" />,
  ShieldCheck: () => <span data-testid="shield-icon" />,
}));

vi.mock('../hooks/useMarketData', () => ({
  useMarketData: () => mocks.marketData,
}));

vi.mock('../hooks/useDualInvestmentScan', () => ({
  buildVerifiedDualInvestmentQuote: mocks.buildVerifiedDualInvestmentQuote,
  buildIndicativeDualInvestmentQuote: mocks.buildIndicativeDualInvestmentQuote,
  useDualInvestmentScan: () => ({
    data: [],
    isFetching: false,
    dataUpdatedAt: 1,
    refetch: mocks.refetchScan,
  }),
}));

vi.mock('../hooks/useBinanceDualInvestment', () => ({
  useBinanceDualInvestment: () => ({
    data: mocks.binanceProducts,
    isFetching: false,
    error: null,
  }),
}));

vi.mock('./TargetBuyExecutionPanel', () => ({
  TargetBuyExecutionPanel: () => <div data-testid="execution-panel" />,
}));

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

function marketFixture(overrides: Partial<OracleMarket> = {}): OracleMarket {
  return {
    predictId: '0x1',
    oracleId: '0x2',
    underlyingAsset: 'BTC',
    expiryMs: Date.now() + 7 * 24 * 60 * 60_000,
    minStrike: 50_000,
    tickSize: 500,
    status: 'active',
    spot: 66_172,
    forward: 66_167,
    spotTimestampMs: 1,
    sviTimestampMs: 1,
    serverLagSeconds: 1,
    ...overrides,
  };
}

function pageQuoteFixture({
  market = marketFixture(),
  productInput,
  coupon,
}: {
  market?: OracleMarket;
  productInput?: DualInvestmentInput;
  coupon: number;
}): StructuredProductQuote {
  const input = productInput ?? { principal: 5, targetPrice: 65_500, floorPrice: 63_000, targetLegCount: 6 };
  return {
    id: `dual-${coupon}`,
    productType: 'dual-investment',
    title: `Target Buy BTC at ${input.targetPrice}`,
    principal: input.principal,
    oracle: market,
    legs: [
      {
        id: 'up-63000',
        instrumentType: 'binary-up',
        oracleId: market.oracleId,
        expiryMs: market.expiryMs,
        strike: 63_000,
        isUp: true,
        quantity: 0.01,
        description: 'UP 63,000',
        askPrice: 0.4,
        askCost: 0.16,
        redeemPreview: 0,
        quoteTimestampMs: Date.now(),
        executable: true,
      },
    ],
    totalLegCost: 0.16,
    reserve: 4.82,
    coupon,
    targetPrice: input.targetPrice,
    floorPrice: input.floorPrice,
    apr: 1.5,
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

describe('Dual Investment APR display', () => {
  it('shows net APR after protocol fee in Buy Low controls', () => {
    render(
      <BuyLowControls
        market={marketFixture()}
        principal={5}
        targetPrice={65_500}
        estimateApr={1.5}
        onPrincipalChange={() => undefined}
        onTargetChange={() => undefined}
      />,
    );

    expect(screen.getByText('135% APR')).toBeVisible();
  });

  it('shows net APR after protocol fee in return and confirmation summaries', () => {
    const quote = pageQuoteFixture({ coupon: 0.03 });
    const productInput = { principal: 5, targetPrice: 65_500, floorPrice: 63_000, targetLegCount: 6 };

    render(
      <>
        <ReturnOverview quote={quote} productInput={productInput} />
        <DualInvestmentConfirm
          quote={quote}
          productInput={productInput}
          subscribeQuote={null}
          isVerifying={false}
        />
      </>,
    );

    expect(screen.getByText('135%')).toBeVisible();
    expect(screen.getByText('135% APR')).toBeVisible();
    expect(screen.queryByText('150%')).not.toBeInTheDocument();
    expect(screen.queryByText('150% APR')).not.toBeInTheDocument();
  });

  it('shows matched Binance APR, edge, and benchmark methodology in the reference table', () => {
    const market = marketFixture({ expiryMs: Date.UTC(2026, 5, 22) });
    const productInput = { principal: 5, targetPrice: 64_000, floorPrice: 59_000, targetLegCount: 6 };
    const rows: DualInvestmentScanRow[] = [
      {
        input: productInput,
        quote: pageQuoteFixture({ market, productInput, coupon: 0.02 }),
      },
    ];
    const binanceProducts: BinanceDualInvestmentProduct[] = [
      {
        id: 'binance-64000',
        investmentAsset: 'USDC',
        targetAsset: 'BTC',
        strikePrice: 64_000,
        settleTimeMs: Date.UTC(2026, 5, 22, 8),
        apr: 0.8,
        durationDays: 1,
        canPurchase: true,
      },
    ];

    render(
      <ReferenceTable
        market={market}
        rows={rows}
        binanceProducts={binanceProducts}
        activeTargetPrice={64_000}
        isFetching={false}
        onSelect={() => undefined}
        onRefresh={() => undefined}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Binance APR' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Edge' })).toBeVisible();
    expect(screen.getByText('80.00%')).toBeVisible();
    expect(screen.getByText('+55.00 pts')).toBeVisible();
    expect(screen.getByText(/BTCUSDC Dual Investment/i)).toBeVisible();
  });
});

describe('DualInvestmentPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const market = marketFixture();
    mocks.marketData = {
      data: {
        market,
        productOracles: [{ oracle_id: market.oracleId, expiry: market.expiryMs }],
        staleSnapshot: false,
      },
    };
    mocks.buildVerifiedDualInvestmentQuote.mockReset();
    mocks.buildIndicativeDualInvestmentQuote.mockReset();
    mocks.buildIndicativeDualInvestmentQuote.mockImplementation(
      ({ market: oracle, productInput }: { market: OracleMarket; productInput: DualInvestmentInput }) =>
        pageQuoteFixture({ market: oracle, productInput, coupon: 0.02 }),
    );
    mocks.refetchScan.mockReset();
    mocks.binanceProducts = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders Buy Low as active and Sell High as a disabled coming-soon direction', () => {
    render(<DualInvestmentPage />);

    expect(screen.getByRole('link', { name: 'Buy Low' })).toBeVisible();
    const sellHigh = screen.getByRole('button', { name: 'Sell High' });
    expect(sellHigh).not.toHaveAttribute('title');
    expect(sellHigh).toHaveAttribute('aria-disabled', 'true');
  });

  it('leads with a live estimate of the Return Overview and needs no preview step', () => {
    render(<DualInvestmentPage />);

    expect(screen.getByRole('heading', { name: 'Return Overview' })).toBeVisible();
    expect(screen.getByText('Subscription Amount')).toBeVisible();
    expect(screen.getByText('Estimate')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Preview/i })).not.toBeInTheDocument();
    // Subscribe is gated until the background quote confirms.
    expect(screen.queryByTestId('execution-panel')).not.toBeInTheDocument();
  });

  it('verifies in the background and unlocks the subscribe execution panel', async () => {
    mocks.buildVerifiedDualInvestmentQuote.mockResolvedValue(
      pageQuoteFixture({ market: mocks.marketData?.data.market, coupon: 0.03 }),
    );

    render(<DualInvestmentPage />);

    expect(screen.queryByTestId('execution-panel')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(mocks.buildVerifiedDualInvestmentQuote).toHaveBeenCalled();
    expect(screen.getByTestId('execution-panel')).toBeVisible();
    // Once verified, the badge flips from Estimate to the live quote.
    expect(screen.getByText('Live quote')).toBeVisible();
  });

  it('surfaces a verification failure without blocking the estimate', async () => {
    mocks.buildVerifiedDualInvestmentQuote.mockRejectedValue(new Error('devInspect unavailable'));

    render(<DualInvestmentPage />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(screen.getByText('devInspect unavailable')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Return Overview' })).toBeVisible();
    expect(screen.queryByTestId('execution-panel')).not.toBeInTheDocument();
  });
});
