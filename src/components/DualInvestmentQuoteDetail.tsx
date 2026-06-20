'use client';

import { ChevronDown, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { riskMetricsForDualInvestmentQuote } from '../products/riskMetrics';
import type { DualInvestmentInput, StructuredProductQuote } from '../products/types';
import { TargetBuyExecutionPanel } from './TargetBuyExecutionPanel';

export const SMOOTHNESS_OPTIONS = [
  { label: 'Efficient', value: 3 },
  { label: 'Standard', value: 6 },
  { label: 'Smooth', value: 9 },
];

function formatAmount(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatApr(value: number) {
  return `${(value * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function formatPercent(value: number) {
  return `${(value * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function formatPrice(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatTokenAmount(value: number, decimals: number) {
  return value.toLocaleString('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function formatBtc(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

function formatChartDate(value: number) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(value);
}

function formatSettlement(value: number) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function oldestQuoteTimestamp(quote: StructuredProductQuote) {
  return quote.legs.reduce(
    (oldest, leg) => Math.min(oldest, leg.quoteTimestampMs),
    quote.legs[0]?.quoteTimestampMs ?? Date.now(),
  );
}

export function QuoteRiskSummary({ quote }: { quote: StructuredProductQuote }) {
  const risk = riskMetricsForDualInvestmentQuote(quote);
  return (
    <div className="quote-summary compact-summary">
      <div>
        <span>Minimum Payout</span>
        <strong>{formatAmount(risk.minimumPayout)} dUSDC</strong>
      </div>
      <div>
        <span>Maximum Loss</span>
        <strong>{formatAmount(risk.maximumLoss)} dUSDC</strong>
      </div>
      <div>
        <span>Option Budget</span>
        <strong>{formatAmount(risk.optionBudget)} dUSDC</strong>
      </div>
      <div>
        <span>Hold Return</span>
        <strong>{formatPercent(risk.holdingPeriodReturn)}</strong>
      </div>
      <div>
        <span>Quote Validity</span>
        <strong>{risk.quoteTtlSeconds}s</strong>
      </div>
      <div>
        <span>Slippage Limit</span>
        <strong>{formatPercent(risk.maxCostSlippage)} max cost</strong>
      </div>
      <div>
        <span>Liquidity</span>
        <strong>{risk.liquidityStatus === 'verified' ? 'Verified' : 'Unavailable'}</strong>
      </div>
    </div>
  );
}

export function ReturnOverview({
  quote,
  productInput,
  estimated = false,
}: {
  quote: StructuredProductQuote;
  productInput: DualInvestmentInput;
  estimated?: boolean;
}) {
  const [scenario, setScenario] = useState<'above' | 'below'>('above');
  const targetPrice = quote.targetPrice ?? productInput.targetPrice;
  const total = quote.principal + quote.coupon;
  const btcEquivalent = targetPrice > 0 ? total / targetPrice : 0;
  const isAbove = scenario === 'above';
  const receiveAmount = isAbove ? formatTokenAmount(total, 6) : formatTokenAmount(btcEquivalent, 8);
  const receiveAsset = isAbove ? 'dUSDC' : 'BTC equiv.';
  const settleNote = isAbove
    ? null
    : 'Cash-settled in dUSDC for now — you receive the equivalent value, not real BTC. On-chain BTC settlement arrives in a future mainnet release.';
  const equivNoteProps = settleNote
    ? { className: 'di-equiv-note', 'data-tip': settleNote, tabIndex: 0, 'aria-label': `${receiveAsset}. ${settleNote}` }
    : {};
  const chartClassName = isAbove ? 'return-chart-visual above' : 'return-chart-visual below';

  return (
    <article className="detail-panel return-overview-panel">
      <div className="return-overview-heading">
        <div>
          <h3>Return Overview</h3>
          <p>What you get at settlement, depending on where BTC lands</p>
        </div>
        <span className={estimated ? 'quote-badge preview' : 'quote-badge live'}>
          {estimated ? 'Estimate' : 'Live quote'}
        </span>
      </div>

      <div className="return-scenario-tabs" aria-label="Return scenario">
        <button className={isAbove ? 'active' : ''} type="button" onClick={() => setScenario('above')}>
          Above {formatPrice(targetPrice)}
        </button>
        <button className={!isAbove ? 'active' : ''} type="button" onClick={() => setScenario('below')}>
          At or Below {formatPrice(targetPrice)}
        </button>
      </div>

      <div className={chartClassName}>
        <svg viewBox="0 0 720 320" role="img" aria-label="Return scenario illustration">
          <defs>
            <linearGradient id="returnPathFade" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#b9772f" stopOpacity="0.95" />
              <stop offset="58%" stopColor="#cf9a52" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#b9772f" stopOpacity="0.95" />
            </linearGradient>
          </defs>
          <line className="return-grid-line horizontal" x1="46" x2="674" y1="138" y2="138" />
          <line className="return-grid-line" x1="178" x2="178" y1="18" y2="286" />
          <line className="return-grid-line" x1="546" x2="546" y1="18" y2="286" />
          <path
            className="return-price-path"
            d={
              isAbove
                ? 'M 70 48 C 95 132 138 50 178 88 C 228 134 248 14 302 74 C 350 130 332 248 416 238 C 484 230 442 138 504 152 C 558 164 586 72 642 48'
                : 'M 70 48 C 95 132 138 50 178 88 C 228 134 248 14 302 74 C 350 130 332 248 416 238 C 484 230 442 98 504 110 C 558 122 514 236 642 230'
            }
          />
          <circle className="return-current-dot" cx="178" cy="88" r="8" />
          <path className="return-arrow" d={isAbove ? 'M 642 48 l -16 -10 l 4 20 z' : 'M 642 230 l -18 -8 l 7 18 z'} />
        </svg>

        <div className="return-target-label">
          <span>Target Price</span>
          <strong>{formatPrice(targetPrice)}</strong>
        </div>
        <div className="return-current-label">
          <span>Current Price</span>
          <strong>{formatPrice(quote.oracle.spot)}</strong>
        </div>
        <div className="return-date-label start">
          <span>Start</span>
          <strong>{formatChartDate(oldestQuoteTimestamp(quote))}</strong>
        </div>
        <div className="return-date-label settle">
          <span>Settle</span>
          <strong>{formatChartDate(quote.oracle.expiryMs)}</strong>
        </div>
        <div className="return-receive-card">
          <span>You will receive</span>
          <strong>{receiveAmount}</strong>
          <b {...equivNoteProps}>{receiveAsset}</b>
        </div>
      </div>

      <div className="return-overview-breakdown">
        <div>
          <span>Subscription Amount</span>
          <strong>{formatAmount(quote.principal)} dUSDC</strong>
        </div>
        <div>
          <span>
            Rewards (<b>{formatApr(quote.apr)}</b> APR)
          </span>
          <strong>+{formatAmount(quote.coupon)} dUSDC</strong>
        </div>
        <div>
          <span>Total</span>
          <strong>+{formatAmount(total)} dUSDC</strong>
        </div>
        <div className="return-receive-row">
          <span>You will receive</span>
          <strong>
            {receiveAmount}
            <i {...equivNoteProps}>{receiveAsset}</i>
          </strong>
        </div>
      </div>
    </article>
  );
}

export function DualInvestmentConfirm({
  quote,
  productInput,
  subscribeQuote,
  isVerifying,
  error,
}: {
  quote: StructuredProductQuote;
  productInput: DualInvestmentInput;
  subscribeQuote: StructuredProductQuote | null;
  isVerifying: boolean;
  error?: string | null;
}) {
  const targetPrice = quote.targetPrice ?? productInput.targetPrice;
  const total = quote.principal + quote.coupon;
  const btcEquivalent = targetPrice > 0 ? total / targetPrice : 0;

  return (
    <section className="di-confirm" aria-label="Confirm your Buy Low">
      <div className="di-confirm-numbers">
        <div>
          <span>You deposit</span>
          <strong>{formatAmount(quote.principal)} dUSDC</strong>
        </div>
        <div className="di-confirm-arrow" aria-hidden="true">
          →
        </div>
        <div>
          <span>You receive at settlement</span>
          <strong>{formatAmount(total)} dUSDC</strong>
          <em>{formatApr(quote.apr)} APR</em>
        </div>
        <div>
          <span>Settles</span>
          <strong>{formatSettlement(quote.oracle.expiryMs)}</strong>
        </div>
      </div>

      <div className="di-confirm-worstcase">
        <ShieldCheck size={16} />
        <span className="di-confirm-worstcase-text">
          <span className="di-confirm-worstcase-main">
            Worst case: if BTC settles at or below {formatPrice(targetPrice)}, you buy about {formatBtc(btcEquivalent)} BTC
            at {formatPrice(targetPrice)} — the price you chose.
          </span>
          <small>
            On testnet this settles in dUSDC, not BTC — if BTC ends below your price you&apos;d receive slightly less cash
            than you deposited (e.g. ~990 from 1,000 dUSDC). On mainnet, positions settle in real wrapped BTC.
          </small>
        </span>
      </div>

      {subscribeQuote ? (
        <TargetBuyExecutionPanel quote={subscribeQuote} productInput={productInput} />
      ) : (
        <div className={error ? 'di-confirm-pending is-error' : 'di-confirm-pending'} aria-live="polite">
          {error
            ? error
            : isVerifying
              ? 'Confirming live quote…'
              : 'Adjust your Buy Low price to get a live quote.'}
        </div>
      )}
    </section>
  );
}

export function DualInvestmentAdvanced({
  quote,
  legCount,
  onLegCountChange,
}: {
  quote: StructuredProductQuote;
  legCount: number;
  onLegCountChange: (value: number) => void;
}) {
  return (
    <details className="di-advanced">
      <summary>
        <span>Advanced details</span>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>

      <div className="di-advanced-body">
        <label className="di-advanced-control">
          <span>Payoff smoothness</span>
          <select value={legCount} onChange={(event) => onLegCountChange(Number(event.currentTarget.value))}>
            {SMOOTHNESS_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label} ({option.value} legs)
              </option>
            ))}
          </select>
          <small>More legs make the payout smoother near your target, at a slightly higher option budget.</small>
        </label>

        <QuoteRiskSummary quote={quote} />

        <article className="detail-panel">
          <div className="detail-title">
            <h3>DeepBook Predict Legs</h3>
            <span>Oracle {quote.oracle.oracleId.slice(0, 10)}...</span>
          </div>
          <div className="leg-disclosure">
            {quote.legs.map((leg) => (
              <div className="leg-disclosure-row" key={leg.id}>
                <div>
                  <strong>{leg.description}</strong>
                  <span>{formatAmount(leg.quantity)} dUSDC payout</span>
                </div>
                <div>
                  <strong>{formatAmount(leg.askCost)}</strong>
                  <span>dUSDC ask</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </details>
  );
}
