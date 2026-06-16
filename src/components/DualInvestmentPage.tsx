'use client';

import { Activity, RefreshCw, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  findBinanceDualInvestmentMatch,
  type BinanceDualInvestmentProduct,
} from '../deepbook/binanceDualInvestment';
import { useBinanceDualInvestment } from '../hooks/useBinanceDualInvestment';
import { useDualInvestmentScan, buildVerifiedDualInvestmentQuote } from '../hooks/useDualInvestmentScan';
import { useMarketData } from '../hooks/useMarketData';
import type { PredictOracleListItem } from '../deepbook/predictServer';
import { buildDualInvestmentScanInputs, type DualInvestmentScanRow } from '../products/dualInvestmentScan';
import { formatTimeToExpiry } from '../products/timeFormat';
import type { DualInvestmentInput, OracleMarket, StructuredProductQuote } from '../products/types';
import { AppHeader } from './AppHeader';

const DEFAULT_PRINCIPAL = 1_000;
type DualInvestmentMode = 'target-buy' | 'target-sale';
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

function formatExpiryOption(oracle: PredictOracleListItem) {
  return `${formatTimeToExpiry(oracle.expiry)} | ${formatTime(oracle.expiry)}`;
}

function statusCopy(row: { status: DualInvestmentScanRow['status'] }) {
  if (row.status === 'live') return 'Live';
  if (row.status === 'no-coupon') return 'No coupon';
  return 'Unavailable';
}

function statusClass(row: { status: DualInvestmentScanRow['status'] }) {
  if (row.status === 'live') return 'quote-badge live';
  if (row.status === 'no-coupon') return 'quote-badge neutral';
  return 'quote-badge preview';
}

function DualInvestmentModeTabs({
  mode,
  onChange,
}: {
  mode: DualInvestmentMode;
  onChange: (mode: DualInvestmentMode) => void;
}) {
  return (
    <nav className="mode-tabs" aria-label="Dual Investment direction">
      <Link
        className={mode === 'target-buy' ? 'active' : ''}
        href="/app/dual-investment"
        onClick={() => onChange('target-buy')}
      >
        Target Buy
      </Link>
      <Link
        className={mode === 'target-sale' ? 'active' : ''}
        href="/app/dual-investment?mode=target-sale"
        onClick={() => onChange('target-sale')}
      >
        Target Sale
      </Link>
    </nav>
  );
}

function OracleSnapshot({
  market,
  productOracles,
  staleSnapshot,
  onSelectOracle,
}: {
  market?: OracleMarket;
  productOracles: PredictOracleListItem[];
  staleSnapshot?: boolean;
  onSelectOracle: (oracleId: string) => void;
}) {
  return (
    <section className="calculation-section oracle-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Live DeepBook Predict Oracle</span>
          <h2>Nearest BTC Expiry</h2>
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
          <span>Spot</span>
          <strong>{market ? formatPrice(market.spot) : '--'}</strong>
        </div>
        <div>
          <span>Forward</span>
          <strong>{market ? formatPrice(market.forward) : '--'}</strong>
        </div>
        <div>
          <span>Time to Expiry</span>
          <strong>{market ? formatTimeToExpiry(market.expiryMs) : '--'}</strong>
        </div>
        <div>
          <span>Settlement</span>
          <strong>{market ? formatTime(market.expiryMs) : '--'}</strong>
        </div>
        <div>
          <span>Strike Grid</span>
          <strong>{market ? `${formatPrice(market.minStrike)} / ${formatPrice(market.tickSize)}` : '--'}</strong>
        </div>
        <div>
          <span>Oracle Lag</span>
          <strong>{market ? `${market.serverLagSeconds}s` : '--'}</strong>
        </div>
      </div>
    </section>
  );
}

