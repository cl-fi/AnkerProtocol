'use client';

import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { findBinanceDualInvestmentMatch, type BinanceDualInvestmentProduct } from '../deepbook/binanceDualInvestment';
import { scanQuoteDisplayMetrics, type DualInvestmentScanRow } from '../products/dualInvestmentScan';
import { netAprAfterCouponFee } from '../products/feePolicy';
import { formatTimeToExpiry } from '../products/timeFormat';
import type { DualInvestmentInput, OracleMarket } from '../products/types';
import type { CuratedOracleListItem } from '../server/curatedOracles';
import { Button, InputField, Tabs, tabClassName } from '../ui';

export { QuoteRiskSummary } from './DualInvestmentQuoteDetail';

export const DEFAULT_PRINCIPAL = 5;
export type DualInvestmentMode = 'buy-low';

function formatPrice(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatApr(value: number) {
  return `${(value * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function formatReferenceApr(value: number) {
  return `${(value * 100).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}%`;
}

function formatEdge(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} pts`;
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
  return `${formatTime(oracle.expiry)} · ${formatTimeToExpiry(oracle.expiry)}`;
}

export function DirectionPairBar({
  mode,
  market,
  productOracles,
  onSelectOracle,
}: {
  mode: DualInvestmentMode;
  market?: OracleMarket;
  productOracles: CuratedOracleListItem[];
  onSelectOracle: (oracleId: string) => void;
}) {
  return (
    <section className="di-selection" aria-label="Choose your market">
      <div className="di-select-group">
        <span className="di-select-label">Pair</span>
        <div className="di-pair-chip">
          <span className="coin-dot">₿</span>
          <strong>BTC</strong>
          <span>/ dUSDC</span>
        </div>
      </div>

      <div className="di-select-group">
        <span className="di-select-label">Direction</span>
        <Tabs className="di-direction" aria-label="Dual Investment direction">
          <Link className={tabClassName({ active: mode === 'buy-low' })} href="/app/dual-investment">
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
        </Tabs>
      </div>

      <div className="di-select-group di-select-grow">
        <span className="di-select-label">Settlement date</span>
        <label className="expiry-select">
          <select
            aria-label="Settlement date"
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
      </div>
    </section>
  );
}

export function BuyLowControls({
  market,
  principal,
  targetPrice,
  estimateApr,
  onPrincipalChange,
  onTargetChange,
}: {
  market?: OracleMarket;
  principal: number;
  targetPrice: number;
  estimateApr: number | null;
  onPrincipalChange: (value: number) => void;
  onTargetChange: (value: number) => void;
}) {
  const updateNumber = (handler: (value: number) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    handler(Number(event.currentTarget.value));
  };
  const belowSpot = market ? formatBelowSpot(targetPrice, market.spot) : '--';

  return (
    <section className="di-controls" aria-label="Set your Buy Low">
      <div className="di-controls-grid">
        <InputField
          label="Amount"
          suffix="dUSDC"
          min="1"
          step="1"
          type="number"
          value={principal}
          onChange={updateNumber(onPrincipalChange)}
        />
        <InputField
          label="Buy Low price"
          suffix={belowSpot !== '--' ? `${belowSpot} below` : 'BTC'}
          min="1"
          step="100"
          type="number"
          value={targetPrice}
          onChange={updateNumber(onTargetChange)}
        />
      </div>
      <div className="di-controls-apr">
        <span>Estimated reward</span>
        <strong>{estimateApr !== null ? `${formatApr(netAprAfterCouponFee(estimateApr))} APR` : '--'}</strong>
      </div>
    </section>
  );
}

export function ReferenceTable({
  market,
  rows,
  binanceProducts = [],
  activeTargetPrice,
  isFetching,
  onSelect,
  onRefresh,
}: {
  market?: OracleMarket;
  rows: DualInvestmentScanRow[];
  binanceProducts?: BinanceDualInvestmentProduct[];
  activeTargetPrice: number;
  isFetching: boolean;
  onSelect: (input: DualInvestmentInput) => void;
  onRefresh: () => void;
}) {
  const handleKey = (input: DualInvestmentInput) => (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(input);
    }
  };

  return (
    <section className="di-reference" aria-label="APR reference">
      <div className="di-reference-head">
        <h3>Price &amp; APR reference</h3>
        <Button variant="secondary" onClick={onRefresh}>
          <RefreshCw size={15} />
          {isFetching ? 'Updating' : 'Refresh'}
        </Button>
      </div>
      <p className="di-reference-hint">Tap a price to load it into your Buy Low.</p>
      <div className="table-shell">
        <table className="offer-table di-reference-table">
          <thead>
            <tr>
              <th>Buy Low</th>
              <th>Est. APR</th>
              <th>Binance APR</th>
              <th>Edge</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const displayMetrics = scanQuoteDisplayMetrics(row);
              const belowSpot = market ? `${formatBelowSpot(row.input.targetPrice, market.spot)} below` : '--';
              const binanceMatch = market
                ? findBinanceDualInvestmentMatch({
                    products: binanceProducts,
                    targetPrice: row.input.targetPrice,
                    settlementTimeMs: market.expiryMs,
                  })
                : undefined;
              const edge =
                displayMetrics.apr !== null && binanceMatch ? displayMetrics.apr - binanceMatch.apr : null;
              const isActive = row.input.targetPrice === activeTargetPrice;
              return (
                <tr
                  className={isActive ? 'selected' : ''}
                  key={`${row.input.targetPrice}-${row.input.floorPrice}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  onClick={() => onSelect(row.input)}
                  onKeyDown={handleKey(row.input)}
                >
                  <td data-label="Buy Low">
                    <strong>{formatPrice(row.input.targetPrice)}</strong>
                    <span>{belowSpot}</span>
                  </td>
                  <td className={displayMetrics.apr !== null ? 'apr-cell' : ''} data-label="Est. APR">
                    {displayMetrics.apr !== null ? formatReferenceApr(displayMetrics.apr) : '--'}
                  </td>
                  <td className={binanceMatch ? 'binance-apr' : 'muted-cell'} data-label="Binance APR">
                    {binanceMatch ? formatReferenceApr(binanceMatch.apr) : '--'}
                  </td>
                  <td className={edge !== null ? `edge-cell ${edge >= 0 ? 'positive' : ''}` : 'muted-cell'} data-label="Edge">
                    {edge !== null ? formatEdge(edge) : '--'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="di-reference-footnote">
          Binance benchmark uses BTCUSDC Dual Investment, matched by target price and nearest settlement date. Anker
          APR is net after protocol fee and based on live DeepBook Predict quote preview.
        </p>
      </div>
    </section>
  );
}
