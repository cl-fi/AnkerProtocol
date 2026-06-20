'use client';

import { useState } from 'react';
import { riskMetricsForDualInvestmentQuote } from '../products/riskMetrics';
import type { DualInvestmentInput, StructuredProductQuote } from '../products/types';
import { TargetBuyExecutionPanel } from './TargetBuyExecutionPanel';

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

function formatQuotePrincipal(quote: StructuredProductQuote) {
  return `${formatAmount(quote.principal)} dUSDC`;
}

function formatUpdatedAt(value: number) {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(value);
}

function formatChartDate(value: number) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
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

function ReturnOverview({
  quote,
  productInput,
}: {
  quote: StructuredProductQuote;
  productInput: DualInvestmentInput;
}) {
  const [scenario, setScenario] = useState<'above' | 'below'>('above');
  const targetPrice = quote.targetPrice ?? productInput.targetPrice;
  const total = quote.principal + quote.coupon;
  const btcEquivalent = targetPrice > 0 ? total / targetPrice : 0;
  const isAbove = scenario === 'above';
  const receiveAmount = isAbove ? formatTokenAmount(total, 6) : formatTokenAmount(btcEquivalent, 8);
  const receiveAsset = isAbove ? 'dUSDC' : 'BTC equiv.';
  const chartClassName = isAbove ? 'return-chart-visual above' : 'return-chart-visual below';

  return (
    <article className="detail-panel return-overview-panel">
      <div className="return-overview-heading">
        <h3>Return Overview</h3>
        <p>These scenarios are based on the Fixing Price</p>
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
              <stop offset="0%" stopColor="#ffd43b" stopOpacity="0.98" />
              <stop offset="58%" stopColor="#ffd43b" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ffd43b" stopOpacity="0.98" />
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
          <b>{receiveAsset}</b>
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
            <i>{receiveAsset}</i>
          </strong>
        </div>
      </div>
    </article>
  );
}

export function QuoteDetail({
  quote,
  error,
  productInput,
  isRefreshing = false,
  updatedAt,
  autoRefreshMs,
}: {
  quote: StructuredProductQuote | null;
  error: string | null;
  productInput: DualInvestmentInput;
  isRefreshing?: boolean;
  updatedAt?: number | null;
  autoRefreshMs?: number;
}) {
  if (error && !quote) {
    return (
      <section className="quote-detail">
        <div className="detail-panel error-panel">{error}</div>
      </section>
    );
  }

  if (!quote) {
    return (
      <section className="quote-detail">
        <div className="detail-panel empty-preview">
          Choose parameters and run Preview to verify the exact DeepBook Predict leg costs.
        </div>
      </section>
    );
  }

  return (
    <section className="quote-detail">
      <div className={error ? 'quote-refresh-status error' : 'quote-refresh-status'} aria-live="polite">
        {isRefreshing ? <span className="quote-refresh-spinner" aria-hidden="true" /> : null}
        <span>
          {isRefreshing
            ? 'Refreshing quote...'
            : updatedAt
              ? `Quote refreshed at ${formatUpdatedAt(updatedAt)}`
              : 'Quote ready'}
        </span>
        {autoRefreshMs ? <small>Auto-refreshes every {Math.round(autoRefreshMs / 1_000)}s</small> : null}
        {error ? <strong>{error}</strong> : null}
      </div>

      <div className="quote-summary">
        <div>
          <span>Principal</span>
          <strong>{formatQuotePrincipal(quote)}</strong>
        </div>
        <div>
          <span>Coupon</span>
          <strong>{formatAmount(quote.coupon)} dUSDC</strong>
        </div>
        <div>
          <span>Leg Cost</span>
          <strong>{formatAmount(quote.totalLegCost)} dUSDC</strong>
        </div>
        <div>
          <span>APR</span>
          <strong>{formatApr(quote.apr)}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{quote.executable ? 'Verified' : 'No coupon'}</strong>
        </div>
      </div>

      <QuoteRiskSummary quote={quote} />

      <div className="detail-grid">
        <ReturnOverview quote={quote} productInput={productInput} />

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

      <TargetBuyExecutionPanel quote={quote} productInput={productInput} />
    </section>
  );
}