function ScanBoard({
  market,
  rows,
  isFetching,
  binanceProducts,
  isBinanceFetching,
  binanceError,
  updatedAt,
  onUse,
  onRefresh,
}: {
  market?: OracleMarket;
  rows: DualInvestmentScanRow[];
  isFetching: boolean;
  binanceProducts: BinanceDualInvestmentProduct[];
  isBinanceFetching: boolean;
  binanceError?: string;
  updatedAt?: number;
  onUse: (input: DualInvestmentInput) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="calculation-section" id="scan-board">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Auto Scan Board</span>
          <h2>Target Buy BTC Quotes</h2>
        </div>
        <button className="ghost-button" type="button" onClick={onRefresh}>
          <RefreshCw size={16} />
          {isFetching ? 'Refreshing' : 'Refresh'}
        </button>
      </div>
      <div className="scan-meta">
        <span>Default notional: {formatAmount(DEFAULT_PRINCIPAL)} dUSDC</span>
        <span>Default ladder: 6 Predict UP legs</span>
        <span>Filter: targets must be strictly below live spot</span>
        <span>Grid: nearest 500 dUSDC target below spot, then step down</span>
        <span>Binance compare: BTC/USDC Buy Low</span>
        <span>{isBinanceFetching ? 'Binance: refreshing' : binanceError ? 'Binance: unavailable' : 'Binance: live'}</span>
        <span>{updatedAt ? `Last quote: ${formatTime(updatedAt)}` : 'Waiting for live quote'}</span>
      </div>
      <div className="table-shell">
        <table className="offer-table scan-table">
          <thead>
            <tr>
              <th>Target Buy</th>
              <th>Below Spot</th>
              <th>Floor</th>
              <th>Legs</th>
              <th>Interval</th>
              <th>Coupon</th>
              <th>Anker APR</th>
              <th>Binance APR</th>
              <th>Edge</th>
              <th>Ask Cost</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const interval = (row.input.targetPrice - row.input.floorPrice) / (row.input.targetLegCount ?? 1);
              const binanceMatch = row.quote
                ? findBinanceDualInvestmentMatch({
                    products: binanceProducts,
                    targetPrice: row.input.targetPrice,
                    settlementTimeMs: row.quote.oracle.expiryMs,
                  })
                : undefined;
              const aprEdge = row.quote && binanceMatch ? row.quote.apr - binanceMatch.apr : undefined;
              return (
                <tr key={`${row.input.targetPrice}-${row.input.floorPrice}`}>
                  <td data-label="Target Buy">
                    <strong>{formatPrice(row.input.targetPrice)}</strong>
                    <span>BTC/dUSDC</span>
                  </td>
                  <td data-label="Below Spot">
                    {market ? `${formatBelowSpot(row.input.targetPrice, market.spot)} below` : '--'}
                  </td>
                  <td data-label="Floor">{formatPrice(row.input.floorPrice)}</td>
                  <td data-label="Legs">{row.input.targetLegCount}</td>
                  <td data-label="Interval">{formatPrice(interval)}</td>
                  <td data-label="Coupon">{row.quote ? `${formatAmount(row.quote.coupon)} dUSDC` : '--'}</td>
                  <td className={row.status === 'live' ? 'apr-cell' : ''} data-label="Anker APR">
                    {row.quote ? formatApr(row.quote.apr) : '--'}
                  </td>
                  <td data-label="Binance APR">
                    {binanceMatch ? (
                      <span className={binanceMatch.canPurchase ? 'binance-apr' : 'binance-apr muted'}>
                        {formatApr(binanceMatch.apr)}
                      </span>
                    ) : (
                      <span className="muted-cell">{binanceError ? 'Unavailable' : 'No match'}</span>
                    )}
                  </td>
                  <td
                    className={aprEdge !== undefined && aprEdge >= 0 ? 'edge-cell positive' : 'edge-cell'}
                    data-label="Edge"
                  >
                    {aprEdge !== undefined ? formatApr(aprEdge) : '--'}
                  </td>
                  <td data-label="Ask Cost">
                    {row.quote ? `${formatAmount(row.quote.totalLegCost)} dUSDC` : '--'}
                  </td>
                  <td data-label="Status">
                    <span className={statusClass(row)} title={row.error}>
                      {statusCopy(row)}
                    </span>
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

function TargetSaleComingSoon() {
  return (
    <section className="calculation-section coming-soon-section" id="target-sale">
      <div className="section-heading">
        <div>
          <span className="section-kicker">BTC Collateral Roadmap</span>
          <h2>Target Sale Coming Soon</h2>
        </div>
        <span className="quote-badge preview">Paused</span>
      </div>
      <div className="coming-soon-grid">
        <article className="detail-panel">
          <div className="detail-title">
            <h3>Testnet collateral: DBTC</h3>
            <span>DeepBook spot pair: DBTC/DBUSDC</span>
          </div>
          <p>
            DBTC exists on Sui testnet and DeepBook has a DBTC/DBUSDC pool, so the collateral path is available for a
            future execution flow.
          </p>
        </article>
        <article className="detail-panel">
          <div className="detail-title">
            <h3>Blocked by dUSDC-only Predict settlement</h3>
            <span>BTC yield needs settlement routing</span>
          </div>
          <p>
            A CEX-style high-sell product should return DBTC yield when BTC stays below target, and dUSDC proceeds when
            BTC settles above target. Current Predict legs mint and pay in dUSDC, so that BTC-denominated coupon needs an
            execution contract or native BTC-settled Predict support.
          </p>
        </article>
        <article className="detail-panel">
          <div className="detail-title">
            <h3>Roadmap condition</h3>
            <span>Then re-enable Target Sale</span>
          </div>
          <p>
            Bring this back when the product can accept DBTC cleanly, convert or settle coupon fairly, and expose slippage
            limits around DBTC/DBUSDC conversion.
          </p>
        </article>
      </div>
    </section>
  );
}

function CustomPreviewForm({
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
          <h2>Design Your Target Buy</h2>
        </div>
        <span className="price-context">Preview runs batched DeepBook devInspect</span>
      </div>
      <div className="custom-grid">
        <label>
          <span>Amount</span>
          <input min="1" step="1" type="number" value={customInput.principal} onChange={updateNumber('principal')} />
        </label>
        <label>
          <span>Target Buy Price</span>
          <input min="1" step="1" type="number" value={customInput.targetPrice} onChange={updateNumber('targetPrice')} />
        </label>
        <label>
          <span>Floor Price</span>
          <input min="1" step="1" type="number" value={customInput.floorPrice} onChange={updateNumber('floorPrice')} />
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

function formatQuotePrincipal(quote: StructuredProductQuote) {
  return `${formatAmount(quote.principal)} dUSDC`;
}

function QuoteDetail({
  quote,
  error,
}: {
  quote: StructuredProductQuote | null;
  error: string | null;
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
    </section>
  );
}

export function DualInvestmentPage({ initialMode = 'target-buy' }: { initialMode?: DualInvestmentMode }) {
  const [mode, setMode] = useState<DualInvestmentMode>(initialMode);
  const [selectedOracleId, setSelectedOracleId] = useState<string | undefined>();
  const marketQuery = useMarketData(selectedOracleId);
  const market = marketQuery.data?.market;
  const productOracles = marketQuery.data?.productOracles ?? [];
  const isTargetSale = mode === 'target-sale';
  const scanQuery = useDualInvestmentScan({
    market,
    principal: DEFAULT_PRINCIPAL,
    enabled: !isTargetSale,
  });
  const binanceQuery = useBinanceDualInvestment({ market, enabled: Boolean(market) && !isTargetSale });
  const defaultBuyInput = useMemo(() => {
    if (!market) {
      return {
        principal: DEFAULT_PRINCIPAL,
        targetPrice: 0,
        floorPrice: 0,
        targetLegCount: 6,
      };
    }
    return buildDualInvestmentScanInputs({ market, principal: DEFAULT_PRINCIPAL })[0];
  }, [market]);

  const [customInput, setCustomInput] = useState<DualInvestmentInput>(defaultBuyInput);
  const [previewQuote, setPreviewQuote] = useState<StructuredProductQuote | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (defaultBuyInput.targetPrice > 0) {
      setCustomInput(defaultBuyInput);
      setPreviewQuote(null);
      setPreviewError(null);
    }
  }, [defaultBuyInput]);

  useEffect(() => {
    setPreviewQuote(null);
    setPreviewError(null);
  }, [mode]);

  async function handlePreview() {
    if (!market) return;
    setIsPreviewing(true);
    setPreviewError(null);
    try {
      const quote = await buildVerifiedDualInvestmentQuote({
        oracle: market,
        productInput: customInput,
      });
      setPreviewQuote(quote);
    } catch (error) {
      setPreviewQuote(null);
      setPreviewError(error instanceof Error ? error.message : 'Live quote preview failed.');
    } finally {
      setIsPreviewing(false);
    }
  }

  return (
    <main className="dual-page" id="dual-investment">
      <AppHeader activeProduct="dual-investment" />

      <section className="dual-hero calculation-hero">
        <div>
          <span className="section-kicker">Real Quote Structured Product Scanner</span>
          <h1>Dual Investment Calculator</h1>
          {isTargetSale ? (
            <p>
              Target Sale is staged for a DBTC-collateral flow. It will return once BTC-denominated yield and dUSDC
              settlement can be routed without misquoting the product.
            </p>
          ) : (
            <p>
              Scan BTC target-buy structures from DeepBook Predict, then run a verified preview for custom target, floor,
              and payoff smoothness.
            </p>
          )}
        </div>
        <a className="primary-action" href={isTargetSale ? '#target-sale' : '#scan-board'}>
          View {isTargetSale ? 'Roadmap' : 'Scan Board'}
        </a>
      </section>

      <DualInvestmentModeTabs mode={mode} onChange={setMode} />

      <OracleSnapshot
        market={market}
        productOracles={productOracles}
        staleSnapshot={marketQuery.data?.staleSnapshot}
        onSelectOracle={setSelectedOracleId}
      />

      <div className="transparency-note calculation-note">
        <Activity size={18} />
        {isTargetSale ? (
          <span>
            Target Sale is staged for the DBTC collateral flow instead of showing a dUSDC-only quote that would misstate
            BTC-denominated yield.
          </span>
        ) : (
          <span>
            Scan rows refresh every 10 seconds and use real batched devInspect quotes. Failed rows are marked unavailable
            instead of falling back to heuristic APR.
          </span>
        )}
        <ShieldCheck size={18} />
      </div>

      {isTargetSale ? (
        <TargetSaleComingSoon />
      ) : (
        <>
          <ScanBoard
            market={market}
            rows={scanQuery.data ?? []}
            isFetching={scanQuery.isFetching || binanceQuery.isFetching}
            binanceProducts={binanceQuery.data ?? []}
            isBinanceFetching={binanceQuery.isFetching}
            binanceError={binanceQuery.error instanceof Error ? binanceQuery.error.message : undefined}
            updatedAt={scanQuery.dataUpdatedAt || undefined}
            onRefresh={() => {
              void scanQuery.refetch();
              void binanceQuery.refetch();
            }}
            onUse={(input) => {
              setCustomInput(input);
              setPreviewQuote(null);
              setPreviewError(null);
            }}
          />

          <CustomPreviewForm
            market={market}
            customInput={customInput}
            isPreviewing={isPreviewing}
            onChange={(input) => {
              setCustomInput(input);
              setPreviewQuote(null);
              setPreviewError(null);
            }}
            onPreview={handlePreview}
          />
        </>
      )}

      {!isTargetSale && <QuoteDetail quote={previewQuote} error={previewError} />}

      <div className="transparency-note calculation-note">
        <SlidersHorizontal size={18} />
        {isTargetSale ? (
          <span>
            Target Sale returns to the roadmap until DBTC collateral, BTC-denominated coupon conversion, and slippage
            limits can be represented as one fair execution flow.
          </span>
        ) : (
          <span>
            Anker Protocol compiles each custom quote into Predict UP legs. The final Subscribe transaction should re-check
            the quote with max-cost protection before minting.
          </span>
        )}
      </div>
    </main>
  );
}
