'use client';

import { useCurrentAccount, useCurrentClient, useDAppKit } from '@mysten/dapp-kit-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { settlementEstimateForNote, settlementForProductNote } from '../application/settleProductNote';
import { isDemoMode } from '../config/runtimeModes';
import type { PredictMarketState } from '../deepbook/predictMarketState';
import { copyForLocale, DEFAULT_LOCALE, type Locale } from '../i18n';
import type { SettlementResult } from '../products/settlement';
import { markProductNoteClaimed, type AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import { buildClaimDualInvestmentNoteTransaction } from '../sui/ankerTransactions';
import { lifecycleForProductNote } from '../sui/productNoteLifecycle';
import { preflightTransaction } from '../sui/transactionPreflight';
import { formatBtcAmount, formatPreciseAmount, shortId, suiExplorerTxUrl } from './PortfolioFormat';
import { Button } from '../ui';
import { ClaimSuccessDialog, type ClaimSuccessSummary } from './ClaimSuccessDialog';

export function claimActionViewModel({
  note,
  nowMs,
  marketState,
  isPending,
  locale = DEFAULT_LOCALE,
}: {
  note: AnkerProductNoteRecord;
  nowMs: number;
  marketState?: PredictMarketState;
  isPending: boolean;
  locale?: Locale;
}) {
  const copy = copyForLocale(locale);
  const lifecycle = lifecycleForProductNote(note, marketState, nowMs);
  return {
    lifecycle,
    canClaim: lifecycle === 'claimable' && !isPending,
    actionLabel: copy.portfolio.claim.claimPayout,
    status:
      lifecycle === 'claimed'
        ? copy.portfolio.claim.alreadyClaimed
        : lifecycle === 'awaiting_settle'
          ? copy.portfolio.claim.awaitingSettlement
          : lifecycle === 'claimable'
            ? copy.portfolio.claim.readyClaim
            : copy.portfolio.claim.opensAfterSettlement,
  };
}

function settlementEstimateFromResult(settlement: SettlementResult) {
  return {
    grossPayout: Number(settlement.grossPayoutBaseUnits) / 1_000_000,
    feeAmount: Number(settlement.performanceFeeBaseUnits) / 1_000_000,
    netPayout: Number(settlement.netPayoutBaseUnits) / 1_000_000,
  };
}

export function claimEstimateForNote(note: AnkerProductNoteRecord) {
  return settlementEstimateFromResult(settlementEstimateForNote(note));
}

function settlementResultForView(note: AnkerProductNoteRecord, marketState?: PredictMarketState): SettlementResult {
  if (note.status === 'redeemed') {
    return {
      grossPayoutBaseUnits: note.redeemedPayoutBaseUnits,
      performanceFeeBaseUnits: note.redeemedFeeBaseUnits,
      netPayoutBaseUnits: note.redeemedPayoutBaseUnits - note.redeemedFeeBaseUnits,
      realizedLegs: [],
    };
  }
  if (marketState?.settlementPrice !== null && marketState?.settlementPrice !== undefined) {
    return settlementForProductNote(note, marketState.settlementPrice);
  }
  return settlementEstimateForNote(note);
}

export function ClaimActionView({
  note,
  nowMs,
  marketState,
  isPending,
  digest,
  error,
  demoMode = false,
  locale = DEFAULT_LOCALE,
  onClaim,
}: {
  note: AnkerProductNoteRecord;
  nowMs: number;
  marketState?: PredictMarketState;
  isPending: boolean;
  digest?: string | null;
  error?: string | null;
  demoMode?: boolean;
  locale?: Locale;
  onClaim: () => void;
}) {
  const copy = copyForLocale(locale);
  const action = claimActionViewModel({ note, nowMs, marketState, isPending, locale });
  const canClaim = action.canClaim && !demoMode;
  const settlement = settlementResultForView(note, marketState);
  const estimate = settlementEstimateFromResult(settlement);
  const claimed = action.lifecycle === 'claimed';
  const outcomeKnown = claimed || action.lifecycle === 'claimable';
  // Until settlement fixes the direction, show both sides of the product:
  // full dUSDC if BTC holds above target, or that value in BTC at the target if it converts.
  const projectedDusdc = note.principal + note.coupon - estimate.feeAmount;
  const settledBelow = outcomeKnown && estimate.netPayout < note.principal;
  const mode = settledBelow ? 'btc' : outcomeKnown ? 'dusdc' : 'projected';
  const dusdcAmount = outcomeKnown ? estimate.netPayout : projectedDusdc;
  const amountLabel = claimed
    ? copy.portfolio.claim.youReceived
    : canClaim
      ? copy.portfolio.claim.youllReceive
      : copy.portfolio.claim.projectedPayout;
  const feeText = copy.portfolio.claim.fee(formatPreciseAmount(estimate.feeAmount, locale));
  const btcAmount = note.targetPrice > 0 ? dusdcAmount / note.targetPrice : 0;
  const statusText = demoMode && action.canClaim ? copy.demo.claimDisabled : action.status;
  const showStatus = action.lifecycle === 'awaiting_settle' || (demoMode && action.canClaim);

  return (
    <div className="di-claim">
      <div className="di-claim-info">
        {showStatus ? <span className="di-claim-status">{statusText}</span> : null}
        <span className="di-claim-label">{amountLabel}</span>
        {mode === 'btc' ? (
          <>
            <strong className="di-claim-amount">~{formatBtcAmount(btcAmount, locale)} BTC</strong>
            <small className="di-claim-fee">
              {copy.portfolio.claim.onTestnetAfterFee(formatPreciseAmount(estimate.netPayout, locale), feeText)}
            </small>
          </>
        ) : mode === 'projected' ? (
          <>
            <strong className="di-claim-amount">~{formatPreciseAmount(dusdcAmount, locale)} dUSDC</strong>
            <small className="di-claim-fee">
              {copy.portfolio.claim.orBtcAfterFee(formatBtcAmount(btcAmount, locale), feeText)}
            </small>
          </>
        ) : (
          <>
            <strong className="di-claim-amount">{formatPreciseAmount(dusdcAmount, locale)} dUSDC</strong>
            <small className="di-claim-fee">{copy.portfolio.claim.afterFee(feeText)}</small>
          </>
        )}
      </div>
      <Button variant="primary" className="di-claim-button" disabled={!canClaim} onClick={onClaim}>
        {isPending ? copy.portfolio.claim.submitting : action.actionLabel}
      </Button>
      {digest ? (
        <p className="execution-message">
          {copy.portfolio.claim.submitted} —{' '}
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
  marketState,
  locale = DEFAULT_LOCALE,
}: {
  note: AnkerProductNoteRecord;
  marketState?: PredictMarketState;
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
  const [success, setSuccess] = useState<ClaimSuccessSummary | null>(null);

  async function handleClaim() {
    if (isDemoMode() || !account || note.productType !== 'dual-investment') return;
    const lifecycle = lifecycleForProductNote(note, marketState, Date.now());
    if (lifecycle !== 'claimable' || marketState?.settlementPrice == null) return;

    setIsPending(true);
    setDigest(null);
    setError(null);
    setSuccess(null);
    try {
      const settlement = settlementForProductNote(note, marketState.settlementPrice);
      const plan = buildClaimDualInvestmentNoteTransaction({
        accountAddress: account.address,
        note,
        settlement,
      });
      await preflightTransaction({ client, sender: account.address, transaction: plan.tx });
      const result = await dAppKit.signAndExecuteTransaction({ transaction: plan.tx });
      const nextDigest = transactionDigest(result);
      setDigest(nextDigest);
      setSuccess({
        digest: nextDigest,
        ...settlementEstimateFromResult(settlement),
        settlementPrice: marketState.settlementPrice,
      });

      queryClient.setQueriesData<AnkerProductNoteRecord[]>(
        { queryKey: ['anker-portfolio', account.address] },
        (notes) => (notes ? markProductNoteClaimed(notes, note.noteId, settlement) : notes),
      );

      await client.waitForTransaction({ digest: nextDigest });
      await queryClient.invalidateQueries({ queryKey: ['anker-portfolio', account.address] });
    } catch (nextError) {
      // Wallets can reject after broadcasting (parse failures, timeouts), so the
      // chain is the only authority on whether the claim landed — resync from it.
      await queryClient
        .invalidateQueries({ queryKey: ['anker-portfolio', account.address] })
        .catch(() => undefined);
      setError(nextError instanceof Error ? nextError.message : copy.portfolio.claim.transactionFailed);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <ClaimActionView
        note={note}
        nowMs={Date.now()}
        marketState={marketState}
        isPending={isPending}
        digest={digest}
        error={error}
        demoMode={isDemoMode()}
        locale={locale}
        onClaim={handleClaim}
      />
      <ClaimSuccessDialog note={note} success={success} locale={locale} onClose={() => setSuccess(null)} />
    </>
  );
}
