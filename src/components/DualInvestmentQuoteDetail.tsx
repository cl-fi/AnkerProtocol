'use client';

import { ChevronDown, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { copyForLocale, DEFAULT_LOCALE, formattersForLocale, type Locale } from '../i18n';
import { isSubDayTenor } from '../products/dualInvestmentScan';
import { netAprAfterCouponFee } from '../products/feePolicy';
import { riskMetricsForDualInvestmentQuote } from '../products/riskMetrics';
import type { DualInvestmentInput, StructuredProductQuote } from '../products/types';
import { TargetBuyExecutionPanel, type ConfirmedSubscription } from './TargetBuyExecutionPanel';
import { Badge, Button, Card } from '../ui';

/**
 * Stable product identity — used to decide when sticky subscribe state may drop.
 * Must include the market (oracleId), matching the page's productKey: without it,
 * switching oracles with coincidentally identical inputs would keep the previous
 * market's quote subscribable through the re-verify gap.
 */
function productIdentity(oracleId: string, input: DualInvestmentInput) {
  return [oracleId, input.principal, input.targetPrice, input.floorPrice, input.targetLegCount].join(':');
}

function oldestQuoteTimestamp(quote: StructuredProductQuote) {
  return quote.legs.reduce(
    (oldest, leg) => Math.min(oldest, leg.quoteTimestampMs),
    quote.legs[0]?.quoteTimestampMs ?? Date.now(),
  );
}

export function QuoteRiskSummary({
  quote,
  locale = DEFAULT_LOCALE,
}: {
  quote: StructuredProductQuote;
  locale?: Locale;
}) {
  const risk = riskMetricsForDualInvestmentQuote(quote);
  const copy = copyForLocale(locale);
  const format = formattersForLocale(locale);
  return (
    <div className="quote-summary compact-summary">
      <div>
        <span>{copy.dualInvestment.risk.minimumPayout}</span>
        <strong>{format.amount(risk.minimumPayout)} dUSDC</strong>
      </div>
      <div>
        <span>{copy.dualInvestment.risk.maximumLoss}</span>
        <strong>{format.amount(risk.maximumLoss)} dUSDC</strong>
      </div>
      <div>
        <span>{copy.dualInvestment.risk.optionBudget}</span>
        <strong>{format.amount(risk.optionBudget)} dUSDC</strong>
      </div>
      <div>
        <span>{copy.dualInvestment.risk.holdReturn}</span>
        <strong>
          {isSubDayTenor(quote.oracle.expiryMs)
            ? format.periodReturnBps(risk.holdingPeriodReturn)
            : format.percent(risk.holdingPeriodReturn)}
        </strong>
      </div>
      <div>
        <span>{copy.dualInvestment.risk.quoteValidity}</span>
        <strong>{risk.quoteTtlSeconds}s</strong>
      </div>
      <div>
        <span>{copy.dualInvestment.risk.slippageLimit}</span>
        <strong>
          {format.percent(risk.maxCostSlippage)} {copy.dualInvestment.risk.maxCost}
        </strong>
      </div>
      <div>
        <span>{copy.dualInvestment.risk.liquidity}</span>
        <strong>
          {risk.liquidityStatus === 'verified'
            ? copy.dualInvestment.risk.verified
            : copy.dualInvestment.risk.unavailable}
        </strong>
      </div>
    </div>
  );
}

export function ReturnOverview({
  quote,
  productInput,
  estimated = false,
  locale = DEFAULT_LOCALE,
}: {
  quote: StructuredProductQuote;
  productInput: DualInvestmentInput;
  estimated?: boolean;
  locale?: Locale;
}) {
  const [scenario, setScenario] = useState<'above' | 'below'>('above');
  const copy = copyForLocale(locale);
  const format = formattersForLocale(locale);
  const targetPrice = quote.targetPrice ?? productInput.targetPrice;
  const total = quote.principal + quote.coupon;
  const netApr = netAprAfterCouponFee(quote.apr);
  const periodReturn = quote.principal > 0 ? quote.coupon / quote.principal : 0;
  const subDay = isSubDayTenor(quote.oracle.expiryMs);
  const rewardMeta = subDay ? format.periodReturnBps(periodReturn) : `${format.apr(netApr)} APR`;
  const btcEquivalent = targetPrice > 0 ? total / targetPrice : 0;
  const isAbove = scenario === 'above';
  const receiveAmount = isAbove ? format.fixedTokenAmount(total, 2) : format.fixedTokenAmount(btcEquivalent, 8);
  const receiveAsset = isAbove ? copy.dualInvestment.receiveAssetDusdc : copy.dualInvestment.receiveAssetBtcEquivalent;
  const settleNote = isAbove ? null : copy.dualInvestment.cashSettledTip;
  const equivNoteProps = settleNote
    ? { className: 'di-equiv-note', 'data-tip': settleNote, tabIndex: 0, 'aria-label': `${receiveAsset}. ${settleNote}` }
    : {};
  const chartClassName = isAbove ? 'return-chart-visual above' : 'return-chart-visual below';
  const pricePathD = isAbove
    ? 'M 70 48 C 95 132 138 50 178 88 C 228 134 248 14 302 74 C 350 130 332 248 416 238 C 484 230 442 138 504 152 C 558 164 586 72 642 48'
    : 'M 70 48 C 95 132 138 50 178 88 C 228 134 248 14 302 74 C 350 130 332 248 416 238 C 484 230 442 98 504 110 C 558 122 514 236 642 230';

  return (
    <Card as="article" className="return-overview-panel">
      <div className="return-overview-heading">
        <div>
          <h3>{copy.dualInvestment.returnOverview}</h3>
          <p>{copy.dualInvestment.returnOverviewBody}</p>
        </div>
        <Badge tone={estimated ? 'warning' : 'positive'}>
          {estimated ? copy.dualInvestment.estimate : copy.dualInvestment.liveQuote}
        </Badge>
      </div>

      <div className="return-scenario-tabs" aria-label={copy.dualInvestment.scenarioLabel}>
        <button className={isAbove ? 'active' : ''} type="button" onClick={() => setScenario('above')}>
          {copy.dualInvestment.above} {format.usd(targetPrice)}
        </button>
        <button className={!isAbove ? 'active' : ''} type="button" onClick={() => setScenario('below')}>
          {copy.dualInvestment.atOrBelow} {format.usd(targetPrice)}
        </button>
      </div>

      <div className={chartClassName}>
        <svg viewBox="0 0 720 320" role="img" aria-label={copy.dualInvestment.chartLabel}>
          <defs>
            <linearGradient id="returnPathFade" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" style={{ stopColor: 'var(--navy)' }} stopOpacity="0.95" />
              <stop offset="58%" style={{ stopColor: 'var(--slate)' }} stopOpacity="0.75" />
              <stop offset="100%" style={{ stopColor: 'var(--navy)' }} stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id="returnAreaFade" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--gold)' }} stopOpacity="0.3" />
              <stop offset="100%" style={{ stopColor: 'var(--gold)' }} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <line className="return-grid-line horizontal" x1="46" x2="674" y1="138" y2="138" />
          <line className="return-grid-line" x1="178" x2="178" y1="18" y2="286" />
          <line className="return-grid-line" x1="546" x2="546" y1="18" y2="286" />
          <path className="return-area-path" d={`${pricePathD} L 642 320 L 70 320 Z`} />
          <path className="return-price-path" d={pricePathD} />
          <circle className="return-current-dot" cx="178" cy="88" r="8" />
          <path className="return-arrow" d={isAbove ? 'M 642 48 l -16 -10 l 4 20 z' : 'M 642 230 l -18 -8 l 7 18 z'} />
        </svg>

        <div className="return-target-label">
          <span>{copy.dualInvestment.targetPrice}</span>
          <strong>{format.usd(targetPrice)}</strong>
        </div>
        <div className="return-current-label">
          <span>{copy.dualInvestment.currentPrice}</span>
          <strong>{format.usd(quote.oracle.spot)}</strong>
        </div>
        <div className="return-date-label start">
          <span>{copy.dualInvestment.start}</span>
          <strong>{format.chartDate(oldestQuoteTimestamp(quote))}</strong>
        </div>
        <div className="return-date-label settle">
          <span>{copy.dualInvestment.settle}</span>
          <strong>{format.chartDate(quote.oracle.expiryMs)}</strong>
        </div>
        <div className="return-receive-card">
          <span>{copy.dualInvestment.youWillReceive}</span>
          <strong>{receiveAmount}</strong>
          <b {...equivNoteProps}>{receiveAsset}</b>
        </div>
      </div>

      <div className="return-overview-breakdown">
        <div>
          <span>{copy.dualInvestment.subscriptionAmount}</span>
          <strong>{format.amount(quote.principal)} dUSDC</strong>
        </div>
        <div>
          <span>
            {copy.dualInvestment.rewards} (<b>{rewardMeta}</b>)
          </span>
          <strong>+{format.amount(quote.coupon)} dUSDC</strong>
        </div>
        <div>
          <span>{copy.dualInvestment.total}</span>
          <strong>+{format.amount(total)} dUSDC</strong>
        </div>
        <div className="return-receive-row">
          <span>{copy.dualInvestment.youWillReceive}</span>
          <strong>
            {receiveAmount}
            <i {...equivNoteProps}>{receiveAsset}</i>
          </strong>
        </div>
      </div>
    </Card>
  );
}

