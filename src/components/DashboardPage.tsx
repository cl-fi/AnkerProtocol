'use client';

import { useCurrentAccount, useCurrentClient, useDAppKit } from '@mysten/dapp-kit-react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, ShieldCheck, WalletCards } from 'lucide-react';
import { useState } from 'react';
import type { PredictManagerSummary } from '../deepbook/predictManagers';
import { useAnkerPortfolio } from '../hooks/useAnkerPortfolio';
import { usePredictManagers } from '../hooks/usePredictManagers';
import { usePredictManagerState } from '../hooks/usePredictManagerState';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import { buildClaimDualInvestmentNoteTransaction, DEFAULT_ANKER_CONFIG } from '../sui/ankerTransactions';
import {
  claimStateForDualInvestmentNote,
  type DualInvestmentClaimState,
} from '../sui/predictManagerState';
import { preflightTransaction } from '../sui/transactionPreflight';
import { AppHeader } from './AppHeader';

function formatAmount(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatPrice(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatApr(value: number) {
  return `${(value * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function formatPreciseAmount(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

function formatExpiry(value: number) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function shortId(value: string) {
  return value ? `${value.slice(0, 8)}...${value.slice(-6)}` : '--';
}

export function managerValidationForNote(
  note: AnkerProductNoteRecord,
  managers: Pick<PredictManagerSummary, 'managerId'>[] | undefined,
) {
  if (!managers) return { label: 'Checking manager', tone: 'neutral' as const };
  const verified = managers.some((manager) => manager.managerId === note.managerId);
  return verified
    ? { label: 'Manager verified', tone: 'good' as const }
    : { label: 'Manager not found', tone: 'warn' as const };
}

export function redeemEstimateForNote(note: AnkerProductNoteRecord) {
  const normalizeDusdc = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
  const grossPayout = normalizeDusdc(note.principal + Math.max(0, note.coupon));
  const performanceYield = Math.max(0, grossPayout - note.principal);
  const feeAmount = normalizeDusdc(performanceYield * (note.feeBps / 10_000));
  return {
    grossPayout,
    feeAmount,
    netPayout: normalizeDusdc(grossPayout - feeAmount),
  };
}

export function ClaimActionView({
  note,
  nowMs,
  claimState,
  isPending,
  digest,
  error,
  onClaim,
}: {
  note: AnkerProductNoteRecord;
  nowMs: number;
  claimState: DualInvestmentClaimState;
  isPending: boolean;
  digest?: string | null;
  error?: string | null;
  onClaim: () => void;
}) {
  const isDual = note.productType === 'dual-investment';
  const isExpired = nowMs >= note.expiryMs;
  const estimate = redeemEstimateForNote(note);
  const canClaim =
    isDual &&
    isExpired &&
    note.status === 'open' &&
    (claimState.path === 'redeem-and-withdraw' || claimState.path === 'withdraw-only') &&
    !isPending;
  const status = !isDual
    ? 'Legacy product claim is staged.'
    : note.status === 'redeemed'
      ? 'Product note already claimed.'
      : !isExpired
        ? 'Claim opens after expiry.'
        : claimState.path === 'redeem-and-withdraw'
          ? 'Claim will redeem open Predict legs, then withdraw DUSDC.'
          : claimState.path === 'withdraw-only'
            ? 'Predict legs already redeemed. Claim withdraws DUSDC from PredictManager.'
            : claimState.path === 'partial-unavailable'
              ? 'Predict legs are partially redeemed. Claim is paused until positions reconcile.'
              : 'Checking PredictManager legs before claim.';

  return (
    <div className="redeem-action">
      <div>
        <span>{status}</span>
        {isDual ? <span>BTC delivery route unavailable on testnet.</span> : null}
        <strong>Claim {formatPreciseAmount(estimate.grossPayout)} dUSDC</strong>
        <strong>Fee {formatPreciseAmount(estimate.feeAmount)} dUSDC</strong>
        <strong>Net {formatPreciseAmount(estimate.netPayout)} dUSDC</strong>
      </div>
      <button className="small-action" type="button" disabled={!canClaim} onClick={onClaim}>
        {isPending ? 'Claiming...' : 'Claim DUSDC'}
      </button>
      {digest ? <p className="execution-message">Claim submitted: {shortId(digest)}</p> : null}
      {error ? <p className="execution-error">{error}</p> : null}
    </div>
  );
}

function transactionDigest(result: Awaited<ReturnType<ReturnType<typeof useDAppKit>['signAndExecuteTransaction']>>) {
  if (result.FailedTransaction) {
    throw new Error(result.FailedTransaction.status.error?.message ?? 'Transaction failed.');
  }
  return result.Transaction.digest;
}

function ClaimAction({
  note,
  claimState,
}: {
  note: AnkerProductNoteRecord;
  claimState: DualInvestmentClaimState;
}) {
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [digest, setDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim() {
    if (!account || note.productType !== 'dual-investment') return;
    if (claimState.path !== 'redeem-and-withdraw' && claimState.path !== 'withdraw-only') return;
    setIsPending(true);
    setDigest(null);
    setError(null);
    try {
      const estimate = redeemEstimateForNote(note);
      const plan = buildClaimDualInvestmentNoteTransaction({
        accountAddress: account.address,
        note,
        feeAmount: estimate.feeAmount,
        payoutAmount: estimate.grossPayout,
        redeemLegs: claimState.path === 'redeem-and-withdraw',
      });
      await preflightTransaction({
        client,
        sender: account.address,
        transaction: plan.tx,
      });
      const result = await dAppKit.signAndExecuteTransaction({ transaction: plan.tx });
      const nextDigest = transactionDigest(result);
      setDigest(nextDigest);
      await client.waitForTransaction({ digest: nextDigest });
      await queryClient.invalidateQueries({ queryKey: ['anker-portfolio', account.address] });
      await queryClient.invalidateQueries({ queryKey: ['predict-manager-state', note.managerId] });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Claim transaction failed.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <ClaimActionView
      note={note}
      nowMs={Date.now()}
      claimState={claimState}
      isPending={isPending}
      digest={digest}
      error={error}
      onClaim={handleClaim}
    />
  );
}

function ProductNoteCard({
  note,
  managerValidation,
}: {
  note: AnkerProductNoteRecord;
  managerValidation: ReturnType<typeof managerValidationForNote>;
}) {
  const isDual = note.productType === 'dual-investment';
  const managerStateQuery = usePredictManagerState(note.managerId);
  const claimState = claimStateForDualInvestmentNote(note, managerStateQuery.data);

  return (
    <article className="detail-panel">
      <div className="detail-title">
        <h3>{isDual ? 'Target Buy BTC' : 'Legacy Product'}</h3>
        <span>{note.status === 'redeemed' ? 'Claimed' : 'Open'} product note</span>
      </div>
      <div className="quote-summary compact-summary">
        <div>
          <span>Principal</span>
          <strong>{formatAmount(note.principal)} dUSDC</strong>
        </div>
        <div>
          <span>APR</span>
          <strong>{formatApr(note.apr)}</strong>
        </div>
        <div>
          <span>Expiry</span>
          <strong>{formatExpiry(note.expiryMs)}</strong>
        </div>
        <div>
          <span>Legs</span>
          <strong>{note.legs.length}</strong>
        </div>
      </div>
      <div className="oracle-meta">
        <div>
          <span>Note</span>
          <dd>{shortId(note.noteId)}</dd>
        </div>
        <div>
          <span>Product ID</span>
          <dd>{note.productId || '--'}</dd>
        </div>
        <div>
          <span>Predict Manager</span>
          <dd>{shortId(note.managerId)}</dd>
        </div>
        <div>
          <span>Manager Check</span>
          <dd className={`validation-${managerValidation.tone}`}>{managerValidation.label}</dd>
        </div>
        <div>
          <span>Manager DUSDC</span>
          <dd>
            {managerStateQuery.isPending
              ? 'Checking'
              : managerStateQuery.data?.dusdcBalance !== null && managerStateQuery.data?.dusdcBalance !== undefined
                ? `${formatPreciseAmount(managerStateQuery.data.dusdcBalance)} dUSDC`
                : 'Unavailable'}
          </dd>
        </div>
        <div>
          <span>Oracle</span>
          <dd>{shortId(note.oracleId)}</dd>
        </div>
        {isDual ? (
          <>
            <div>
              <span>Target Buy</span>
              <dd>{formatPrice(note.targetPrice)}</dd>
            </div>
            <div>
              <span>Floor</span>
              <dd>{formatPrice(note.floorPrice)}</dd>
            </div>
            <div>
              <span>Coupon</span>
              <dd>{formatAmount(note.coupon)} dUSDC</dd>
            </div>
            <div>
              <span>Settlement</span>
              <dd>Cash-settled dUSDC</dd>
            </div>
            <div>
              <span>Predict legs</span>
              <dd>
                {claimState.path === 'unknown'
                  ? 'Checking'
                  : `${claimState.availableLegCount}/${claimState.totalLegCount} held`}
              </dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <span>Range</span>
              <dd>
                {formatPrice(note.lowerBound)} - {formatPrice(note.upperBound)}
              </dd>
            </div>
            <div>
              <span>Direction</span>
              <dd>{note.isBullish ? 'Bullish' : 'Bearish'}</dd>
            </div>
            <div>
              <span>Current leg</span>
              <dd>{note.usesMockCurrentDeposit ? 'Mock dUSDC deposit' : 'Live deposit'}</dd>
            </div>
          </>
        )}
      </div>
      <ClaimAction note={note} claimState={claimState} />
    </article>
  );
}

export function DashboardPage() {
  const account = useCurrentAccount();
  const portfolioQuery = useAnkerPortfolio();
  const managersQuery = usePredictManagers();
  const contractConfigured = DEFAULT_ANKER_CONFIG.packageId !== '0x0' && DEFAULT_ANKER_CONFIG.packageId.length > 0;

  return (
    <main className="dual-page" id="wallet-dashboard">
      <AppHeader activeProduct="dashboard" />

      <section className="dual-hero calculation-hero">
        <div>
          <span className="section-kicker">Wallet Position Layer</span>
          <h1>Wallet Dashboard</h1>
          <p>
            Track Anker product notes, linked Predict managers, product status, and the DUSDC claim path from one
            wallet view.
          </p>
        </div>
        <button className="primary-action" type="button" onClick={() => void portfolioQuery.refetch()} disabled={!account}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </section>

      <div className="transparency-note calculation-note">
        <WalletCards size={18} />
        <span>Product notes are owned objects created by the Anker Protocol contract.</span>
        <ShieldCheck size={18} />
      </div>

      {!account ? (
        <section className="calculation-section">
          <div className="detail-panel empty-preview">Connect your wallet to view Anker product notes.</div>
        </section>
      ) : !contractConfigured ? (
        <section className="calculation-section">
          <div className="detail-panel error-panel">
            Anker contract package is not configured. Set NEXT_PUBLIC_ANKER_PACKAGE_ID after publishing the Move package.
          </div>
        </section>
      ) : portfolioQuery.isPending ? (
        <section className="calculation-section">
          <div className="detail-panel empty-preview">Loading product notes from your wallet...</div>
        </section>
      ) : portfolioQuery.error ? (
        <section className="calculation-section">
          <div className="detail-panel error-panel">
            {portfolioQuery.error instanceof Error ? portfolioQuery.error.message : 'Unable to load product notes.'}
          </div>
        </section>
      ) : (portfolioQuery.data ?? []).length === 0 ? (
        <section className="calculation-section">
          <div className="detail-panel empty-preview">
            No Anker product notes found for {shortId(account.address)}.
          </div>
        </section>
      ) : (
        <section className="calculation-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Owned Product Notes</span>
              <h2>Open and Claimed Positions</h2>
            </div>
            <span className="quote-badge live">{portfolioQuery.data?.length ?? 0} Notes</span>
          </div>
          <div className="detail-grid">
            {(portfolioQuery.data ?? []).map((note) => (
              <ProductNoteCard
                note={note}
                managerValidation={managerValidationForNote(note, managersQuery.data)}
                key={note.noteId}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
