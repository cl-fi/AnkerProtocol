'use client';

import { useCurrentAccount, useCurrentClient, useDAppKit } from '@mysten/dapp-kit-react';
import { useQueryClient } from '@tanstack/react-query';
import { WalletCards } from 'lucide-react';
import { useState } from 'react';
import { usePredictManagers } from '../hooks/usePredictManagers';
import type { DualInvestmentInput, StructuredProductQuote } from '../products/types';
import {
  buildCreatePredictManagerTransaction,
  buildSubscribeDualInvestmentTransaction,
} from '../sui/ankerTransactions';
import { preflightTransaction } from '../sui/transactionPreflight';

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

function shortId(value: string) {
  return value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
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

  let status = 'Connect wallet to subscribe';
  if (hasAccount && isLoadingManagers) status = 'Checking PredictManager...';
  if (hasAccount && !isLoadingManagers && !hasManager) status = 'Create a PredictManager before subscribing.';
  if (hasAccount && hasManager) status = `PredictManager ${managerId ? shortId(managerId) : ''} is ready.`;

  return (
    <article className="detail-panel execution-panel">
      <div className="detail-title">
        <h3>On-chain Subscribe</h3>
        <span>Target Buy execution adapter</span>
      </div>
      <div className="execution-status">
        <WalletCards size={18} />
        <span>{status}</span>
      </div>
      <div className="execution-actions">
        {hasAccount && !hasManager ? (
          <button className="small-action" type="button" disabled={isPending || isLoadingManagers} onClick={onCreateManager}>
            {isPending ? 'Waiting for wallet...' : 'Create Predict Manager'}
          </button>
        ) : null}
        <button className="primary-action" type="button" disabled={!canSubscribe} onClick={onSubscribe}>
          {isPending ? 'Waiting for wallet...' : 'Subscribe Target Buy'}
        </button>
      </div>
      {quoteWarning && !isQuoteExecutable ? <p className="execution-error">{quoteWarning}</p> : null}
      {digest ? (
        <p className="execution-message">
          Transaction submitted: {shortId(digest)}
          <a href="/app/dashboard">View Dashboard</a>
        </p>
      ) : null}
      {error ? <p className="execution-error">{error}</p> : null}
    </article>
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
  const manager = managersQuery.data?.[0];
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
      const plan = buildSubscribeDualInvestmentTransaction({
        accountAddress: account.address,
        managerId: manager.managerId,
        productInput,
        quote,
      });
      await preflightTransaction({
        client,
        sender: account.address,
        transaction: plan.tx,
      });
      const result = await dAppKit.signAndExecuteTransaction({ transaction: plan.tx });
      const nextDigest = transactionDigest(result);
      await client.waitForTransaction({ digest: nextDigest });
      return nextDigest;
    });
  }

  return (
    <TargetBuyExecutionPanelView
      hasAccount={Boolean(account)}
      hasManager={Boolean(manager)}
      isQuoteExecutable={quote.executable}
      quoteWarning={quote.warning}
      isLoadingManagers={managersQuery.isPending && Boolean(account)}
      isPending={isPending}
      managerId={manager?.managerId}
      error={error}
      digest={digest}
      onCreateManager={handleCreateManager}
      onSubscribe={handleSubscribe}
    />
  );
}
