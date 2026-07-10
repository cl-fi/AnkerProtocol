'use client';

import { useCurrentAccount, useCurrentClient, useDAppKit } from '@mysten/dapp-kit-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  buildDualInvestmentClaimApplicationPlan,
  settlementEstimateForNote,
  settlementFromManagerBalance,
} from '../application/settleProductNote';
import { isDemoMode } from '../config/runtimeModes';
import { copyForLocale, DEFAULT_LOCALE, type Locale } from '../i18n';
import type { SettlementResult } from '../products/settlement';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import { lifecycleForProductNote, type DualInvestmentClaimState } from '../sui/predictManagerState';
import { preflightTransaction } from '../sui/transactionPreflight';
import { formatBtcAmount, formatPreciseAmount, formatPrice, shortId, suiExplorerTxUrl } from './DashboardFormat';
import { Button } from '../ui';

function partialUnavailableStatus(claimState: DualInvestmentClaimState, locale: Locale) {
  const copy = copyForLocale(locale);
  if (claimState.missingLegs.length === 0) {
    return copy.dashboard.claim.settlingNoMissing;
  }
  const strikes = claimState.missingLegs.map((leg) => formatPrice(leg.strike, locale)).join(', ');
  return copy.dashboard.claim.settlingMissing(strikes);
}

export function claimActionViewModel({
  note,
  nowMs,
  claimState,
  isPending,
  locale = DEFAULT_LOCALE,
}: {
  note: AnkerProductNoteRecord;
  nowMs: number;
  claimState: DualInvestmentClaimState;
  isPending: boolean;
  locale?: Locale;
}) {
  const copy = copyForLocale(locale);
  const isDual = note.productType === 'dual-investment';
  const isExpired = nowMs >= note.expiryMs;
  const lifecycle = lifecycleForProductNote(note, claimState, nowMs);
  const canClaim =
    isDual &&
    note.status === 'open' &&
    (lifecycle === 'positions-redeemable' || lifecycle === 'claimable') &&
    !isPending;
  const actionLabel =
    claimState.path === 'redeem-and-withdraw' ? copy.dashboard.claim.redeemPositions : copy.dashboard.claim.claimCash;
  const status = !isDual
    ? copy.dashboard.claim.legacyStaged
    : note.status === 'redeemed'
      ? copy.dashboard.claim.alreadyClaimed
      : !isExpired
        ? copy.dashboard.claim.opensAfterSettlement
        : lifecycle === 'positions-redeemable'
          ? copy.dashboard.claim.readyToSettle
          : lifecycle === 'claimable'
            ? copy.dashboard.claim.readyClaim
            : lifecycle === 'settlement-blocked'
              ? partialUnavailableStatus(claimState, locale)
              : copy.dashboard.claim.checkingPosition;

  return {
    lifecycle,
    canClaim,
    actionLabel,
    status,
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
  demoMode = false,
  locale = DEFAULT_LOCALE,
  onClaim,
}: {
  note: AnkerProductNoteRecord;
  nowMs: number;
  claimState: DualInvestmentClaimState;
  isPending: boolean;
  digest?: string | null;
  error?: string | null;
  demoMode?: boolean;
  locale?: Locale;
  onClaim: () => void;
}) {
  const copy = copyForLocale(locale);
  const action = claimActionViewModel({ note, nowMs, claimState, isPending, locale });
  const canClaim = action.canClaim && !demoMode;
  const demoBlocked = demoMode && action.canClaim;
  const estimate = redeemEstimateForClaimState(note, claimState);
  const claimed = note.status === 'redeemed';
  const amountLabel = claimed
    ? copy.dashboard.claim.youReceived
    : canClaim
      ? copy.dashboard.claim.youllReceive
      : copy.dashboard.claim.projectedPayout;

  // The real settlement direction is only known once the legs are redeemed (withdraw-only)
  // or the note is claimed. Until then, the outcome is "projected" and we show both sides.
  const outcomeKnown = claimed || claimState.path === 'withdraw-only';
  const settledBelow = outcomeKnown && estimate.netPayout < note.principal;
  const mode = settledBelow ? 'btc' : outcomeKnown ? 'dusdc' : 'projected';
  // BTC stayed at/above your price → full dUSDC (deposit + reward, minus the coupon fee).
  const projectedDusdc = note.principal + note.coupon - estimate.feeAmount;
  const dusdcAmount = outcomeKnown ? estimate.netPayout : projectedDusdc;
  // BTC ended below your price → the fee-adjusted deposit plus reward buys BTC at your target price.
  const btcAmount = note.targetPrice > 0 ? projectedDusdc / note.targetPrice : 0;
  const feeText = copy.dashboard.claim.fee(formatPreciseAmount(estimate.feeAmount, locale));

  // The status line only adds value once a position needs an action the buttons don't already
  // spell out — hide it for Active, Completed, and the one-click "Ready to claim" (claimable) case.
  // In demo mode a blocked claim needs the explanation the disabled button can't give.
  const showStatus = demoBlocked || (!claimed && nowMs >= note.expiryMs && action.lifecycle !== 'claimable');
  const statusText = demoBlocked ? copy.demo.claimDisabled : action.status;

  return (
    <div className="di-claim">
      <div className="di-claim-info">
        {showStatus ? <span className="di-claim-status">{statusText}</span> : null}
        <span className="di-claim-label">{amountLabel}</span>
        {mode === 'btc' ? (
          <>
            <strong className="di-claim-amount">~{formatBtcAmount(btcAmount, locale)} BTC</strong>
            <small className="di-claim-fee">
              {copy.dashboard.claim.onTestnetAfterFee(formatPreciseAmount(dusdcAmount, locale), feeText)}
            </small>
          </>
        ) : mode === 'projected' ? (
          <>
            <strong className="di-claim-amount">~{formatPreciseAmount(dusdcAmount, locale)} dUSDC</strong>
            <small className="di-claim-fee">
              {copy.dashboard.claim.orBtcAfterFee(formatBtcAmount(btcAmount, locale), feeText)}
            </small>
          </>
        ) : (
          <>
            <strong className="di-claim-amount">
              {claimed ? '' : '~'}
              {formatPreciseAmount(dusdcAmount, locale)} dUSDC
            </strong>
            <small className="di-claim-fee">{copy.dashboard.claim.afterFee(feeText)}</small>
          </>
        )}
      </div>
      <Button variant="primary" className="di-claim-button" disabled={!canClaim} onClick={onClaim}>
        {isPending ? copy.dashboard.claim.submitting : action.actionLabel}
      </Button>
      {digest ? (
        <p className="execution-message">
          {copy.dashboard.claim.submitted} —{' '}
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
  locale = DEFAULT_LOCALE,
}: {
  note: AnkerProductNoteRecord;
  claimState: DualInvestmentClaimState;
  locale?: Locale;
}) {
  const copy = copyForLocale(locale);
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [digest, setDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim() {
    if (isDemoMode() || !account || note.productType !== 'dual-investment') return;
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
      await queryClient.invalidateQueries({ queryKey: ['predict-manager-state', note.wrapperId] });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : copy.dashboard.claim.transactionFailed);
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
      demoMode={isDemoMode()}
      locale={locale}
      onClaim={handleClaim}
    />
  );
}
