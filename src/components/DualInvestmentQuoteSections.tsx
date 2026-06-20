'use client';

import { Calculator } from 'lucide-react';
import Link from 'next/link';
import type { ChangeEvent } from 'react';
import { scanQuoteDisplayMetrics, type DualInvestmentScanRow } from '../products/dualInvestmentScan';
import { formatTimeToExpiry } from '../products/timeFormat';
import type { DualInvestmentInput, OracleMarket } from '../products/types';
import type { CuratedOracleListItem } from '../server/curatedOracles';

export { QuoteDetail, QuoteRiskSummary } from './DualInvestmentQuoteDetail';

export const DEFAULT_PRINCIPAL = 5;
export type DualInvestmentMode = 'buy-low';

const SMOOTHNESS_OPTIONS = [
  { label: 'Efficient', value: 3 },
  { label: 'Standard', value: 6 },
  { label: 'Smooth', value: 9 },
];

function formatPrice(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatAmount(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatApr(value: number) {
  return `${(value * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function formatBelowSpot(targetPrice: number, spot: number) {
  if (spot <= 0 || targetPrice >= spot) return '--';
  return `${(((spot - targetPrice) / spot) * 100).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}%`;
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function formatExpiryOption(oracle: CuratedOracleListItem) {
  return `${formatTimeToExpiry(oracle.expiry)} | ${formatTime(oracle.expiry)}`;
}

export function DualInvestmentModeTabs({ mode }: { mode: DualInvestmentMode }) {
  return (
    <nav className="mode-tabs" aria-label="Dual Investment direction">
      <Link
        className={mode === 'buy-low' ? 'active' : ''}
        href="/app/dual-investment"
      >
        Buy Low
      </Link>
      <button
        aria-disabled="true"
        className="disabled"
        onClick={(event) => {
          event.preventDefault();
        }}
        type="button"
      >
        Sell High
      </button>
    </nav>
  );
}

export function OracleSnapshot({
  market,
  productOracles,
  staleSnapshot,
  onSelectOracle,
}: {
  market?: OracleMarket;
  productOracles: CuratedOracleListItem[];
  staleSnapshot?: boolean;
  onSelectOracle: (oracleId: string) => void;
}) {
  return (
    <section className="calculation-section oracle-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Live DeepBook Predict Oracle</span>
          <h2>Nearest BTC Expiry</h2>
          <p className="price-context">Oracle selector: state-ready BTC product expiries from the Anker server wrapper.</p>
        </div>
        <div className="expiry-controls">
          <label className="expiry-select">
            <span>Select expiry</span>
            <select
              aria-label="Select expiry"
              value={market?.oracleId ?? ''}
              onChange={(event) => onSelectOracle(event.currentTarget.value)}
            >
              {productOracles.map((oracle) => (
                <option value={oracle.oracle_id} key={oracle.oracle_id}>
                  {formatExpiryOption(oracle)}
                </option>
              ))}
            </select>
          </label>
          <span className={staleSnapshot ? 'quote-badge preview' : 'quote-badge live'}>
            {staleSnapshot ? 'Snapshot' : 'Live'}
          </span>
        </div>
      </div>
      <div className="oracle-grid">
        <div>
          <span>BTC Price</span>
          <strong>{market ? formatPrice(market.spot) : '--'}</strong>
        </div>
        <div>
          <span>Time to Expiry</span>
          <strong>{market ? formatTimeToExpiry(market.expiryMs) : '--'}</strong>
        </div>
        <div>
          <span>Settlement</span>
          <strong>{market ? formatTime(market.expiryMs) : '--'}</strong>
        </div>
      </div>
    </section>
  );
}

export function ScanBoard({
  market,
  rows,
  isFetching,
  updatedAt,
  onUse,
  onRefresh,
}: {
  market?: OracleMarket;
  rows: DualInvestmentScanRow[];
  isFetching: boolean;
  updatedAt?: number;
  onUse: (input: DualInvestmentInput) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="calculation-section" id="scan-board">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Auto Scan Board</span>
          <h2>Buy Low BTC Quotes</h2>
        </div>
        <button className="ghost-button" type="button" onClick={onRefresh}>
          <Calculator size={16} />
          {isFetching ? 'Calculating' : 'Recalculate'}
        </button>
      </div>
      <div className="scan-meta">
        <span>Default notional: {formatAmount(DEFAULT_PRINCIPAL)} dUSDC</span>
        <span>Default ladder: 6 Predict UP legs</span>
        <span>Filter: targets must be strictly below live spot</span>
        <span>Grid: nearest 500 dUSDC target below spot, then step down</span>
        <span>Pricing: local SVI + vault utilization estimate</span>
        <span>{updatedAt ? `Last estimate: ${formatTime(updatedAt)}` : 'Waiting for oracle state'}</span>
      </div>
      <div className="table-shell">
        <table className="offer-table scan-table">
          <thead>
            <tr>
              <th>Buy Low</th>
              <th>Anker APR</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const displayMetrics = scanQuoteDisplayMetrics(row);
              const belowSpot = market ? `${formatBelowSpot(row.input.targetPrice, market.spot)} below` : '--';
              return (
                <tr key={`${row.input.targetPrice}-${row.input.floorPrice}`}>
                  <td data-label="Buy Low">
                    <strong>{formatPrice(row.input.targetPrice)}</strong>
                    <span>{belowSpot}</span>
                  </td>
                  <td className={displayMetrics.apr !== null ? 'apr-cell' : ''} data-label="Anker APR">
                    {displayMetrics.apr !== null ? formatApr(displayMetrics.apr) : '--'}
                  </td>
                  <td data-label="Action">
                    <button className="small-action" type="button" onClick={() => onUse(row.input)}>
                      Use
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function CustomPreviewForm({
  market,
  customInput,
  isPreviewing,
  onChange,
  onPreview,
}: {
  market?: OracleMarket;
  customInput: DualInvestmentInput;
  isPreviewing: boolean;
  onChange: (input: DualInvestmentInput) => void;
  onPreview: () => void;
}) {
  const updateNumber = (key: keyof DualInvestmentInput) => (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...customInput, [key]: Number(event.currentTarget.value) });
  };
  const updateLegCount = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...customInput, targetLegCount: Number(event.currentTarget.value) });
  };

  return (
    <section className="calculation-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Custom Verified Preview</span>
          <h2>Design Your Buy Low</h2>
        </div>
        <span className="price-context">Preview runs batched DeepBook devInspect</span>
      </div>
      <div className="custom-grid">
        <label>
          <span>Amount</span>
          <input min="1" step="1" type="number" value={customInput.principal} onChange={updateNumber('principal')} />
        </label>
        <label>
          <span>Buy Low Price</span>
          <input min="1" step="1" type="number" value={customInput.targetPrice} onChange={updateNumber('targetPrice')} />
        </label>
        <label>
          <span>Payoff Smoothness</span>
          <select value={customInput.targetLegCount ?? 6} onChange={updateLegCount}>
            {SMOOTHNESS_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label} ({option.value} legs)
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="primary-action preview-action" type="button" disabled={!market || isPreviewing} onClick={onPreview}>
        {isPreviewing ? 'Previewing...' : 'Preview Live Quote'}
      </button>
    </section>
  );
}