export function DualInvestmentConfirm({
  quote,
  productInput,
  subscribeQuote,
  isVerifying,
  onSubscribeSuccess,
  error,
  demoMode = false,
  subscribeDisabledMessage,
  disabledAction,
  locale = DEFAULT_LOCALE,
}: {
  quote: StructuredProductQuote;
  productInput: DualInvestmentInput;
  subscribeQuote: StructuredProductQuote | null;
  isVerifying: boolean;
  onSubscribeSuccess: (confirmation: ConfirmedSubscription) => void;
  error?: string | null;
  demoMode?: boolean;
  subscribeDisabledMessage?: string;
  /** Non-tradable rows (Snapshot): disabled button whose label is the state. */
  disabledAction?: { label: string; note: string };
  locale?: Locale;
}) {
  const copy = copyForLocale(locale);
  const format = formattersForLocale(locale);
  const targetPrice = quote.targetPrice ?? productInput.targetPrice;
  const total = quote.principal + quote.coupon;
  const netApr = netAprAfterCouponFee(quote.apr);
  const periodReturn = quote.principal > 0 ? quote.coupon / quote.principal : 0;
  const subDay = isSubDayTenor(quote.oracle.expiryMs);
  const rewardMeta = subDay ? format.periodReturnBps(periodReturn) : `${format.apr(netApr)} APR`;
  const btcEquivalent = targetPrice > 0 ? total / targetPrice : 0;

  // Keep the last executable subscribe quote mounted across brief parent unmatches
  // (live re-verify gaps), so the panel and its in-flight transaction state
  // (pending/digest/error) survive quote churn. The success dialog itself lives
  // at page level — panel unmounts must not be able to take it down.
  const inputIdentity = productIdentity(quote.oracle.oracleId, productInput);
  const [stickySubscribeQuote, setStickySubscribeQuote] = useState(subscribeQuote);
  const [stickyInputIdentity, setStickyInputIdentity] = useState(inputIdentity);

  useEffect(() => {
    if (inputIdentity !== stickyInputIdentity) {
      setStickyInputIdentity(inputIdentity);
      setStickySubscribeQuote(subscribeQuote);
      return;
    }
    if (subscribeQuote) {
      setStickySubscribeQuote(subscribeQuote);
    }
  }, [subscribeQuote, inputIdentity, stickyInputIdentity]);

  const panelQuote = subscribeQuote ?? stickySubscribeQuote;

  return (
    <section className="di-confirm" aria-label={copy.dualInvestment.confirmLabel}>
      <div className="di-confirm-numbers">
        <div>
          <span>{copy.dualInvestment.youDeposit}</span>
          <strong>{format.amount(quote.principal)} dUSDC</strong>
        </div>
        <div className="di-confirm-arrow" aria-hidden="true">
          →
        </div>
        <div>
          <span>{copy.dualInvestment.receiveAtSettlement}</span>
          <strong>{format.amount(total)} dUSDC</strong>
          <em>{rewardMeta}</em>
        </div>
        <div>
          <span>{copy.dualInvestment.settles}</span>
          <strong>{format.expiry(quote.oracle.expiryMs)}</strong>
        </div>
      </div>

      <div className="di-confirm-worstcase">
        <ShieldCheck size={16} />
        <span className="di-confirm-worstcase-text">
          <span className="di-confirm-worstcase-main">
            {copy.dualInvestment.worstCase(format.usd(targetPrice), format.btcAmount(btcEquivalent))}
          </span>
          <small>{copy.dualInvestment.testnetSettlementNote}</small>
        </span>
      </div>

      {panelQuote && !demoMode ? (
        <TargetBuyExecutionPanel
          quote={panelQuote}
          productInput={productInput}
          onSubscribeSuccess={onSubscribeSuccess}
          locale={locale}
        />
      ) : disabledAction ? (
        <div className="di-confirm-pending di-confirm-awaiting" aria-live="polite">
          <Button variant="primary" disabled>
            {disabledAction.label}
          </Button>
          <p className="di-confirm-awaiting-note">{disabledAction.note}</p>
        </div>
      ) : (
        <div
          className={
            error || (!quote.executable && quote.warning) ? 'di-confirm-pending is-error' : 'di-confirm-pending'
          }
          aria-live="polite"
        >
          {demoMode
            ? (subscribeDisabledMessage ?? copy.demo.subscribeDisabled)
            : error
              ? error
              : isVerifying
                ? copy.dualInvestment.confirmingLiveQuote
                : (!quote.executable && quote.warning) || copy.dualInvestment.adjustForLiveQuote}
        </div>
      )}
    </section>
  );
}

