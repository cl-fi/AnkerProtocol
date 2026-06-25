'use client';

import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { findBinanceDualInvestmentMatch, type BinanceDualInvestmentProduct } from '../deepbook/binanceDualInvestment';
import { copyForLocale, DEFAULT_LOCALE, formattersForLocale, localizedPath, type Locale } from '../i18n';
import { scanQuoteDisplayMetrics, type DualInvestmentScanRow } from '../products/dualInvestmentScan';
import { netAprAfterCouponFee } from '../products/feePolicy';
import type { DualInvestmentInput, OracleMarket } from '../products/types';
import type { CuratedOracleListItem } from '../server/curatedOracles';
import { Button, InputField, Tabs, tabClassName } from '../ui';

export { QuoteRiskSummary } from './DualInvestmentQuoteDetail';

export const DEFAULT_PRINCIPAL = 5;
export type DualInvestmentMode = 'buy-low';
export type BinanceBenchmarkStatus = 'loading' | 'error' | 'ready';

function formatEdge(value: number, locale: Locale) {
  const sign = value > 0 ? '+' : '';
  const numberLocale = locale === 'zh-CN' ? 'zh-CN' : 'en-US';
  return `${sign}${(value * 100).toLocaleString(numberLocale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} pts`;
}

function formatBelowSpot(targetPrice: number, spot: number, locale: Locale) {
  if (spot <= 0 || targetPrice >= spot) return '--';
  return formattersForLocale(locale).percent((spot - targetPrice) / spot, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function formatExpiryOption(oracle: CuratedOracleListItem, locale: Locale) {
  const format = formattersForLocale(locale);
  return `${format.time(oracle.expiry)} · ${format.timeToExpiry(oracle.expiry)}`;
}

export function DirectionPairBar({
  mode,
  market,
  productOracles,
  onSelectOracle,
  locale = DEFAULT_LOCALE,
}: {
  mode: DualInvestmentMode;
  market?: OracleMarket;
  productOracles: CuratedOracleListItem[];
  onSelectOracle: (oracleId: string) => void;
  locale?: Locale;
}) {
  const copy = copyForLocale(locale);
  return (
    <section className="di-selection" aria-label={copy.dualInvestment.chooseMarketLabel}>
      <div className="di-select-group">
        <span className="di-select-label">{copy.dualInvestment.pair}</span>
        <div className="di-pair-chip">
          <span className="coin-dot">₿</span>
          <strong>BTC</strong>
          <span>/ dUSDC</span>
        </div>
      </div>

      <div className="di-select-group">
        <span className="di-select-label">{copy.dualInvestment.direction}</span>
        <Tabs className="di-direction" aria-label={copy.dualInvestment.directionLabel}>
          <Link
            className={tabClassName({ active: mode === 'buy-low' })}
            href={localizedPath(locale, '/app/dual-investment')}
          >
            {copy.common.buyLow}
          </Link>
          <button
            aria-disabled="true"
            className="disabled"
            onClick={(event) => {
              event.preventDefault();
            }}
            type="button"
          >
            {copy.common.sellHigh}
          </button>
        </Tabs>
      </div>

      <div className="di-select-group di-select-grow">
        <span className="di-select-label">{copy.dualInvestment.settlementDate}</span>
        <label className="expiry-select">
          <select
            aria-label={copy.dualInvestment.settlementDate}
            value={market?.oracleId ?? ''}
            onChange={(event) => onSelectOracle(event.currentTarget.value)}
          >
            {productOracles.map((oracle) => (
              <option value={oracle.oracle_id} key={oracle.oracle_id}>
                {formatExpiryOption(oracle, locale)}
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
  locale = DEFAULT_LOCALE,
}: {
  market?: OracleMarket;
  principal: number;
  targetPrice: number;
  estimateApr: number | null;
  onPrincipalChange: (value: number) => void;
  onTargetChange: (value: number) => void;
  locale?: Locale;
}) {
  const copy = copyForLocale(locale);
  const format = formattersForLocale(locale);
  const updateNumber = (handler: (value: number) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    handler(Number(event.currentTarget.value));
  };
  const belowSpot = market ? formatBelowSpot(targetPrice, market.spot, locale) : '--';

  return (
    <section className="di-controls" aria-label={copy.dualInvestment.setBuyLowLabel}>
      <div className="di-controls-grid">
        <InputField
          label={copy.dualInvestment.amount}
          suffix="dUSDC"
          min="1"
          step="1"
          type="number"
          value={principal}
          onChange={updateNumber(onPrincipalChange)}
        />
        <InputField
          label={copy.dualInvestment.buyLowPrice}
          suffix={belowSpot !== '--' ? `${belowSpot} ${copy.dualInvestment.below}` : 'BTC'}
          min="1"
          step="100"
          type="number"
          value={targetPrice}
          onChange={updateNumber(onTargetChange)}
        />
      </div>
      <div className="di-controls-apr">
        <span>{copy.dualInvestment.estimatedReward}</span>
        <strong>{estimateApr !== null ? `${format.apr(netAprAfterCouponFee(estimateApr))} APR` : '--'}</strong>
      </div>
    </section>
  );
}

export function ReferenceTable({
  market,
  rows,
  binanceProducts = [],
  binanceStatus = 'ready',
  activeTargetPrice,
  isFetching,
  onSelect,
  onRefresh,
  locale = DEFAULT_LOCALE,
}: {
  market?: OracleMarket;
  rows: DualInvestmentScanRow[];
  binanceProducts?: BinanceDualInvestmentProduct[];
  binanceStatus?: BinanceBenchmarkStatus;
  activeTargetPrice: number;
  isFetching: boolean;
  onSelect: (input: DualInvestmentInput) => void;
  onRefresh: () => void;
  locale?: Locale;
}) {
  const copy = copyForLocale(locale);
  const format = formattersForLocale(locale);
  const handleKey = (input: DualInvestmentInput) => (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(input);
    }
  };

  function binanceAprDisplay(match: BinanceDualInvestmentProduct | undefined) {
    if (binanceStatus === 'loading') return { className: 'muted-cell benchmark-status', label: copy.dualInvestment.binanceStatus.loading };
    if (binanceStatus === 'error')
      return { className: 'muted-cell benchmark-status is-error', label: copy.dualInvestment.binanceStatus.fetchError };
    if (!match) return { className: 'muted-cell benchmark-status', label: copy.dualInvestment.binanceStatus.noProduct };
    if (match.apr === null)
      return { className: 'muted-cell benchmark-status', label: copy.dualInvestment.binanceStatus.aprUnavailable };
    return { className: 'binance-apr', label: format.referenceApr(match.apr) };
  }

  function edgeDisplay(input: {
    displayApr: number | null;
    match: BinanceDualInvestmentProduct | undefined;
  }) {
    if (input.displayApr === null) return { className: 'muted-cell benchmark-status', label: '--' };
    if (binanceStatus === 'loading') return { className: 'muted-cell benchmark-status', label: copy.dualInvestment.binanceStatus.waiting };
    if (binanceStatus === 'error')
      return { className: 'muted-cell benchmark-status is-error', label: copy.dualInvestment.binanceStatus.noBenchmark };
    if (!input.match) return { className: 'muted-cell benchmark-status', label: copy.dualInvestment.binanceStatus.noProduct };
    if (input.match.apr === null)
      return { className: 'muted-cell benchmark-status', label: copy.dualInvestment.binanceStatus.noApr };
    const edge = input.displayApr - input.match.apr;
    return { className: `edge-cell ${edge >= 0 ? 'positive' : ''}`, label: formatEdge(edge, locale) };
  }

  return (
    <section className="di-reference" aria-label={copy.dualInvestment.aprReferenceLabel}>
      <div className="di-reference-head">
        <h3>{copy.dualInvestment.priceAprReference}</h3>
        <Button variant="secondary" onClick={onRefresh}>
          <RefreshCw size={15} />
          {isFetching ? copy.dualInvestment.updating : copy.dualInvestment.refresh}
        </Button>
      </div>
      <p className="di-reference-hint">{copy.dualInvestment.referenceHint}</p>
      <div className="table-shell">
        <table className="offer-table di-reference-table">
          <thead>
            <tr>
              <th>{copy.common.buyLow}</th>
              <th>{copy.dualInvestment.estApr}</th>
              <th>{copy.dualInvestment.binanceApr}</th>
              <th>{copy.dualInvestment.edge}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const displayMetrics = scanQuoteDisplayMetrics(row);
              const belowSpot = market
                ? `${formatBelowSpot(row.input.targetPrice, market.spot, locale)} ${copy.dualInvestment.below}`
                : '--';
              const binanceMatch = market
                ? findBinanceDualInvestmentMatch({
                    products: binanceProducts,
                    targetPrice: row.input.targetPrice,
                    settlementTimeMs: market.expiryMs,
                  })
                : undefined;
              const binanceApr = binanceAprDisplay(binanceMatch);
              const edge = edgeDisplay({ displayApr: displayMetrics.apr, match: binanceMatch });
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
                  <td data-label={copy.common.buyLow}>
                    <strong>{format.usd(row.input.targetPrice)}</strong>
                    <span>{belowSpot}</span>
                  </td>
                  <td className={displayMetrics.apr !== null ? 'apr-cell' : ''} data-label={copy.dualInvestment.estApr}>
                    {displayMetrics.apr !== null ? format.referenceApr(displayMetrics.apr) : '--'}
                  </td>
                  <td className={binanceApr.className} data-label={copy.dualInvestment.binanceApr}>
                    {binanceApr.label}
                  </td>
                  <td
                    className={edge.className}
                    data-label={copy.dualInvestment.edge}
                  >
                    {edge.label}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="di-reference-footnote">{copy.dualInvestment.referenceFootnote}</p>
      </div>
    </section>
  );
}
