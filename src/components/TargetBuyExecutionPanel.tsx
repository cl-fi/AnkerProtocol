'use client';

import { useCurrentAccount, useCurrentClient, useDAppKit } from '@mysten/dapp-kit-react';
import { useQueryClient } from '@tanstack/react-query';
import { WalletCards } from 'lucide-react';
import { useState } from 'react';
import {
  buildSubscribeDualInvestmentApplicationPlan,
  createSubscribeQuoteEnvelope,
  refreshDualInvestmentQuoteForSigning,
  selectUnallocatedPredictManager,
} from '../application/subscribeDualInvestment';
import { createDefaultQuoteProvider } from '../deepbook/quoteProvider';
import { useAnkerPortfolio } from '../hooks/useAnkerPortfolio';
import { usePredictManagers } from '../hooks/usePredictManagers';
import type { DualInvestmentInput, StructuredProductQuote } from '../products/types';
import { buildCreatePredictManagerTransaction } from '../sui/ankerTransactions';
import { recordSubscriptionDigest } from '../sui/subscriptionDigestStore';
import { preflightTransaction } from '../sui/transactionPreflight';
import { Button, Card } from '../ui';

interface TargetBuyExecutionPanelViewProps {
  hasAccount: boolean;
  hasManager: boolean;
  isQuoteExecutable: boolean;
  quoteWarning?: string;
  isLoadingManagers: boolean;
  isPending: boolean;
  managerId?: string;
  error?: string | null;
  digest?: string | null;
  onCreateManager: () => void;
  onSubscribe: () => void;
}

const subscriptionQuoteProvider = createDefaultQuoteProvider();

function shortId(value: string) {
  return value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

export type TargetBuyExecutionState =
  | 'connect-wallet'
  | 'checking-manager'
  | 'manager-required'
  | 'ready'
  | 'quote-expired'
  | 'awaiting-signature'
  | 'transaction-submitted'
  | 'transaction-failed';

export function targetBuyExecutionViewModel({
  hasAccount,
  hasManager,
  isLoadingManagers,
  isPending,
  managerId,
  error,
  digest,
}: Pick<
  TargetBuyExecutionPanelViewProps,
  'hasAccount' | 'hasManager' | 'isLoadingManagers' | 'isPending' | 'managerId' | 'error' | 'digest'
>) {
  if (!hasAccount) {
    return { state: 'connect-wallet' as const, status: 'Connect wallet to subscribe' };
  }
  if (isPending) {
    return { state: 'awaiting-signature' as const, status: 'Awaiting wallet signature.' };
  }
  if (error) {
    if (error.startsWith('Quote expired')) {
      return { state: 'quote-expired' as const, status: 'Quote expired. Refresh pricing before signing.' };
    }
    return { state: 'transaction-failed' as const, status: 'Transaction failed. Review the error and retry.' };
  }
  if (digest) {
    return { state: 'transaction-submitted' as const, status: 'Transaction submitted. Track it in your Dashboard.' };
  }
  if (isLoadingManagers) {
    return { state: 'checking-manager' as const, status: 'Checking your product container...' };
  }
  if (!hasManager) {
    return {
      state: 'manager-required' as const,
      status: 'Start with step 1 — create your product container.',
    };
  }
  return {
    state: 'ready' as const,
    status: `Product container ${managerId ? shortId(managerId) : ''} is ready. Subscribe to finish.`,
  };
}

export function TargetBuyExecutionPanelView({
  hasAccount,
  hasManager,
  isQuoteExecutable,
  quoteWarning,
  isLoadingManagers,
  isPending,
  managerId,
  error,
  digest,
  onCreateManager,
  onSubscribe,
}: TargetBuyExecutionPanelViewProps) {
  const canSubscribe = hasAccount && hasManager && isQuoteExecutable && !isPending;
  const execution = targetBuyExecutionViewModel({
    hasAccount,
    hasManager,
    isLoadingManagers,
    isPending,
    managerId,
    error,
    digest,
  });

  const step1State = !hasAccount ? 'locked' : hasManager ? 'done' : 'active';
  const step2State = !hasAccount || !hasManager ? 'locked' : 'active';

  return (
    <Card as="article" className="execution-panel">
      <div className="detail-title">
        <h3>On-chain Subscribe</h3>
        <span>Sui testnet</span>
      </div>

      <ol className="exec-steps">
        <li className={`exec-step is-${step1State}`}>
          <span className="exec-step-mark">{hasManager ? '✓' : '1'}</span>
          <div className="exec-step-text">
            <strong>Create product container</strong>
            <span>Each Buy Low position needs its own container — create one before you subscribe.</span>
          </div>
          <div className="exec-step-action">
            {hasManager ? (
              <span className="exec-step-badge">Ready</span>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasAccount || isPending || isLoadingManagers}
                onClick={onCreateManager}
              >
                {isPending ? 'Waiting for wallet...' : isLoadingManagers ? 'Checking...' : 'Create Product Container'}
              </Button>
            )}
          </div>
        </li>

        <li className={`exec-step is-${step2State}`}>
          <span className="exec-step-mark">2</span>
          <div className="exec-step-text">
            <strong>Subscribe Buy Low</strong>
            <span>Confirm in your wallet to lock in your reward.</span>
          </div>
          <div className="exec-step-action">
            <Button variant="primary" disabled={!canSubscribe} onClick={onSubscribe}>
              {isPending ? 'Waiting for wallet...' : 'Subscribe Buy Low'}
            </Button>
          </div>
        </li>
      </ol>

      <div className="execution-status">
        <WalletCards size={18} />
        <span>{execution.status}</span>
      </div>

      {quoteWarning && !isQuoteExecutable ? <p className="execution-error">{quoteWarning}</p> : null}
      {digest ? (
        <p className="execution-message">
          Transaction submitted: {shortId(digest)}
          <a href="/app/dashboard">View Dashboard</a>
        </p>
      ) : null}
      {error ? <p className="execution-error">{error}</p> : null}
    </Card>
  );
}

