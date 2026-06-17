'use client';

import { Activity, ShieldCheck, SlidersHorizontal, TrendingDown, TrendingUp } from 'lucide-react';
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CurrentUsdsuiAprSnapshot } from '../current/currentUsdsuiApr';
import type { PredictOracleListItem } from '../deepbook/predictServer';
import { useCurrentUsdsuiApr } from '../hooks/useCurrentUsdsuiApr';
import { buildVerifiedSharkFinQuote } from '../hooks/useSharkFinQuote';
import { useMarketData } from '../hooks/useMarketData';
import {
  buildSharkFinAprScenarios,
  buildSharkFinLegIntents,
  calculateSharkFinBudget,
} from '../products/sharkFin';
import { formatTimeToExpiry } from '../products/timeFormat';
import type {
  LegQuote,
  OracleMarket,
  ScenarioOutcome,
  SharkFinDirection,
  SharkFinInput,
  StructuredProductQuote,
} from '../products/types';
import { AppHeader } from './AppHeader';

const DEFAULT_PRINCIPAL = 1_000;
const DEFAULT_CURRENT_APR = 0.08;
const DEFAULT_BASE_APR = 0.02;
const PRICE_STEP = 500;
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

function roundToStep(value: number, step = PRICE_STEP) {
  return Math.round(value / step) * step;
}

