'use client';

import { useCurrentAccount, useCurrentClient, useDAppKit } from '@mysten/dapp-kit-react';
import { useQueryClient } from '@tanstack/react-query';
import { WalletCards } from 'lucide-react';
import { useState } from 'react';
import {
  createSubscribeQuoteEnvelope,
  prepareSubscribeDualInvestmentForSigning,
  refreshDualInvestmentQuoteForSigning,
  selectUnallocatedPredictManager,
} from '../application/subscribeDualInvestment';
import { createDefaultQuoteProvider } from '../deepbook/quoteProvider';
import { useAccountWrapperBalance } from '../hooks/useAccountWrapper';
import { useAnkerPortfolio } from '../hooks/useAnkerPortfolio';
import { usePredictManagers } from '../hooks/usePredictManagers';
import { copyForLocale, DEFAULT_LOCALE, localizedPath, type Locale } from '../i18n';
import type { DualInvestmentInput, StructuredProductQuote } from '../products/types';
import { buildCreateAccountWrapperTransaction } from '../sui/accountTransactions';
import { recordSubscriptionDigest } from '../sui/subscriptionDigestStore';
import { Button, Card } from '../ui';
import { SubscribeSuccessDialog } from './SubscribeSuccessDialog';

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
  /** True once the digest belongs to a wait-confirmed subscribe (vs. account creation). */
  subscribeConfirmed?: boolean;
  simulatedCostLabel?: string | null;
  locale?: Locale;
  onCreateManager: () => void;
  onSubscribe: () => void;
}

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
  | 'subscribe-confirmed'
  | 'transaction-failed';

