'use client';

import { useState } from 'react';
import { copyForLocale, DEFAULT_LOCALE, formattersForLocale, type Locale } from '../i18n';
import { scanQuoteDisplayMetrics } from '../products/dualInvestmentScan';
import { netCouponAfterFee } from '../products/feePolicy';
import { riskMetricsForDualInvestmentQuote } from '../products/riskMetrics';
import type { DualInvestmentInput, StructuredProductQuote } from '../products/types';
import { DualInvestmentConfirm, ReturnOverview } from './DualInvestmentQuoteDetail';
import type { ConfirmedSubscription } from './TargetBuyExecutionPanel';
import { Dialog } from '../ui';

/**
 * Phone two-level commit. Level 1 is a slim always-floating summary dock
 * (headline yield + settle amount + Subscribe) above the product tab bar;
 * level 2 is a confirm bottom sheet holding the payoff overview and the
 * wallet execution panel. Desktop never mounts this — it keeps the inline
 * confirm section, so the execution panel exists exactly once at a time.
 */
export function DualInvestmentMobileCommit({
  quote,
  productInput,
  subscribeQuote,
  isVerifying,
  insufficientFunds = false,
  onSubscribeSuccess,
  error,
  demoMode = false,
  subscribeDisabledMessage,
  disabledAction,
  estimated = false,
  locale = DEFAULT_LOCALE,
}: {
  quote: StructuredProductQuote;
  productInput: DualInvestmentInput;
  subscribeQuote: StructuredProductQuote | null;
  isVerifying: boolean;
  insufficientFunds?: boolean;
  onSubscribeSuccess: (confirmation: ConfirmedSubscription) => void;
  error?: string | null;
  demoMode?: boolean;
  subscribeDisabledMessage?: string;
  /** Non-tradable rows (Snapshot): disabled button whose label is the state. */
  disabledAction?: { label: string; note: string };
  estimated?: boolean;
  locale?: Locale;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const copy = copyForLocale(locale);
  const format = formattersForLocale(locale);

  // APR headlines the dock — the rate is the number users can actually judge
  // an offer by (a small reward on a small principal reads as nothing; the
  // annualized rate carries the "is this good" signal) and it confirms the
  // rung they picked from the APR chips above. The settle amount rides along
  // as the small line. Same stat rules as everywhere: APR for day tenors,
  // per-period bps for sub-day.
  const metrics = scanQuoteDisplayMetrics({ quote });
  const yieldValue = metrics.showApr
    ? metrics.apr !== null
      ? format.referenceApr(metrics.apr)
      : '--'
    : metrics.periodReturn !== null
      ? format.periodReturnBps(metrics.periodReturn)
      : '--';
  const yieldLabel = metrics.showApr ? copy.dualInvestment.netAprStatLabel : copy.dualInvestment.periodReturn;
  // Above-scenario cash total, rounded to display cents the same way the
  // receipt rounds, so the dock never disagrees with the sheet by a cent.
  const cents = (value: number) => Math.round(value * 100);
  const settleTotal = cents(quote.principal) / 100 + cents(netCouponAfterFee(quote.coupon)) / 100;
  const risk = riskMetricsForDualInvestmentQuote(quote);

  return (
    <>
      <div className="di-commit-dock">
        <div className="di-commit-quote">
          <div>
            <strong className="di-commit-apr">
              {yieldValue}
              <span>{yieldLabel}</span>
            </strong>
            <small>
              {copy.dualInvestment.youWillReceive} ≈{format.fixedTokenAmount(settleTotal, 2)} dUSDC
            </small>
          </div>
        </div>
        <button className="di-commit-cta" type="button" onClick={() => setSheetOpen(true)}>
          {copy.dualInvestment.mobileSubscribe}
        </button>
      </div>

      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        ariaLabel={copy.dualInvestment.confirmLabel}
        closeLabel={copy.common.close}
        className="di-commit-sheet"
      >
        <ReturnOverview quote={quote} productInput={productInput} estimated={estimated} locale={locale} />
        {/* The worst case sits right above the Subscribe button — the one risk
            figure a user must see before committing. */}
        <p className="di-sheet-maxloss">
          <span>{copy.dualInvestment.risk.maximumLoss}</span>
          <strong>{format.cashAmount(risk.maximumLoss)} dUSDC</strong>
        </p>
        <DualInvestmentConfirm
          quote={quote}
          productInput={productInput}
          subscribeQuote={subscribeQuote}
          isVerifying={isVerifying}
          insufficientFunds={insufficientFunds}
          onSubscribeSuccess={(confirmation) => {
            // Hand the stage to the page-level success dialog.
            setSheetOpen(false);
            onSubscribeSuccess(confirmation);
          }}
          error={error}
          demoMode={demoMode}
          subscribeDisabledMessage={subscribeDisabledMessage}
          disabledAction={disabledAction}
          locale={locale}
        />
      </Dialog>
    </>
  );
}