function buildDefaultInput(
  market: OracleMarket | undefined,
  direction: SharkFinDirection,
  currentApr = DEFAULT_CURRENT_APR,
): SharkFinInput {
  if (!market) {
    return {
      principal: DEFAULT_PRINCIPAL,
      direction,
      currentApr,
      baseApr: DEFAULT_BASE_APR,
      lowerBound: 0,
      upperBound: 0,
      targetLegCount: 6,
    };
  }

  const spot = roundToStep(market.spot);
  const lowerBound =
    direction === 'bearish' ? Math.max(market.minStrike, roundToStep(spot * 0.9)) : Math.max(market.minStrike, spot);
  const upperBound = direction === 'bearish' ? spot : Math.max(spot + PRICE_STEP, roundToStep(spot * 1.1));

  return {
    principal: DEFAULT_PRINCIPAL,
    direction,
    currentApr,
    baseApr: DEFAULT_BASE_APR,
    lowerBound,
    upperBound,
    targetLegCount: 6,
  };
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
          <p className="price-context">Oracle selector: live-ready BTC markets only, filtered by Anker server wrapper.</p>
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

function DirectionSelector({
  direction,
  onChange,
}: {
  direction: SharkFinDirection;
  onChange: (direction: SharkFinDirection) => void;
}) {
  return (
    <section className="calculation-section shark-direction-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Product Direction</span>
          <h2>{direction === 'bullish' ? 'Bullish Shark Fin' : 'Bearish Shark Fin'}</h2>
        </div>
        <div className="direction-tabs shark-direction-tabs" role="group" aria-label="Shark Fin direction">
          <button
            className={direction === 'bullish' ? 'active' : ''}
            type="button"
            onClick={() => onChange('bullish')}
          >
            <TrendingUp size={16} />
            Bullish
          </button>
          <button
            className={direction === 'bearish' ? 'active' : ''}
            type="button"
            onClick={() => onChange('bearish')}
          >
            <TrendingDown size={16} />
            Bearish
          </button>
        </div>
      </div>
      <div className="shark-range-note">
        {direction === 'bullish'
          ? 'Base APR below the lower bound, then linear APR growth as BTC settles higher until the cap.'
          : 'Base APR above the upper bound, then linear APR growth as BTC settles lower until the cap.'}
      </div>
    </section>
  );
}

function CurrentAprCard({
  input,
  snapshot,
  isFetching,
  error,
}: {
  input: SharkFinInput;
  snapshot?: CurrentUsdsuiAprSnapshot;
  isFetching: boolean;
  error?: string;
}) {
  const sourceText = snapshot
    ? `Supply ${formatApr(snapshot.baseSupplyApr)} + rewards ${formatApr(snapshot.rewardApr)}`
    : error
      ? `Fallback ${formatApr(DEFAULT_CURRENT_APR)} - Current API unavailable`
      : isFetching
        ? 'Fetching from Current MainMarket...'
        : `Fallback ${formatApr(DEFAULT_CURRENT_APR)}`;

  return (
    <div className="readonly-metric current-apr-card" aria-label="Current USDsui APR">
      <span>Current USDsui APR</span>
      <strong>{formatApr(input.currentApr)}</strong>
      <small>{sourceText}</small>
      {snapshot && (
        <small>
          Updated {formatTime(snapshot.updatedAt)}
          {snapshot.supplyPaused ? ' | supply paused' : ''}
        </small>
      )}
    </div>
  );
}

function SharkFinBuilder({
  input,
  market,
  currentAprSnapshot,
  currentAprError,
  isCurrentAprFetching,
  isPreviewing,
  onChange,
  onPreview,
}: {
  input: SharkFinInput;
  market?: OracleMarket;
  currentAprSnapshot?: CurrentUsdsuiAprSnapshot;
  currentAprError?: string;
  isCurrentAprFetching: boolean;
  isPreviewing: boolean;
  onChange: (input: SharkFinInput) => void;
  onPreview: () => void;
}) {
  const updateNumber = (key: keyof SharkFinInput) => (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...input, [key]: Number(event.currentTarget.value) });
  };
  const updateApr = (key: 'baseApr') => (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...input, [key]: Number(event.currentTarget.value) / 100 });
  };
  const updateLegCount = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...input, targetLegCount: Number(event.currentTarget.value) });
  };

  return (
    <section className="calculation-section" id="shark-builder">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Custom Verified Preview</span>
          <h2>Build Principal Protected Shark Fin</h2>
        </div>
        <span className="price-context">Option budget is funded from projected Current USDsui yield</span>
      </div>
      <div className="custom-grid shark-custom-grid">
        <label>
          <span>Principal</span>
          <input min="1" step="1" type="number" value={input.principal} onChange={updateNumber('principal')} />
        </label>
        <CurrentAprCard
          input={input}
          snapshot={currentAprSnapshot}
          isFetching={isCurrentAprFetching}
          error={currentAprError}
        />
        <label>
          <span>Base APR</span>
          <input min="0" step="0.1" type="number" value={input.baseApr * 100} onChange={updateApr('baseApr')} />
        </label>
        <label>
          <span>Lower Bound</span>
          <input min="1" step="1" type="number" value={input.lowerBound} onChange={updateNumber('lowerBound')} />
        </label>
        <label>
          <span>Upper Bound</span>
          <input min="1" step="1" type="number" value={input.upperBound} onChange={updateNumber('upperBound')} />
        </label>
        <label>
          <span>Payoff Smoothness</span>
          <select value={input.targetLegCount ?? 6} onChange={updateLegCount}>
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

function asDisclosureLegs(input: SharkFinInput, market?: OracleMarket, quote?: StructuredProductQuote | null) {
  if (quote) return quote.legs;
  if (!market) return [];

  return buildSharkFinLegIntents(input, market).map(
    (leg): LegQuote => ({
      ...leg,
      askPrice: 0,
      askCost: 0,
      redeemPreview: 0,
      quoteTimestampMs: Date.now(),
      executable: false,
      error: 'Run Preview Live Quote to fetch exact DeepBook cost.',
    }),
  );
}

function SharkSummary({
  input,
  market,
  quote,
}: {
  input: SharkFinInput;
  market?: OracleMarket;
  quote: StructuredProductQuote | null;
}) {
  const fallbackBudget = market
    ? calculateSharkFinBudget(input, market)
    : { projectedCurrentYield: 0, baseCoupon: 0, optionBudget: 0 };
  const metrics = quote?.sharkFin;
  const maxApr = metrics?.maxApr ?? Math.max(input.currentApr, input.baseApr);
  const totalLegCost = quote?.totalLegCost ?? 0;

  return (
    <section className="quote-detail shark-summary-section">
      <div className="quote-summary shark-summary">
        <div>
          <span>Principal Protected</span>
          <strong>{formatAmount(input.principal)} USDsui</strong>
        </div>
        <div>
          <span>Current Yield</span>
          <strong>{formatAmount(metrics?.projectedCurrentYield ?? fallbackBudget.projectedCurrentYield)} USDsui</strong>
        </div>
        <div>
          <span>Option Budget</span>
          <strong>{formatAmount(metrics?.optionBudget ?? fallbackBudget.optionBudget)} USDsui</strong>
        </div>
        <div>
          <span>Ladder Cost</span>
          <strong>{formatAmount(totalLegCost)} USDsui</strong>
        </div>
        <div>
          <span>Base APR</span>
          <strong>{formatApr(input.baseApr)}</strong>
        </div>
        <div>
          <span>Max APR</span>
          <strong>{formatApr(maxApr)}</strong>
        </div>
      </div>
    </section>
  );
}

function AprTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: number | string;
  payload?: Array<{ payload: ScenarioOutcome }>;
}) {
  if (!active || !payload?.length) return null;
  const scenario = payload[0].payload;

  return (
    <div className="chart-tooltip">
      <strong>{formatPrice(Number(label))} BTC settlement</strong>
      <span>APR {formatApr(scenario.apr ?? 0)}</span>
      <span>Realized legs {scenario.realizedLegCount ?? 0}</span>
    </div>
  );
}

