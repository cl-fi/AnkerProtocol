'use client';

import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { findBinanceDualInvestmentMatch, type BinanceDualInvestmentProduct } from '../deepbook/binanceDualInvestment';
import { copyForLocale, DEFAULT_LOCALE, formattersForLocale, localizedPath, type Locale } from '../i18n';
import {
  displayTargetStepForMarket,
  TURBO_DISPLAY_TARGET_STEP,
  scanQuoteDisplayMetrics,
  isSubDayTenor,
  type DualInvestmentScanRow,
} from '../products/dualInvestmentScan';
import { netAprAfterCouponFee } from '../products/feePolicy';
import type { DualInvestmentInput, OracleMarket } from '../products/types';
import type { CuratedOracleListItem } from '../server/curatedOracles';
import { Button, InputField, Tabs, tabClassName } from '../ui';

export { QuoteRiskSummary } from './DualInvestmentQuoteDetail';

export const DEFAULT_PRINCIPAL = 5;
export type DualInvestmentMode = 'buy-low';
export type BinanceBenchmarkStatus = 'loading' | 'error' | 'ready';

const EXPECTED_HOURLY_TENORS = 3;

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

function formatExpiryOption(oracle: CuratedOracleListItem, locale: Locale, snapshotCapturedAtMs?: number) {
  const format = formattersForLocale(locale);
  // Snapshot rows freeze their countdown at the capture instant (photograph model).
  const timeToExpiry =
    oracle.source === 'snapshot' && snapshotCapturedAtMs
      ? format.timeToExpiry(oracle.expiry, snapshotCapturedAtMs)
      : format.timeToExpiry(oracle.expiry);
  return `${timeToExpiry} · ${format.time(oracle.expiry)}`;
}

export function DirectionPairBar({
  mode,
  market,
  productOracles,
  onSelectOracle,
  snapshotCapturedAtMs,
  locale = DEFAULT_LOCALE,
}: {
  mode: DualInvestmentMode;
  market?: OracleMarket;
  productOracles: CuratedOracleListItem[];
  onSelectOracle: (oracleId: string) => void;
  snapshotCapturedAtMs?: number;
  locale?: Locale;
}) {
  const copy = copyForLocale(locale);
  const dayRows = productOracles.filter((oracle) => oracle.group === 'day');
  const hourlyRows = productOracles.filter((oracle) => oracle.group !== 'day');
  const dayGroupLabel =
    dayRows[0]?.source === 'live' ? copy.dayFallback.dayGroupLive : copy.dayFallback.dayGroupSnapshot;
  const showSparseTenorsHint = hourlyRows.length > 0 && hourlyRows.length < EXPECTED_HOURLY_TENORS;

  const renderOption = (oracle: CuratedOracleListItem) => (
    <option value={oracle.oracle_id} key={oracle.oracle_id}>
      {formatExpiryOption(oracle, locale, snapshotCapturedAtMs)}
    </option>
  );
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
        <span className="di-select-label">{copy.dualInvestment.tenor}</span>
        <label className="expiry-select">
          <select
            aria-label={copy.dualInvestment.tenor}
            value={market?.oracleId ?? ''}
            onChange={(event) => onSelectOracle(event.currentTarget.value)}
          >
            {dayRows.length > 0 ? <optgroup label={dayGroupLabel}>{dayRows.map(renderOption)}</optgroup> : null}
            {hourlyRows.length > 0 ? (
              <optgroup label={copy.dayFallback.hourlyGroup}>{hourlyRows.map(renderOption)}</optgroup>
            ) : null}
          </select>
        </label>
        {showSparseTenorsHint ? <p className="di-tenor-hint">{copy.dualInvestment.sparseTenorsHint}</p> : null}
      </div>
    </section>
  );
}

export function BuyLowControls({
  market,
  principal,
  targetPrice,
  estimateApr,
  periodReturn = null,
  onPrincipalChange,
  onTargetChange,
  locale = DEFAULT_LOCALE,
}: {
  market?: OracleMarket;
  principal: number;
  targetPrice: number;
  estimateApr: number | null;
  periodReturn?: number | null;
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
  const subDay = market ? isSubDayTenor(market.expiryMs) : false;
  const rewardLabel = subDay
    ? periodReturn !== null
      ? format.periodReturnBps(periodReturn)
      : '--'
    : estimateApr !== null
      ? `${format.apr(netAprAfterCouponFee(estimateApr))} APR`
      : '--';
  const referenceApr = subDay && estimateApr !== null ? netAprAfterCouponFee(estimateApr) : null;
  const targetStep = market ? displayTargetStepForMarket(market) : TURBO_DISPLAY_TARGET_STEP;

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
          step={String(targetStep)}
          type="number"
          value={targetPrice}
          onChange={updateNumber(onTargetChange)}
        />
      </div>
      <div className="di-controls-apr">
        <span>{subDay ? copy.dualInvestment.periodReturn : copy.dualInvestment.estimatedReward}</span>
        <div className="di-controls-apr-values">
          <strong>{rewardLabel}</strong>
          {referenceApr !== null ? (
            <span className="di-ref-apr">{copy.dualInvestment.referenceApr(format.referenceApr(referenceApr))}</span>
          ) : null}
        </div>
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
  const subDay = market ? isSubDayTenor(market.expiryMs) : false;
  const yieldHeader = subDay ? copy.dualInvestment.periodReturn : copy.dualInvestment.estApr;
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
    <section className="di-reference" aria-label={subDay ? copy.dualInvestment.periodReturn : copy.dualInvestment.aprReferenceLabel}>
      <div className="di-reference-head">
        <h3>{subDay ? copy.dualInvestment.priceYieldReference : copy.dualInvestment.priceAprReference}</h3>
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
              <th>{yieldHeader}</th>
              {!subDay ? <th>{copy.dualInvestment.binanceApr}</th> : null}
              {!subDay ? <th>{copy.dualInvestment.edge}</th> : null}
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
              const yieldLabel = displayMetrics.showApr
                ? displayMetrics.apr !== null
                  ? format.referenceApr(displayMetrics.apr)
                  : '--'
                : displayMetrics.periodReturn !== null
                  ? format.periodReturnBps(displayMetrics.periodReturn)
                  : '--';
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
                  <td
                    className={displayMetrics.showApr && displayMetrics.apr !== null ? 'apr-cell' : ''}
                    data-label={yieldHeader}
                  >
                    <strong className="di-yield-primary">{yieldLabel}</strong>
                    {!displayMetrics.showApr && displayMetrics.referenceApr !== null ? (
                      <span className="di-ref-apr">
                        {copy.dualInvestment.referenceApr(format.referenceApr(displayMetrics.referenceApr))}
                      </span>
                    ) : null}
                  </td>
                  {!subDay ? (
                    <td className={binanceApr.className} data-label={copy.dualInvestment.binanceApr}>
                      {binanceApr.label}
                    </td>
                  ) : null}
                  {!subDay ? (
                    <td className={edge.className} data-label={copy.dualInvestment.edge}>
                      {edge.label}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="di-reference-footnote">
          {subDay ? copy.dualInvestment.hourlyReferenceFootnote : copy.dualInvestment.referenceFootnote}
        </p>
      </div>
    </section>
  );
}
