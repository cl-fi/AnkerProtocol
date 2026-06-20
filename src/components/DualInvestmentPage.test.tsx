import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DualInvestmentPage, QuoteRiskSummary } from './DualInvestmentPage';
import type { ReactNode } from 'react';
import type { DualInvestmentInput, OracleMarket, StructuredProductQuote } from '../products/types';

const mocks = vi.hoisted(() => ({
  buildVerifiedDualInvestmentQuote: vi.fn(),
  refetchScan: vi.fn(),
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
  Activity: () => <span data-testid="activity-icon" />,
  Calculator: () => <span data-testid="calculator-icon" />,
  ShieldCheck: () => <span data-testid="shield-icon" />,
  SlidersHorizontal: () => <span data-testid="sliders-icon" />,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Line: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

vi.mock('../hooks/useMarketData', () => ({
  useMarketData: () => mocks.marketData,
}));

vi.mock('../hooks/useDualInvestmentScan', () => ({
  buildVerifiedDualInvestmentQuote: mocks.buildVerifiedDualInvestmentQuote,
  useDualInvestmentScan: () => ({
    data: [],
    isFetching: false,
    dataUpdatedAt: 1,
    refetch: mocks.refetchScan,
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
  productInput = { principal: 5, targetPrice: 65_500, floorPrice: 63_000, targetLegCount: 6 },
  coupon,
}: {
  market?: OracleMarket;
  productInput?: DualInvestmentInput;
  coupon: number;
}): StructuredProductQuote {
  return {
    id: `dual-${coupon}`,
    productType: 'dual-investment',
    title: `Target Buy BTC at ${productInput.targetPrice}`,
    principal: productInput.principal,
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
    targetPrice: productInput.targetPrice,
    floorPrice: productInput.floorPrice,
    apr: coupon === 0.02 ? 1.3807 : 1.52,
    executable: true,
    scenarios: [
      {
        settlementPrice: 66_000,
        label: 'Above target',
        finalUsdc: productInput.principal + coupon,
        coupon,
        realizedLegIds: ['up-63000'],
        expiredLegIds: [],
      },
    ],
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

describe('DualInvestmentPage quote preview refresh', () => {
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
    mocks.refetchScan.mockReset();
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

  it('keeps the existing preview visible while the 30s auto-refresh re-quotes', async () => {
    const firstQuote = pageQuoteFixture({ market: mocks.marketData?.data.market, coupon: 0.02 });
    const secondQuote = pageQuoteFixture({ market: mocks.marketData?.data.market, coupon: 0.03 });
    let resolveRefresh: (quote: StructuredProductQuote) => void = () => undefined;
    const refreshPromise = new Promise<StructuredProductQuote>((resolve) => {
      resolveRefresh = resolve;
    });
    mocks.buildVerifiedDualInvestmentQuote
      .mockResolvedValueOnce(firstQuote)
      .mockReturnValueOnce(refreshPromise);

    render(<DualInvestmentPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Preview Live Quote' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('heading', { name: 'Return Overview' })).toBeVisible();
    expect(screen.getByText('Subscription Amount')).toBeVisible();
    expect(screen.getByText(/Rewards/)).toBeVisible();
    expect(screen.getAllByText('You will receive')[0]).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'At or Below 65,500' }));
    expect(screen.getAllByText('BTC equiv.')[0]).toBeVisible();

    expect(screen.getByText('0.02 dUSDC')).toBeVisible();
    expect(screen.queryByText(/Choose parameters and run Preview/i)).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(mocks.buildVerifiedDualInvestmentQuote).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Refreshing quote...')).toBeVisible();
    expect(screen.getByText('0.02 dUSDC')).toBeVisible();

    await act(async () => {
      resolveRefresh(secondQuote);
      await Promise.resolve();
    });

    expect(screen.getByText('0.03 dUSDC')).toBeVisible();
    expect(screen.queryByText('Refreshing quote...')).not.toBeInTheDocument();
  });

  it('does not clear the preview when the same oracle market data refreshes', async () => {
    const market = mocks.marketData?.data.market as OracleMarket;
    mocks.buildVerifiedDualInvestmentQuote.mockResolvedValueOnce(pageQuoteFixture({ market, coupon: 0.02 }));
    const { rerender } = render(<DualInvestmentPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Preview Live Quote' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('0.02 dUSDC')).toBeVisible();

    mocks.marketData = {
      data: {
        market: { ...market, spot: market.spot + 10, spotTimestampMs: market.spotTimestampMs + 1 },
        productOracles: [{ oracle_id: market.oracleId, expiry: market.expiryMs }],
        staleSnapshot: false,
      },
    };
    rerender(<DualInvestmentPage />);

    expect(screen.getByText('0.02 dUSDC')).toBeVisible();
    expect(screen.queryByText(/Choose parameters and run Preview/i)).not.toBeInTheDocument();
  });
});