function transactionDigest(result: Awaited<ReturnType<ReturnType<typeof useDAppKit>['signAndExecuteTransaction']>>) {
  if (result.FailedTransaction) {
    throw new Error(result.FailedTransaction.status.error?.message ?? 'Transaction failed.');
  }
  return result.Transaction.digest;
}

export function TargetBuyExecutionPanel({
  quote,
  productInput,
}: {
  quote: StructuredProductQuote;
  productInput: DualInvestmentInput;
}) {
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const managersQuery = usePredictManagers();
  const portfolioQuery = useAnkerPortfolio();
  const manager = selectUnallocatedPredictManager(managersQuery.data, portfolioQuery.data, account?.address);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [digest, setDigest] = useState<string | null>(null);

  async function runTransaction(action: () => Promise<string>) {
    setIsPending(true);
    setError(null);
    setDigest(null);
    try {
      const nextDigest = await action();
      setDigest(nextDigest);
      await queryClient.invalidateQueries({ queryKey: ['predict-managers', account?.address] });
      await queryClient.invalidateQueries({ queryKey: ['anker-portfolio', account?.address] });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Transaction failed.');
    } finally {
      setIsPending(false);
    }
  }

  function handleCreateManager() {
    if (!account) return;
    void runTransaction(async () => {
      const plan = buildCreatePredictManagerTransaction();
      const result = await dAppKit.signAndExecuteTransaction({ transaction: plan.tx });
      const nextDigest = transactionDigest(result);
      await client.waitForTransaction({ digest: nextDigest });
      await managersQuery.refetch();
      return nextDigest;
    });
  }

  function handleSubscribe() {
    if (!account || !manager) return;
    void runTransaction(async () => {
      const quoteEnvelope = createSubscribeQuoteEnvelope(quote);
      const refreshedQuote = await refreshDualInvestmentQuoteForSigning({
        productInput,
        quote,
        quoteEnvelope,
        quoteProvider: subscriptionQuoteProvider,
      });
      const plan = buildSubscribeDualInvestmentApplicationPlan({
        accountAddress: account.address,
        managers: managersQuery.data,
        notes: portfolioQuery.data,
        productInput,
        quote: refreshedQuote,
        quoteEnvelope,
      });
      await preflightTransaction({
        client,
        sender: account.address,
        transaction: plan.transactionPlan.tx,
      });
      const result = await dAppKit.signAndExecuteTransaction({ transaction: plan.transactionPlan.tx });
      const nextDigest = transactionDigest(result);
      await client.waitForTransaction({ digest: nextDigest });
      recordSubscriptionDigest({
        owner: account.address,
        quoteHash: plan.quoteEnvelope.productHash,
        digest: nextDigest,
      });
      return nextDigest;
    });
  }

  return (
    <TargetBuyExecutionPanelView
      hasAccount={Boolean(account)}
      hasManager={Boolean(manager)}
      isQuoteExecutable={quote.executable}
      quoteWarning={quote.warning}
      isLoadingManagers={(managersQuery.isPending || portfolioQuery.isPending) && Boolean(account)}
      isPending={isPending}
      managerId={manager?.managerId}
      error={error}
      digest={digest}
      onCreateManager={handleCreateManager}
      onSubscribe={handleSubscribe}
    />
  );
}
