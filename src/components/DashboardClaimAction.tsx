'use client';

import { useCurrentAccount, useCurrentClient, useDAppKit } from '@mysten/dapp-kit-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  buildDualInvestmentClaimApplicationPlan,
  settlementEstimateForNote,
  settlementFromManagerBalance,
} from '../application/settleProductNote';
import { formatTimeToExpiry } from '../products/timeFormat';
import type { SettlementResult } from '../products/settlement';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import { lifecycleForProductNote, type DualInvestmentClaimState } from '../sui/predictManagerState';
import { preflightTransaction } from '../sui/transactionPreflight';
import { formatPreciseAmount, formatPrice, shortId, suiExplorerTxUrl } from './DashboardFormat';

function partialUnavailableStatus(claimState: DualInvestmentClaimState) {
  if (claimState.missingLegs.length === 0) {
    return 'Settling — positions are still reconciling. Claim opens shortly.';
  }
  const strikes = claimState.missingLegs.map((leg) => formatPrice(leg.strike)).join(', ');
  return `Settling — positions at ${strikes} are still reconciling. Claim opens shortly.`;
}

export function claimActionViewModel({
  note,
  nowMs,
  claimState,
  isPending,
}: {
  note: AnkerProductNoteRecord;
  nowMs: number;
  claimState: DualInvestmentClaimState;
  isPending: boolean;
}) {
  const isDual = note.productType === 'dual-investment';
  const isExpired = nowMs >= note.expiryMs;
  const lifecycle = lifecycleForProductNote(note, claimState, nowMs);
  const canClaim =
    isDual &&
    note.status === 'open' &&
    (lifecycle === 'positions-redeemable' || lifecycle === 'claimable') &&
    !isPending;
  const actionLabel = claimState.path === 'redeem-and-withdraw' ? 'Redeem positions' : 'Claim cash';
  const status = !isDual
    ? 'Legacy product claim is staged.'
    : note.status === 'redeemed'
      ? 'Already claimed.'
      : !isExpired
        ? 'Opens after settlement — nothing to do yet.'
        : lifecycle === 'positions-redeemable'
          ? 'Ready to settle — redeem your positions, then claim your cash.'
          : lifecycle === 'claimable'
            ? 'Ready — claim your cash from this position.'
            : lifecycle === 'settlement-blocked'
              ? partialUnavailableStatus(claimState)
              : 'Checking this position…';

  return {
    lifecycle,
    canClaim,
    actionLabel,
    status,
    showMaturityCountdown: isDual && !isExpired,
  };
}

function settlementEstimateFromResult(settlement: SettlementResult) {
  return {
    grossPayout: Number(settlement.grossPayoutBaseUnits) / 1_000_000,
    feeAmount: Number(settlement.performanceFeeBaseUnits) / 1_000_000,
    netPayout: Number(settlement.netPayoutBaseUnits) / 1_000_000,
  };
}

export function redeemEstimateForNote(note: AnkerProductNoteRecord) {
  return settlementEstimateFromResult(settlementEstimateForNote(note));
}

function redeemEstimateForClaimState(note: AnkerProductNoteRecord, claimState: DualInvestmentClaimState) {
  if (note.status === 'redeemed') {
    return {
      grossPayout: Number(note.redeemedPayoutBaseUnits) / 1_000_000,
      feeAmount: Number(note.redeemedFeeBaseUnits) / 1_000_000,
      netPayout: Number(note.redeemedPayoutBaseUnits - note.redeemedFeeBaseUnits) / 1_000_000,
    };
  }
  if (claimState.path === 'withdraw-only' && claimState.managerDusdcBalance !== null) {
    return settlementEstimateFromResult(settlementFromManagerBalance(note, claimState.managerDusdcBalance));
  }
  return redeemEstimateForNote(note);
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
  const action = claimActionViewModel({ note, nowMs, claimState, isPending });
  const estimate = redeemEstimateForClaimState(note, claimState);
  const claimed = note.status === 'redeemed';
  const amountLabel = claimed ? 'You received' : action.canClaim ? "You'll receive" : 'Projected payout';

  return (
    <div className="di-claim">
      <div className="di-claim-info">
        <span className="di-claim-status">{action.status}</span>
        {action.showMaturityCountdown ? (
          <span className="di-claim-sub">Settles in {formatTimeToExpiry(note.expiryMs, nowMs)}</span>
        ) : null}
        <strong className="di-claim-amount">
          {amountLabel} {claimed ? '' : '~'}
          {formatPreciseAmount(estimate.netPayout)} dUSDC
        </strong>
        <small className="di-claim-fee">
          after {formatPreciseAmount(estimate.feeAmount)} dUSDC fee · cash-settled in dUSDC on testnet
        </small>
      </div>
      <button className="primary-action di-claim-button" type="button" disabled={!action.canClaim} onClick={onClaim}>
        {isPending ? 'Submitting…' : action.actionLabel}
      </button>
      {digest ? (
        <p className="execution-message">
          Submitted —{' '}
          <a className="di-proof-link" href={suiExplorerTxUrl(digest)} target="_blank" rel="noreferrer">
            {shortId(digest)}
          </a>
        </p>
      ) : null}
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

export function ClaimAction({
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
      const plan = buildDualInvestmentClaimApplicationPlan({
        accountAddress: account.address,
        note,
        claimState,
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