export function DualInvestmentAdvanced({
  quote,
  legCount,
  onLegCountChange,
  locale = DEFAULT_LOCALE,
}: {
  quote: StructuredProductQuote;
  legCount: number;
  onLegCountChange: (value: number) => void;
  locale?: Locale;
}) {
  const copy = copyForLocale(locale);
  const format = formattersForLocale(locale);
  return (
    <details className="di-advanced">
      <summary>
        <span>{copy.dualInvestment.advancedDetails}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>

      <div className="di-advanced-body">
        <label className="di-advanced-control">
          <span>{copy.dualInvestment.payoffSmoothness}</span>
          <select value={legCount} onChange={(event) => onLegCountChange(Number(event.currentTarget.value))}>
            {copy.dualInvestment.smoothnessOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label} ({option.value} {copy.dualInvestment.legsSuffix})
              </option>
            ))}
          </select>
          <small>{copy.dualInvestment.smoothnessHelp}</small>
        </label>

        <QuoteRiskSummary quote={quote} locale={locale} />

        <Card as="article">
          <div className="detail-title">
            <h3>{copy.dualInvestment.deepbookLegs}</h3>
            <span>
              {copy.dualInvestment.oracle} {quote.oracle.oracleId.slice(0, 10)}...
            </span>
          </div>
          <div className="leg-disclosure">
            {quote.legs.map((leg) => (
              <div className="leg-disclosure-row" key={leg.id}>
                <div>
                  <strong>{leg.description}</strong>
                  <span>
                    {format.amount(leg.quantity)} {copy.dualInvestment.payout}
                  </span>
                </div>
                <div>
                  <strong>{format.amount(leg.askCost)}</strong>
                  <span>{copy.dualInvestment.ask}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </details>
  );
}
