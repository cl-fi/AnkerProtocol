'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { copyForLocale, DEFAULT_LOCALE, formattersForLocale, type Locale } from '../i18n';
import { isSubDayTenor } from '../products/dualInvestmentScan';
import { DEFAULT_PROTOCOL_FEE_BPS, netCouponAfterFee } from '../products/feePolicy';
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
        <strong>{format.cashAmount(risk.minimumPayout)} dUSDC</strong>
      </div>
      <div>
        <span>{copy.dualInvestment.risk.maximumLoss}</span>
        <strong>{format.cashAmount(risk.maximumLoss)} dUSDC</strong>
      </div>
      <div>
        <span>{copy.dualInvestment.risk.optionBudget}</span>
        <strong>{format.cashAmount(risk.optionBudget)} dUSDC</strong>
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
  // Only the deposit converts at the Buy Low price — the reward is paid in
  // dUSDC on top, never folded into the BTC figure.
  const btcEquivalent = targetPrice > 0 ? quote.principal / targetPrice : 0;
  // Receipts show the arithmetic in full — gross reward, minus fee, equals
  // what lands. Rendered lines must sum exactly as printed, so round the
  // endpoints to display cents first and derive the fee/total lines from
  // those: rounding each line independently can drift the printed sum by a cent.
  const cents = (value: number) => Math.round(value * 100);
  const rewardNet = cents(netCouponAfterFee(quote.coupon)) / 100;
  const rewardGross = cents(quote.coupon) / 100;
  const feeAmount = rewardGross - rewardNet;
  const feePct = `${DEFAULT_PROTOCOL_FEE_BPS / 100}%`;
  const total = cents(quote.principal) / 100 + rewardNet;
  const isAbove = scenario === 'above';
  const chartClassName = isAbove ? 'return-chart-visual above' : 'return-chart-visual below';
  const pricePathD = isAbove
    ? 'M 70 48 C 95 132 138 50 178 88 C 228 134 248 14 302 74 C 350 130 332 248 416 238 C 484 230 442 138 504 152 C 558 164 586 72 642 48'
    : 'M 70 48 C 95 132 138 50 178 88 C 228 134 248 14 302 74 C 350 130 332 248 416 238 C 484 230 442 98 504 110 C 558 122 514 236 642 230';
  const btcCompact = format.btcAmountCompact(btcEquivalent);
  const belowReceiveText = `≈ ${format.btcAmount(btcEquivalent)} BTC + ${format.fixedTokenAmount(rewardNet, 2)} dUSDC`;
  const belowOutcomeLabel = `${belowReceiveText}. ${copy.dualInvestment.testnetSettlementNote}`;
  const belowValueTip = `${belowReceiveText} · ${copy.dualInvestment.testnetSettlementNote}`;

  return (
    <Card as="article" className="return-overview-panel">
      <div className="return-overview-heading">
        <h3>{copy.dualInvestment.returnOverviewTitle(format.shortDateTime(quote.oracle.expiryMs))}</h3>
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
          <circle className="return-end-dot" cx="642" cy={isAbove ? 48 : 230} r="7" />
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
        <div className="return-receive-chip">
          <span>{copy.dualInvestment.youWillReceive}</span>
          <strong>
            {isAbove
              ? `${format.fixedTokenAmount(total, 2)} dUSDC`
              : `≈ ${btcCompact} BTC + ${format.fixedTokenAmount(rewardNet, 2)} dUSDC`}
          </strong>
        </div>
        {/* The price path is a drawn scenario, not a forecast — say so on the chart. */}
        <span className="return-chart-note">{copy.dualInvestment.illustrativeOnly}</span>
      </div>

      <div className="return-outcomes" aria-label={copy.dualInvestment.atSettlement}>
        <button
          type="button"
          className={`return-outcome is-above${isAbove ? ' is-selected' : ''}`}
          aria-pressed={isAbove}
          onClick={() => setScenario('above')}
        >
          <span className="return-outcome-head">
            <i className="return-outcome-dot" aria-hidden="true" />
            {copy.dualInvestment.outcomeAbove(format.usd(targetPrice))}
          </span>
          <span className="return-outcome-receipt">
            <span className="return-receipt-row">
              <span>{copy.dualInvestment.receiptDeposit}</span>
              <strong>{format.fixedTokenAmount(quote.principal, 2)}</strong>
            </span>
            {/* Invisible twin of the below card's "÷ Buy Low price" row so Reward,
                Fee, the dashed rule, and You receive share one horizontal grid. */}
            <span className="return-receipt-row is-divide is-spacer" aria-hidden="true">
              <span>{copy.dualInvestment.receiptDividePrice}</span>
              <strong>{format.usd(targetPrice)}</strong>
            </span>
            <span className="return-receipt-row">
              <span>{copy.dualInvestment.receiptReward}</span>
              <strong>+{format.fixedTokenAmount(rewardGross, 2)}</strong>
            </span>
            <span className="return-receipt-row is-fee">
              <span>{copy.dualInvestment.receiptFee(feePct)}</span>
              <strong>−{format.fixedTokenAmount(feeAmount, 2)}</strong>
            </span>
            {/* No conversion step in this outcome — the sum IS what you get, so
                the terminal line says "You receive", mirroring the below card. */}
            <span className="return-receipt-row is-receive">
              <span>{copy.dualInvestment.youWillReceive}</span>
              <strong>{format.fixedTokenAmount(total, 2)} dUSDC</strong>
            </span>
          </span>
        </button>
        <button
          type="button"
          className={`return-outcome is-below${!isAbove ? ' is-selected' : ''}`}
          aria-pressed={!isAbove}
          aria-label={`${copy.dualInvestment.outcomeAtOrBelow(format.usd(targetPrice))}. ${belowOutcomeLabel}`}
          onClick={() => setScenario('below')}
        >
          <span className="return-outcome-head">
            <i className="return-outcome-dot" aria-hidden="true" />
            {copy.dualInvestment.outcomeAtOrBelow(format.usd(targetPrice))}
          </span>
          <span className="return-outcome-receipt">
            {/* Deposit ÷ price is the conversion; the reward never enters the
                division — it rides along in dUSDC. */}
            <span className="return-receipt-row">
              <span>{copy.dualInvestment.receiptDeposit}</span>
              <strong>{format.fixedTokenAmount(quote.principal, 2)}</strong>
            </span>
            <span className="return-receipt-row is-divide">
              <span>{copy.dualInvestment.receiptDividePrice}</span>
              <strong>{format.usd(targetPrice)}</strong>
            </span>
            <span className="return-receipt-row">
              <span>{copy.dualInvestment.receiptReward}</span>
              <strong>+{format.fixedTokenAmount(rewardGross, 2)}</strong>
            </span>
            <span className="return-receipt-row is-fee">
              <span>{copy.dualInvestment.receiptFee(feePct)}</span>
              <strong>−{format.fixedTokenAmount(feeAmount, 2)}</strong>
            </span>
            <span className="return-receipt-row is-receive">
              <span>{copy.dualInvestment.youWillReceive}</span>
              <strong className="di-equiv-note" data-tip={belowValueTip}>
                ≈ {btcCompact} BTC + {format.fixedTokenAmount(rewardNet, 2)} dUSDC
              </strong>
            </span>
          </span>
        </button>
      </div>
    </Card>
  );
}

export function DualInvestmentConfirm({
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
  locale = DEFAULT_LOCALE,
}: {
  quote: StructuredProductQuote;
  productInput: DualInvestmentInput;
  subscribeQuote: StructuredProductQuote | null;
  isVerifying: boolean;
  /** Amount exceeds the connected balance — blocks subscribe (input shows why). */
  insufficientFunds?: boolean;
  onSubscribeSuccess: (confirmation: ConfirmedSubscription) => void;
  error?: string | null;
  demoMode?: boolean;
  subscribeDisabledMessage?: string;
  /** Non-tradable rows (Snapshot): disabled button whose label is the state. */
  disabledAction?: { label: string; note: string };
  locale?: Locale;
}) {
  const copy = copyForLocale(locale);
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
    <section className="ticket-confirm" aria-label={copy.dualInvestment.confirmLabel}>
      {panelQuote && !demoMode ? (
        <TargetBuyExecutionPanel
          quote={panelQuote}
          productInput={productInput}
          insufficientFunds={insufficientFunds}
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
                  <strong>{format.cashAmount(leg.askCost)}</strong>
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