export function targetBuyExecutionViewModel({
  hasAccount,
  hasManager,
  isLoadingManagers,
  isPending,
  managerId,
  error,
  digest,
  subscribeConfirmed,
  locale = DEFAULT_LOCALE,
}: Pick<
  TargetBuyExecutionPanelViewProps,
  | 'hasAccount'
  | 'hasManager'
  | 'isLoadingManagers'
  | 'isPending'
  | 'managerId'
  | 'error'
  | 'digest'
  | 'subscribeConfirmed'
  | 'locale'
>) {
  const copy = copyForLocale(locale);
  if (!hasAccount) {
    return { state: 'connect-wallet' as const, status: copy.execution.status.connectWallet };
  }
  if (isPending) {
    return { state: 'awaiting-signature' as const, status: copy.execution.status.awaitingSignature };
  }
  if (error) {
    if (error.startsWith('Quote expired')) {
      return { state: 'quote-expired' as const, status: copy.execution.status.quoteExpired };
    }
    return { state: 'transaction-failed' as const, status: copy.execution.status.transactionFailed };
  }
  if (digest && subscribeConfirmed) {
    return { state: 'subscribe-confirmed' as const, status: copy.execution.status.subscribeConfirmed };
  }
  if (digest) {
    return { state: 'transaction-submitted' as const, status: copy.execution.status.submitted };
  }
  if (isLoadingManagers) {
    return { state: 'checking-manager' as const, status: copy.execution.status.checkingManager };
  }
  if (!hasManager) {
    return {
      state: 'manager-required' as const,
      status: copy.execution.status.managerRequired,
    };
  }
  return {
    state: 'ready' as const,
    status: copy.execution.status.ready(managerId ? shortId(managerId) : ''),
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
  subscribeConfirmed,
  simulatedCostLabel,
  locale = DEFAULT_LOCALE,
  onCreateManager,
  onSubscribe,
}: TargetBuyExecutionPanelViewProps) {
  const copy = copyForLocale(locale);
  const canSubscribe = hasAccount && hasManager && isQuoteExecutable && !isPending;
  const execution = targetBuyExecutionViewModel({
    hasAccount,
    hasManager,
    isLoadingManagers,
    isPending,
    managerId,
    error,
    digest,
    subscribeConfirmed,
    locale,
  });

  const step1State = !hasAccount ? 'locked' : hasManager ? 'done' : 'active';
  const step2State = !hasAccount || !hasManager ? 'locked' : 'active';

  return (
    <Card as="article" className="execution-panel">
      <div className="detail-title">
        <h3>{copy.execution.onChainSubscribe}</h3>
        <span>{copy.execution.suiTestnet}</span>
      </div>

      <ol className="exec-steps">
        <li className={`exec-step is-${step1State}`}>
          <span className="exec-step-mark">{hasManager ? '✓' : '1'}</span>
          <div className="exec-step-text">
            <strong>{copy.execution.createContainer}</strong>
            <span>{copy.execution.createContainerHelp}</span>
          </div>
          <div className="exec-step-action">
            {hasManager ? (
              <span className="exec-step-badge">{copy.execution.ready}</span>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasAccount || isPending || isLoadingManagers}
                onClick={onCreateManager}
              >
                {isPending
                  ? copy.execution.waitingForWallet
                  : isLoadingManagers
                    ? copy.execution.checking
                    : copy.execution.createProductContainer}
              </Button>
            )}
          </div>
        </li>

        <li className={`exec-step is-${step2State}`}>
          <span className="exec-step-mark">2</span>
          <div className="exec-step-text">
            <strong>{copy.execution.subscribeBuyLow}</strong>
            <span>{copy.execution.subscribeHelp}</span>
          </div>
          <div className="exec-step-action">
            <Button variant="primary" disabled={!canSubscribe} onClick={onSubscribe}>
              {isPending ? copy.execution.waitingForWallet : copy.execution.subscribeBuyLow}
            </Button>
          </div>
        </li>
      </ol>

      <div className="execution-status">
        <WalletCards size={18} />
        <span>{execution.status}</span>
      </div>

      {simulatedCostLabel ? <p className="execution-message">{simulatedCostLabel}</p> : null}
      {quoteWarning && !isQuoteExecutable ? <p className="execution-error">{quoteWarning}</p> : null}
      {digest ? (
        <p className={subscribeConfirmed ? 'execution-message execution-success' : 'execution-message'}>
          {subscribeConfirmed ? copy.execution.subscribeConfirmedPrefix : copy.execution.transactionSubmittedPrefix}{' '}
          {shortId(digest)}
          <a href={localizedPath(locale, '/app/portfolio')}>{copy.execution.viewPortfolio}</a>
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
  locale = DEFAULT_LOCALE,
}: {
  quote: StructuredProductQuote;
  productInput: DualInvestmentInput;
  locale?: Locale;
}) {
  const copy = copyForLocale(locale);
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const managersQuery = usePredictManagers();
  const portfolioQuery = useAnkerPortfolio();
  const manager = selectUnallocatedPredictManager(managersQuery.data, portfolioQuery.data, account?.address);
  const balanceQuery = useAccountWrapperBalance(manager?.managerId);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [subscribeConfirmed, setSubscribeConfirmed] = useState(false);
  const [simulatedCostLabel, setSimulatedCostLabel] = useState<string | null>(null);
  const [successDigest, setSuccessDigest] = useState<string | null>(null);

  async function runTransaction(action: () => Promise<string>) {
    setIsPending(true);
    setError(null);
    setDigest(null);
    setSubscribeConfirmed(false);
    try {
      const nextDigest = await action();
      setDigest(nextDigest);
      await queryClient.invalidateQueries({ queryKey: ['account-wrapper', account?.address] });
      await queryClient.invalidateQueries({ queryKey: ['account-wrapper-balance'] });
      await queryClient.invalidateQueries({ queryKey: ['anker-portfolio', account?.address] });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : copy.execution.errors.transactionFailed);
    } finally {
      setIsPending(false);
    }
  }

  function handleCreateManager() {
    if (!account) return;
    void runTransaction(async () => {
      const plan = buildCreateAccountWrapperTransaction();
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
      setSimulatedCostLabel(null);
      const quoteEnvelope = createSubscribeQuoteEnvelope(quote);
      const refreshedQuote = await refreshDualInvestmentQuoteForSigning({
        productInput,
        quote,
        quoteEnvelope,
        // Must pass the market so SVI browse pricing is used — market-less
        // createDefaultQuoteProvider() falls back to non-executable Snapshot quotes.
        quoteProvider: createDefaultQuoteProvider(quote.oracle),
      });
      // Simulate first (readable abort, no wallet). Rebuild mint caps from OrderMinted costs.
      const prepared = await prepareSubscribeDualInvestmentForSigning({
        accountAddress: account.address,
        managers: managersQuery.data,
        notes: portfolioQuery.data,
        productInput,
        quote: refreshedQuote,
        quoteEnvelope,
        wrapperBalanceBaseUnits: balanceQuery.data?.dusdcBalanceBaseUnits ?? 0n,
        client,
      });
      const simulatedUsdc = Number(prepared.simulatedTotalCostBaseUnits) / 1_000_000;
      setSimulatedCostLabel(`Simulated mint cost: ${simulatedUsdc.toFixed(6)} dUSDC`);
      const result = await dAppKit.signAndExecuteTransaction({
        transaction: prepared.transactionPlan.tx,
      });
      const nextDigest = transactionDigest(result);
      await client.waitForTransaction({ digest: nextDigest });
      recordSubscriptionDigest({
        owner: account.address,
        quoteHash: prepared.quoteEnvelope.productHash,
        digest: nextDigest,
      });
      setSubscribeConfirmed(true);
      setSuccessDigest(nextDigest);
      return nextDigest;
    });
  }

  return (
    <>
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
        subscribeConfirmed={subscribeConfirmed}
        simulatedCostLabel={simulatedCostLabel}
        locale={locale}
        onCreateManager={handleCreateManager}
        onSubscribe={handleSubscribe}
      />
      <SubscribeSuccessDialog
        quote={quote}
        digest={successDigest}
        locale={locale}
        onClose={() => setSuccessDigest(null)}
      />
    </>
  );
}
