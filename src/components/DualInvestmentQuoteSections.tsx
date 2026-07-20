'use client';

import { Info, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { MARKET_REFETCH_INTERVAL_MS } from '../hooks/useMarketData';
import {
  findBinanceDualInvestmentMatch,
  type BinanceDualInvestmentMatchResult,
  type BinanceDualInvestmentProduct,
} from '../deepbook/binanceDualInvestment';
import { copyForLocale, DEFAULT_LOCALE, formattersForLocale, localizedPath, type Locale } from '../i18n';
import { utcOffsetLabel } from '../i18n/formatters';
import {
  displayTargetStepForMarket,
  TURBO_DISPLAY_TARGET_STEP,
  scanQuoteDisplayMetrics,
  isSubDayTenor,
  type DualInvestmentScanRow,
} from '../products/dualInvestmentScan';
import type { DualInvestmentInput, OracleMarket } from '../products/types';
import type { CuratedOracleListItem } from '../server/curatedOracles';
import { InputField, MobileDisclosure, Tabs, tabClassName } from '../ui';
import { SettlementSelect } from './SettlementSelect';

export { QuoteRiskSummary } from './DualInvestmentQuoteDetail';

export const DEFAULT_PRINCIPAL = 500;
/** Quick-set deposit fractions of the connected balance — plus a Max chip. */
export const AMOUNT_FRACTIONS = [0.25, 0.5, 0.75];
/** Phone price chips show the top ladder rungs; the rest sit behind More. */
const PRICE_CHIP_COUNT = 4;
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

/** One ladder row's headline yield — APR for day tenors, bps for sub-day. */
function scanRowYieldLabel(row: DualInvestmentScanRow, locale: Locale) {
  const format = formattersForLocale(locale);
  const metrics = scanQuoteDisplayMetrics(row);
  return metrics.showApr
    ? metrics.apr !== null
      ? format.referenceApr(metrics.apr)
      : '--'
    : metrics.periodReturn !== null
      ? format.periodReturnBps(metrics.periodReturn)
      : '--';
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
  // Viewer-local UTC offset, always visible in the label — settlement times
  // are meaningless without knowing whose clock they're on.
  const settlementZone = productOracles[0] ? utcOffsetLabel(productOracles[0].expiry) : null;
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
        <span className="di-select-label">
          {copy.dualInvestment.settlementDate}
          {settlementZone ? <span className="di-zone-badge">{settlementZone}</span> : null}
        </span>
        <SettlementSelect
          value={market?.oracleId ?? ''}
          groups={[
            { key: 'day', label: dayGroupLabel, rows: dayRows },
            { key: 'hourly', label: copy.dayFallback.hourlyGroup, rows: hourlyRows },
          ]}
          onSelect={onSelectOracle}
          snapshotCapturedAtMs={snapshotCapturedAtMs}
          locale={locale}
        />
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
  ladderRows,
  ladderOpen = false,
  onLadderToggle,
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
  /** Scan ladder rungs — the phone-only quick-select chips under the price input. */
  ladderRows?: DualInvestmentScanRow[];
  /** Whether the full reference ladder is expanded (the More chip's state). */
  ladderOpen?: boolean;
  /** More chip tap — reveals/hides the full reference ladder below the ticket. */
  onLadderToggle?: () => void;
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
          {/* Phone-only ladder chips (desktop keeps the full reference table):
              the top rungs ride with the price input, so decision support sits
              exactly where the decision is typed. */}
          {ladderRows && ladderRows.length > 0 ? (
            <div className="di-price-chips" role="group" aria-label={copy.dualInvestment.priceChipsLabel}>
              {ladderRows.slice(0, PRICE_CHIP_COUNT).map((row) => (
                <button
                  className={row.input.targetPrice === targetPrice ? 'active' : ''}
                  key={row.input.targetPrice}
                  type="button"
                  onClick={() => onTargetChange(row.input.targetPrice)}
                >
                  <strong>{format.usd(row.input.targetPrice)}</strong>
                  <small>{scanRowYieldLabel(row, locale)}</small>
                </button>
              ))}
              {onLadderToggle ? (
                <button
                  className={ladderOpen ? 'di-chip-more active' : 'di-chip-more'}
                  type="button"
                  aria-expanded={ladderOpen}
                  onClick={onLadderToggle}
                >
                  {copy.dualInvestment.moreChip}
                </button>
              ) : null}
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

/** Countdown-ring refresh control. The ring fills over one market-poll interval
    and resets when fresh data lands — the cycle itself is the freshness signal;
    the precise age lives in the tooltip. The ring turns amber when the feed is
    more than two intervals old (failed polls). */
function AutoRefreshControl({
  updatedAtMs,
  isFetching,
  onRefresh,
  locale,
}: {
  updatedAtMs?: number;
  isFetching: boolean;
  onRefresh: () => void;
  locale: Locale;
}) {
  const copy = copyForLocale(locale);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const ageMs = updatedAtMs ? Math.max(0, nowMs - updatedAtMs) : null;
  const progress = ageMs === null ? 0 : Math.min(1, ageMs / MARKET_REFETCH_INTERVAL_MS);
  const isStale = ageMs !== null && ageMs > MARKET_REFETCH_INTERVAL_MS * 2;
  const ageSeconds = ageMs === null ? null : Math.floor(ageMs / 1_000);
  const ageLabel =
    ageSeconds === null
      ? null
      : ageSeconds < 60
        ? copy.dualInvestment.updatedSecondsAgo(ageSeconds)
        : copy.dualInvestment.updatedMinutesAgo(Math.floor(ageSeconds / 60));
  const tip = ageLabel
    ? `${ageLabel} · ${copy.dualInvestment.autoRefreshEvery(MARKET_REFETCH_INTERVAL_MS / 1_000)}`
    : copy.dualInvestment.refresh;
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  // One moving part at a time: the ring fills as the countdown; while a fetch
  // is in flight it becomes a spinning arc (icon stays put); fresh data resets it.
  const arcProgress = isFetching ? 0.25 : progress;
  return (
    <button
      type="button"
      className={['di-refresh-btn', isStale ? 'is-stale' : '', isFetching ? 'is-fetching' : '']
        .filter(Boolean)
        .join(' ')}
      aria-label={copy.dualInvestment.refresh}
      title={tip}
      onClick={onRefresh}
    >
      {updatedAtMs ? (
        <svg className="di-refresh-ring" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="di-refresh-ring-track" cx="12" cy="12" r={radius} />
          <g transform="rotate(-90 12 12)">
            <circle
              className="di-refresh-ring-progress"
              cx="12"
              cy="12"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - arcProgress)}
            />
          </g>
        </svg>
      ) : null}
      <RefreshCw size={13} aria-hidden="true" />
    </button>
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
  updatedAtMs,
  onSelect,
  onRefresh,
  className,
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
  /** Last successful market-feed fetch — powers the "Updated … ago" stamp. */
  updatedAtMs?: number;
  onSelect: (input: DualInvestmentInput) => void;
  onRefresh: () => void;
  className?: string;
  locale?: Locale;
}) {
  const copy = copyForLocale(locale);
  const format = formattersForLocale(locale);
  const [mobileReferenceOpen, setMobileReferenceOpen] = useState(false);
  const subDay = market ? isSubDayTenor(market.expiryMs) : false;
  const yieldHeader = subDay ? copy.dualInvestment.periodReturn : copy.dualInvestment.estApr;
  const selectInput = (input: DualInvestmentInput) => {
    onSelect(input);
    setMobileReferenceOpen(false);
  };
  const handleKey = (input: DualInvestmentInput) => (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectInput(input);
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
  const activeIndex = Math.max(
    0,
    rows.findIndex((row) => row.input.targetPrice === activeTargetPrice),
  );
  const activeRow = rows[activeIndex];
  const activeMetrics = activeRow ? scanQuoteDisplayMetrics(activeRow) : null;
  const activeYield = activeRow ? scanRowYieldLabel(activeRow, locale) : '--';
  const activeEdge =
    !subDay && activeMetrics
      ? edgeDisplay({ displayApr: activeMetrics.apr, match: rowMatches[activeIndex] ?? { kind: 'no_product' } }).label
      : null;

  return (
    <section
      className={['di-reference', className].filter(Boolean).join(' ')}
      aria-label={subDay ? copy.dualInvestment.periodReturn : copy.dualInvestment.aprReferenceLabel}
    >
      <div className="di-reference-head">
        <h3>{subDay ? copy.dualInvestment.priceYieldReference : copy.dualInvestment.priceAprReference}</h3>
        <AutoRefreshControl
          updatedAtMs={updatedAtMs}
          isFetching={isFetching}
          onRefresh={onRefresh}
          locale={locale}
        />
      </div>
      <p className="di-reference-hint">{copy.dualInvestment.referenceHint}</p>
      <MobileDisclosure
        className="di-reference-disclosure"
        contentClassName="table-shell"
        open={mobileReferenceOpen}
        onOpenChange={setMobileReferenceOpen}
        expandLabel={copy.dualInvestment.showPriceReference}
        collapseLabel={copy.dualInvestment.hidePriceReference}
        summary={
          <span className="di-reference-mobile-summary">
            <span>
              <small>{copy.dualInvestment.currentReference}</small>
              <strong>{activeRow ? format.usd(activeRow.input.targetPrice) : '--'}</strong>
            </span>
            <span>
              <small>{yieldHeader}</small>
              <strong>{activeYield}</strong>
            </span>
            {activeEdge && activeEdge !== '--' ? (
              <span>
                <small>{copy.dualInvestment.edge}</small>
                <strong>{activeEdge}</strong>
              </span>
            ) : null}
          </span>
        }
      >
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
              const yieldLabel = scanRowYieldLabel(row, locale);
              return (
                <tr
                  className={isActive ? 'selected' : ''}
                  key={`${row.input.targetPrice}-${row.input.floorPrice}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  onClick={() => selectInput(row.input)}
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
      </MobileDisclosure>
    </section>
  );
}
