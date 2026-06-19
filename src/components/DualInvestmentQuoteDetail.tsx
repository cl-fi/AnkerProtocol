'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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

function formatQuotePrincipal(quote: StructuredProductQuote) {
  return `${formatAmount(quote.principal)} dUSDC`;
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

export function QuoteDetail({
  quote,
  error,
  productInput,
}: {
  quote: StructuredProductQuote | null;
  error: string | null;
  productInput: DualInvestmentInput;
}) {
  if (error) {
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
        <article className="detail-panel">
          <div className="detail-title">
            <h3>Payoff Preview</h3>
            <span>Settlement simulation</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={quote.scenarios}>
              <XAxis
                dataKey="settlementPrice"
                tick={{ fill: '#64756f', fontSize: 12 }}
                axisLine={{ stroke: '#d8e5df' }}
                tickLine={false}
                tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
              />
              <YAxis tick={{ fill: '#64756f', fontSize: 12 }} axisLine={{ stroke: '#d8e5df' }} tickLine={false} />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #cfe0d9', borderRadius: 8 }} />
              <Line type="monotone" dataKey="finalUsdc" stroke="#0f766e" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </article>

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
