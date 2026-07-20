'use client';

import { useState } from 'react';
import { copyForLocale, DEFAULT_LOCALE, formattersForLocale, type Locale } from '../i18n';
import { scanQuoteDisplayMetrics } from '../products/dualInvestmentScan';
import { netCouponAfterFee } from '../products/feePolicy';
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

  // Same headline stat as the return overview: APR for day tenors, bps below.
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

  return (
    <>
      <div className="di-commit-dock">
        <div className="di-commit-quote">
          <div>
            <strong>{yieldValue}</strong>
            <small>{yieldLabel}</small>
          </div>
          <div>
            <strong>≈{format.fixedTokenAmount(settleTotal, 2)}</strong>
            <small>{copy.dualInvestment.youWillReceive} · dUSDC</small>
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