function AprCurve({
  input,
  market,
  quote,
}: {
  input: SharkFinInput;
  market?: OracleMarket;
  quote: StructuredProductQuote | null;
}) {
  const modeledLegs = asDisclosureLegs(input, market, quote);
  const maxApr = quote?.sharkFin?.maxApr ?? Math.max(input.currentApr, input.baseApr);
  const scenarios: ScenarioOutcome[] = quote?.scenarios ?? (market ? buildSharkFinAprScenarios(input, market, modeledLegs, maxApr) : []);

  return (
    <section className="quote-detail shark-chart-section">
      <div className="detail-grid shark-detail-grid">
        <article className="detail-panel">
          <div className="detail-title">
            <h3>APR Curve</h3>
            <span>{input.direction === 'bullish' ? 'Base to upside cap' : 'Base to downside cap'}</span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={scenarios}>
              <XAxis
                dataKey="settlementPrice"
                tick={{ fill: '#64756f', fontSize: 12 }}
                axisLine={{ stroke: '#d8e5df' }}
                tickLine={false}
                tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
              />
              <YAxis
                tick={{ fill: '#64756f', fontSize: 12 }}
                axisLine={{ stroke: '#d8e5df' }}
                tickLine={false}
                tickFormatter={(value) => `${(Number(value) * 100).toFixed(0)}%`}
              />
              {market && (
                <ReferenceLine
                  x={Math.round(market.spot)}
                  stroke="#d99a22"
                  strokeDasharray="4 4"
                  label={{ value: 'Spot', fill: '#9a6414', fontSize: 11 }}
                />
              )}
              {input.lowerBound > 0 && (
                <ReferenceLine
                  x={input.lowerBound}
                  stroke="#0f766e"
                  strokeDasharray="3 4"
                  label={{ value: 'Lower', fill: '#0f766e', fontSize: 11 }}
                />
              )}
              {input.upperBound > 0 && (
                <ReferenceLine
                  x={input.upperBound}
                  stroke="#0f766e"
                  strokeDasharray="3 4"
                  label={{ value: 'Upper', fill: '#0f766e', fontSize: 11 }}
                />
              )}
              <Tooltip content={<AprTooltip />} />
              <Line type="monotone" dataKey="apr" stroke="#0f766e" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </article>

        <article className="detail-panel">
          <div className="detail-title">
            <h3>{input.direction === 'bullish' ? 'UP Ladder' : 'DOWN Ladder'}</h3>
            <span>{quote ? 'Live devInspect cost' : 'Awaiting live quote'}</span>
          </div>
          <div className="leg-disclosure">
            {modeledLegs.map((leg) => (
              <div className="leg-disclosure-row" key={leg.id}>
                <div>
                  <strong>{leg.description}</strong>
                  <span>{formatAmount(leg.quantity)} USDsui payout</span>
                </div>
                <div>
                  <strong>{quote ? formatAmount(leg.askCost) : '--'}</strong>
                  <span>USDsui ask</span>
                </div>
              </div>
            ))}
            {modeledLegs.length === 0 && <div className="empty-preview">Set a valid lower and upper bound.</div>}
          </div>
          {quote?.warning && <div className="inline-warning">{quote.warning}</div>}
        </article>
      </div>
    </section>
  );
}

