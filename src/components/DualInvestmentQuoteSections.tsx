'use client';

import { Info, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import type { ChangeEvent, KeyboardEvent } from 'react';
import {
  findBinanceDualInvestmentMatch,
  type BinanceDualInvestmentMatchResult,
  type BinanceDualInvestmentProduct,
} from '../deepbook/binanceDualInvestment';
import { copyForLocale, DEFAULT_LOCALE, formattersForLocale, localizedPath, type Locale } from '../i18n';
import {
  displayTargetStepForMarket,
  TURBO_DISPLAY_TARGET_STEP,
  scanQuoteDisplayMetrics,
  isSubDayTenor,
  type DualInvestmentScanRow,
} from '../products/dualInvestmentScan';
import type { DualInvestmentInput, OracleMarket } from '../products/types';
import type { CuratedOracleListItem } from '../server/curatedOracles';
import { Button, InputField, Tabs, tabClassName } from '../ui';

export { QuoteRiskSummary } from './DualInvestmentQuoteDetail';

export const DEFAULT_PRINCIPAL = 500;
/** Quick-set deposit fractions of the connected balance — plus a Max chip. */
export const AMOUNT_FRACTIONS = [0.25, 0.5, 0.75];
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
        <span className="di-select-label">{copy.dualInvestment.settlementDate}</span>
        <label className="expiry-select">
          <select
            aria-label={copy.dualInvestment.settlementDate}
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
  minTargetPrice = null,
  maxTargetPrice = null,
  availableBalance = null,
  onPrincipalChange,
  onTargetChange,
  locale = DEFAULT_LOCALE,
}: {
  market?: OracleMarket;
  principal: number;
  targetPrice: number;
  /** Lowest fillable Buy Low price (legs below it exceed Predict ask limits). */
  minTargetPrice?: number | null;
  /** Top reference-ladder row — the slider's upper bound. */
  maxTargetPrice?: number | null;
  /** Connected wallet's subscribable dUSDC — drives the 25/50/75/Max chips. */
  availableBalance?: number | null;
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
  const targetStep = market ? displayTargetStepForMarket(market) : TURBO_DISPLAY_TARGET_STEP;
  // Slider rungs stay on the display ladder grid, so its floor is the lowest
  // fillable price rounded up to a rung.
  const sliderMin = minTargetPrice !== null ? Math.ceil(minTargetPrice / targetStep) * targetStep : null;
  const sliderMax = maxTargetPrice;
  const showSlider = Boolean(market) && sliderMin !== null && sliderMax !== null && sliderMin <= sliderMax;
  const targetTooLow = Boolean(market) && minTargetPrice !== null && targetPrice > 0 && targetPrice < minTargetPrice;
  // Percent chips only exist once a balance gives them a denominator; whole
  // dUSDC keeps chip amounts on the input's step=1 grid.
  const hasBalance = availableBalance !== null && availableBalance >= 1;
  const maxAmount = hasBalance ? Math.floor(availableBalance) : 0;
  const amountForFraction = (fraction: number) => Math.max(1, Math.floor(maxAmount * fraction));
  const insufficientBalance = availableBalance !== null && principal > availableBalance;

  return (
    <section className="di-controls" aria-label={copy.dualInvestment.setBuyLowLabel}>
      {/* Price first, amount second — mirrors the flow the ladder above starts
          (pick a price, then size the order), and keeps the balance readout on
          the panel's right edge, clear of the price column's label. */}
      <div className="di-controls-grid">
        <div className="di-control-col">
          <InputField
            label={copy.dualInvestment.buyLowPrice}
            suffix={belowSpot !== '--' ? `${belowSpot} ${copy.dualInvestment.below}` : 'BTC'}
            min={sliderMin !== null ? String(sliderMin) : '1'}
            step={String(targetStep)}
            type="number"
            value={targetPrice}
            onChange={updateNumber(onTargetChange)}
          />
          {showSlider ? (
            <div className="di-target-slider-wrap">
              <input
                type="range"
                className="di-target-slider"
                aria-label={copy.dualInvestment.buyLowPriceSlider}
                min={sliderMin as number}
                max={sliderMax as number}
                step={targetStep}
                value={Math.min(Math.max(targetPrice, sliderMin as number), sliderMax as number)}
                onChange={updateNumber(onTargetChange)}
              />
              <div className="di-slider-scale" aria-hidden="true">
                <span>{format.usd(sliderMin as number)}</span>
                <span>{format.usd(sliderMax as number)}</span>
              </div>
            </div>
          ) : null}
        </div>
        <div className="di-control-col">
          <InputField
            label={
              <>
                {copy.dualInvestment.amount}
                {hasBalance ? (
                  <span className="di-label-balance">
                    <strong>{format.fixedTokenAmount(availableBalance, 2)} dUSDC</strong>
                  </span>
                ) : null}
              </>
            }
            suffix="dUSDC"
            min="1"
            step="1"
            type="number"
            value={principal}
            onChange={updateNumber(onPrincipalChange)}
          />
          {hasBalance ? (
            <div className="di-amount-chips" role="group" aria-label={copy.dualInvestment.amountPresetsLabel}>
              {AMOUNT_FRACTIONS.map((fraction) => (
                <button
                  className={principal === amountForFraction(fraction) ? 'active' : ''}
                  key={fraction}
                  type="button"
                  onClick={() => onPrincipalChange(amountForFraction(fraction))}
                >
                  {Math.round(fraction * 100)}%
                </button>
              ))}
              <button
                className={principal === maxAmount ? 'active' : ''}
                type="button"
                onClick={() => onPrincipalChange(maxAmount)}
              >
                {copy.dualInvestment.maxAmount}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {insufficientBalance ? (
        <p className="di-target-error" role="alert">
          {copy.dualInvestment.insufficientBalance(format.fixedTokenAmount(availableBalance, 2))}
        </p>
      ) : null}
      {targetTooLow ? (
        <p className="di-target-error" role="alert">
          {copy.dualInvestment.targetBelowFillable(format.usd(minTargetPrice as number))}
        </p>
      ) : null}
    </section>
  );
}

export function ReferenceTable({
  market,
  rows,
  binanceProducts = [],
  binanceStatus = 'ready',
  nowMs,
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
  /** Clock for remaining-tenor bound and snapshot freeze; defaults to live now. */
  nowMs?: number;
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

  function binanceAprDisplay(match: BinanceDualInvestmentMatchResult) {
    if (binanceStatus === 'loading') return { className: 'muted-cell benchmark-status', label: copy.dualInvestment.binanceStatus.loading };
    if (binanceStatus === 'error')
      return { className: 'muted-cell benchmark-status is-error', label: copy.dualInvestment.binanceStatus.fetchError };
    if (match.kind !== 'matched') return { className: 'muted-cell benchmark-status', label: '--' };
    if (match.product.apr === null)
      return { className: 'muted-cell benchmark-status', label: copy.dualInvestment.binanceStatus.aprUnavailable };
    return {
      className: 'binance-apr',
      label: format.referenceApr(match.product.apr),
    };
  }

  function edgeDisplay(input: {
    displayApr: number | null;
    match: BinanceDualInvestmentMatchResult;
  }) {
    if (input.displayApr === null) return { className: 'muted-cell benchmark-status', label: '--' };
    if (binanceStatus === 'loading') return { className: 'muted-cell benchmark-status', label: copy.dualInvestment.binanceStatus.waiting };
    if (binanceStatus === 'error')
      return { className: 'muted-cell benchmark-status is-error', label: copy.dualInvestment.binanceStatus.noBenchmark };
    if (input.match.kind !== 'matched') return { className: 'muted-cell benchmark-status', label: '--' };
    if (input.match.product.apr === null)
      return { className: 'muted-cell benchmark-status', label: copy.dualInvestment.binanceStatus.noApr };
    const edge = input.displayApr - input.match.product.apr;
    return { className: `edge-cell ${edge >= 0 ? 'positive' : ''}`, label: formatEdge(edge, locale) };
  }

  const rowMatches = rows.map((row) =>
    market
      ? findBinanceDualInvestmentMatch({
          products: binanceProducts,
          targetPrice: row.input.targetPrice,
          settlementTimeMs: market.expiryMs,
          nowMs,
        })
      : ({ kind: 'no_product' } as const),
  );

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
              <th className="di-num-head">
                {yieldHeader}
                {subDay ? (
                  <span className="di-info-tip" data-tip={copy.dualInvestment.hourlyReferenceFootnote} tabIndex={0}>
                    <Info aria-label={copy.dualInvestment.hourlyReferenceFootnote} size={12} />
                  </span>
                ) : null}
              </th>
              {!subDay ? (
                <th className="di-num-head">
                  {copy.dualInvestment.binanceApr}
                  <span className="di-info-tip" data-tip={copy.dualInvestment.referenceFootnote} tabIndex={0}>
                    <Info aria-label={copy.dualInvestment.referenceFootnote} size={12} />
                  </span>
                </th>
              ) : null}
              {!subDay ? (
                <th className="di-num-head">
                  {copy.dualInvestment.edge}
                  <span className="di-info-tip" data-tip={copy.dualInvestment.edgeFootnote} tabIndex={0}>
                    <Info aria-label={copy.dualInvestment.edgeFootnote} size={12} />
                  </span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const displayMetrics = scanQuoteDisplayMetrics(row);
              const belowSpot = market
                ? `${formatBelowSpot(row.input.targetPrice, market.spot, locale)} ${copy.dualInvestment.below}`
                : '--';
              const binanceMatch = rowMatches[index];
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
      </div>
    </section>
  );
}
