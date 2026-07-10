import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEEPBOOK_PREDICT } from '../config/deepbook';
import { buildDualInvestmentLegIntents, compileDualInvestment } from '../products/dualInvestment';
import type { DualInvestmentInput, StructuredProductQuote } from '../products/types';
import { TargetBuyExecutionPanel } from './TargetBuyExecutionPanel';

const OWNER = `0x${'a'.repeat(64)}`;
const MANAGER_ID = `0x${'b'.repeat(64)}`;
const ORACLE_ID = `0x${'c'.repeat(64)}`;
const PREDICT_OBJECT_ID = DEEPBOOK_PREDICT.poolVaultId;

const mocks = vi.hoisted(() => ({
  quoteLegs: vi.fn(),
  preflightTransaction: vi.fn(),
  signAndExecuteTransaction: vi.fn(),
  waitForTransaction: vi.fn(),
  invalidateQueries: vi.fn(),
  managersData: [] as Array<{ managerId: string; owner?: string }>,
  portfolioData: [] as Array<{ managerId: string }>,
  managersRefetch: vi.fn(),
  portfolioRefetch: vi.fn(),
}));

vi.mock('lucide-react', () => ({
  WalletCards: () => <span data-testid="wallet-icon" />,
}));

vi.mock('@mysten/dapp-kit-react', () => ({
  useCurrentAccount: () => ({ address: OWNER }),
  useCurrentClient: () => ({
    waitForTransaction: mocks.waitForTransaction,
  }),
  useDAppKit: () => ({
    signAndExecuteTransaction: mocks.signAndExecuteTransaction,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock('../hooks/usePredictManagers', () => ({
  usePredictManagers: () => ({
    data: mocks.managersData,
    isPending: false,
    refetch: mocks.managersRefetch,
  }),
}));

vi.mock('../hooks/useAnkerPortfolio', () => ({
  useAnkerPortfolio: () => ({
    data: mocks.portfolioData,
    isPending: false,
    refetch: mocks.portfolioRefetch,
  }),
}));

vi.mock('../deepbook/quoteProvider', () => ({
  createDefaultQuoteProvider: () => ({
    quoteLegs: mocks.quoteLegs,
  }),
}));

vi.mock('../sui/transactionPreflight', () => ({
  preflightTransaction: mocks.preflightTransaction,
}));

function productInputFixture(): DualInvestmentInput {
  return {
    principal: 1_000,
    targetPrice: 66_000,
    floorPrice: 61_000,
    targetLegCount: 1,
  };
}

function quoteFixture(productInput = productInputFixture()): StructuredProductQuote {
  const nowMs = Date.now();
  const oracle = {
    predictId: PREDICT_OBJECT_ID,
    oracleId: ORACLE_ID,
    underlyingAsset: 'BTC' as const,
    expiryMs: nowMs + 7 * 24 * 60 * 60_000,
    minStrike: 50_000,
    tickSize: 1,
    status: 'active',
    spot: 66_172,
    forward: 66_167,
    spotTimestampMs: 1,
    sviTimestampMs: 1,
    serverLagSeconds: 1,
  };
  const quotedLegs = buildDualInvestmentLegIntents(productInput, oracle).map((leg) => ({
    ...leg,
    askPrice: 0.03,
    askCost: 2.1,
    redeemPreview: 0,
    quoteTimestampMs: nowMs,
    executable: true,
  }));
  return compileDualInvestment({ input: productInput, oracle, quotedLegs, nowMs });
}

describe('TargetBuyExecutionPanel subscription flow', () => {
  beforeEach(() => {
    mocks.quoteLegs.mockReset();
    mocks.preflightTransaction.mockReset();
    mocks.signAndExecuteTransaction.mockReset();
    mocks.waitForTransaction.mockReset();
    mocks.invalidateQueries.mockReset();
    mocks.managersRefetch.mockReset();
    mocks.portfolioRefetch.mockReset();
    mocks.managersData = [{ managerId: MANAGER_ID, owner: OWNER }];
    mocks.portfolioData = [];
  });

  it('refreshes the quote before preflight and wallet signing', async () => {
    const productInput = productInputFixture();
    const quote = quoteFixture(productInput);
    mocks.quoteLegs.mockResolvedValue(
      buildDualInvestmentLegIntents(productInput, quote.oracle).map((leg) => ({
        ...leg,
        askPrice: 0.031,
        askCost: 2.11,
        redeemPreview: 0,
        quoteTimestampMs: Date.now(),
        executable: true,
      })),
    );
    mocks.preflightTransaction.mockResolvedValue({ status: 'success', engine: 'devInspectTransactionBlock' });
    mocks.signAndExecuteTransaction.mockResolvedValue({ Transaction: { digest: '0xdigest' } });
    mocks.waitForTransaction.mockResolvedValue({});

    render(<TargetBuyExecutionPanel quote={quote} productInput={productInput} />);

    fireEvent.click(screen.getByRole('button', { name: 'Subscribe Buy Low' }));

    await waitFor(() => expect(mocks.quoteLegs).toHaveBeenCalledTimes(1));
    expect(mocks.preflightTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.signAndExecuteTransaction).toHaveBeenCalledTimes(1);
  });

  it('opens a Predict account as a separate wallet transaction when none is available', async () => {
    mocks.managersData = [];
    const productInput = productInputFixture();
    const quote = quoteFixture(productInput);
    mocks.quoteLegs.mockResolvedValue(
      buildDualInvestmentLegIntents(productInput, quote.oracle).map((leg) => ({
        ...leg,
        askPrice: 0.031,
        askCost: 2.11,
        redeemPreview: 0,
        quoteTimestampMs: Date.now(),
        executable: true,
      })),
    );
    mocks.preflightTransaction.mockResolvedValue({ status: 'success', engine: 'devInspectTransactionBlock' });
    mocks.signAndExecuteTransaction.mockResolvedValueOnce({ Transaction: { digest: '0xmanager' } });
    mocks.waitForTransaction.mockResolvedValue({});

    render(<TargetBuyExecutionPanel quote={quote} productInput={productInput} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Predict account' }));

    await waitFor(() => expect(mocks.signAndExecuteTransaction).toHaveBeenCalledTimes(1));
    expect(mocks.waitForTransaction).toHaveBeenCalledWith({ digest: '0xmanager' });
    expect(mocks.managersRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.portfolioRefetch).not.toHaveBeenCalled();
    expect(mocks.quoteLegs).not.toHaveBeenCalled();
    expect(mocks.preflightTransaction).not.toHaveBeenCalled();
  });
});