export function SharkFinPage() {
  const [direction, setDirection] = useState<SharkFinDirection>('bullish');
  const [selectedOracleId, setSelectedOracleId] = useState<string | undefined>();
  const marketQuery = useMarketData(selectedOracleId);
  const currentAprQuery = useCurrentUsdsuiApr();
  const market = marketQuery.data?.market;
  const productOracles = marketQuery.data?.productOracles ?? [];
  const fetchedCurrentApr = currentAprQuery.data?.totalApr ?? DEFAULT_CURRENT_APR;
  const currentAprError = currentAprQuery.error instanceof Error ? currentAprQuery.error.message : undefined;
  const defaultInput = useMemo(
    () => buildDefaultInput(market, direction, fetchedCurrentApr),
    [market?.oracleId, direction, fetchedCurrentApr],
  );
  const [productInput, setProductInput] = useState<SharkFinInput>(() => buildDefaultInput(undefined, 'bullish'));
  const [previewQuote, setPreviewQuote] = useState<StructuredProductQuote | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const autoPreviewKey = useRef('');
  const defaultStructureKey = useRef('');

  useEffect(() => {
    const key = `${market?.oracleId ?? 'none'}-${direction}`;
    if (defaultStructureKey.current === key) return;
    defaultStructureKey.current = key;
    if (defaultInput.lowerBound > 0 && defaultInput.upperBound > defaultInput.lowerBound) {
      setProductInput(defaultInput);
      setPreviewQuote(null);
      setPreviewError(null);
    }
  }, [market?.oracleId, direction, defaultInput]);

  useEffect(() => {
    setProductInput((current) => {
      if (Math.abs(current.currentApr - fetchedCurrentApr) < 0.000001) return current;
      return { ...current, currentApr: fetchedCurrentApr };
    });
    setPreviewQuote(null);
    setPreviewError(null);
  }, [fetchedCurrentApr]);

  async function handlePreview(input = productInput) {
    if (!market) return;
    setIsPreviewing(true);
    setPreviewError(null);
    try {
      const quote = await buildVerifiedSharkFinQuote({
        oracle: market,
        productInput: input,
      });
      setPreviewQuote(quote);
    } catch (error) {
      setPreviewQuote(null);
      setPreviewError(error instanceof Error ? error.message : 'Live quote preview failed.');
    } finally {
      setIsPreviewing(false);
    }
  }

  useEffect(() => {
    if (!market || productInput.lowerBound <= 0 || productInput.upperBound <= productInput.lowerBound) return;
    const key = `${market.oracleId}-${direction}-${productInput.currentApr.toFixed(8)}`;
    if (autoPreviewKey.current === key) return;
    autoPreviewKey.current = key;
    void handlePreview(productInput);
  }, [market?.oracleId, direction, productInput.lowerBound, productInput.upperBound, productInput.currentApr]);

  function handleDirection(nextDirection: SharkFinDirection) {
    setDirection(nextDirection);
    setPreviewQuote(null);
    setPreviewError(null);
    if (market) {
      setProductInput(buildDefaultInput(market, nextDirection, fetchedCurrentApr));
    }
  }

  return (
    <main className="dual-page" id="shark-fin">
      <AppHeader activeProduct="shark-fin" />

      <section className="dual-hero calculation-hero">
        <div>
          <span className="section-kicker">Principal Protected Yield Structure</span>
          <h1>USDsui Shark Fin</h1>
          <p>
            Principal stays protected by Current USDsui deposit yield. The excess yield buys DeepBook Predict ladders
            that turn bullish or bearish BTC settlement into a capped APR curve.
          </p>
        </div>
        <a className="primary-action" href="#shark-builder">
          Build Quote
        </a>
      </section>

      <DirectionSelector direction={direction} onChange={handleDirection} />

      <OracleSnapshot
        market={market}
        productOracles={productOracles}
        staleSnapshot={marketQuery.data?.staleSnapshot}
        onSelectOracle={setSelectedOracleId}
      />

      <div className="transparency-note calculation-note">
        <Activity size={18} />
        <span>
          Current USDsui APR is fetched from Current MainMarket when available, with 8% as the fallback. Base APR is
          reserved for the protected payoff, while the remaining term yield funds the UP or DOWN ladder.
        </span>
        <ShieldCheck size={18} />
      </div>

      <SharkFinBuilder
        input={productInput}
        market={market}
        currentAprSnapshot={currentAprQuery.data}
        currentAprError={currentAprError}
        isCurrentAprFetching={currentAprQuery.isFetching}
        isPreviewing={isPreviewing}
        onChange={(input) => {
          setProductInput(input);
          setPreviewQuote(null);
          setPreviewError(null);
        }}
        onPreview={() => void handlePreview()}
      />

      <SharkSummary input={productInput} market={market} quote={previewQuote} />

      {previewError && (
        <section className="quote-detail">
          <div className="detail-panel error-panel">{previewError}</div>
        </section>
      )}

      <AprCurve input={productInput} market={market} quote={previewQuote} />

      <div className="transparency-note calculation-note">
        <SlidersHorizontal size={18} />
        <span>
          This page intentionally stops at construction, quoting, APR curve, and leg disclosure. Vault shares and auto
          roll are deferred until Predict Manager position ownership is stable enough for a fair execution contract.
        </span>
      </div>
    </main>
  );
}
