'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildIndicativeDualInvestmentQuote,
  buildVerifiedDualInvestmentQuote,
  useDualInvestmentScan,
} from '../hooks/useDualInvestmentScan';
import { useBinanceDualInvestment } from '../hooks/useBinanceDualInvestment';
import { useMarketData } from '../hooks/useMarketData';
import { useSubscriptionFunds } from '../hooks/useSubscriptionFunds';
import { isDemoMode } from '../config/runtimeModes';
import { copyForLocale, DEFAULT_LOCALE, formattersForLocale, type Locale } from '../i18n';
import { buildAutoFloorDualInvestmentInput, buildDualInvestmentScanInputs } from '../products/dualInvestmentScan';
import { minQuotableTargetPrice } from '../products/dualInvestmentValidation';
import { isTenorTradingEnabled } from '../products/tenorMarkets';
import { DEFAULT_QUOTE_ENVELOPE_TTL_MS } from '../products/quoteEnvelope';
import type { DualInvestmentInput, OracleMarket, StructuredProductQuote } from '../products/types';
import { AppFooter } from './AppFooter';
import { AppHeader } from './AppHeader';
import { SnapshotBanner } from './SnapshotBanner';
import {
  BuyLowControls,
  DEFAULT_PRINCIPAL,
  DirectionPairBar,
  ReferenceTable,
  type DualInvestmentMode,
} from './DualInvestmentQuoteSections';
import { DualInvestmentAdvanced, DualInvestmentConfirm, ReturnOverview } from './DualInvestmentQuoteDetail';
import { SubscribeSuccessDialog } from './SubscribeSuccessDialog';
import type { ConfirmedSubscription } from './TargetBuyExecutionPanel';
import { Card } from '../ui';

export { QuoteRiskSummary } from './DualInvestmentQuoteSections';

const DEFAULT_LEG_COUNT = 6;

export function DualInvestmentPage({
  initialMode = 'buy-low',
  locale = DEFAULT_LOCALE,
}: {
  initialMode?: DualInvestmentMode;
  locale?: Locale;
}) {
  const mode = initialMode;
  const copy = copyForLocale(locale);
  const format = formattersForLocale(locale);
  const [selectedOracleId, setSelectedOracleId] = useState<string | undefined>();
  const marketQuery = useMarketData(selectedOracleId);
  const market = marketQuery.data?.market;
  const productOracles = marketQuery.data?.productOracles ?? [];
  const selectedSource = marketQuery.data?.selectedSource;
  const snapshot = marketQuery.data?.snapshot;
  const isSnapshotRow = selectedSource === 'snapshot';
  // Photograph model: snapshot rows freeze every clock at the capture instant.
  const frozenNowMs = isSnapshotRow ? snapshot?.capturedAtMs : undefined;
  const capturedAtLabel = snapshot ? format.time(snapshot.capturedAtMs) : '';
  const tradingEnabled = isTenorTradingEnabled({
    source: selectedSource,
    demoMode: isDemoMode(),
  });
  const scanEnabled = Boolean(market);
  const scanQuery = useDualInvestmentScan({
    market,
    principal: DEFAULT_PRINCIPAL,
    enabled: scanEnabled,
    nowMs: frozenNowMs,
  });
  // Photograph model: snapshot rows compare against the Binance benchmark captured
  // at the same instant — never a live benchmark stitched onto frozen prices.
  const liveBinanceQuery = useBinanceDualInvestment({ market, enabled: scanEnabled && !isSnapshotRow });
  const binanceProducts = isSnapshotRow ? (snapshot?.binanceProducts ?? []) : (liveBinanceQuery.data ?? []);
  const binanceStatus = isSnapshotRow
    ? 'ready'
    : liveBinanceQuery.isPending && !liveBinanceQuery.data
      ? 'loading'
      : liveBinanceQuery.isError
        ? 'error'
        : 'ready';

  const [principal, setPrincipal] = useState(DEFAULT_PRINCIPAL);
  const [targetPrice, setTargetPrice] = useState(0);
  const [legCount, setLegCount] = useState(DEFAULT_LEG_COUNT);
  const funds = useSubscriptionFunds();

  const [verifiedQuote, setVerifiedQuote] = useState<StructuredProductQuote | null>(null);
  const [verifiedKey, setVerifiedKey] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  // Subscribe success dialog state lives at page level: the execution panel
  // unmounts and remounts with live quote churn (auto-floor drift, re-verify),
  // and any dialog state kept inside it dies on the first panel refresh.
  const [confirmedSubscription, setConfirmedSubscription] = useState<ConfirmedSubscription | null>(null);
  const verifyIdRef = useRef(0);
  const seededOracleRef = useRef<string | undefined>();

  const sourceLabel = isSnapshotRow
    ? `${copy.common.snapshot} · ${copy.dayFallback.snapshotAsOf(capturedAtLabel)}`
    : copy.common.live;

  // Seed the default Buy Low target once per oracle (nearest grid step below spot).
  const defaultTarget = useMemo(() => {
    if (!market) return 0;
    return (
      buildDualInvestmentScanInputs({ market, principal: DEFAULT_PRINCIPAL, nowMs: frozenNowMs })[0]
        ?.targetPrice ?? 0
    );
  }, [market, frozenNowMs]);

  useEffect(() => {
    const oracleId = market?.oracleId;
    if (defaultTarget > 0 && oracleId && seededOracleRef.current !== oracleId) {
      seededOracleRef.current = oracleId;
      setTargetPrice(defaultTarget);
    }
  }, [defaultTarget, market?.oracleId]);

  // Lowest fillable Buy Low price — legs below it exceed Predict ask limits.
  const minTargetPrice = useMemo(
    () => (market ? minQuotableTargetPrice(market, frozenNowMs) : null),
    [market, frozenNowMs],
  );

  // Full product input (with auto floor) — null until the inputs make a valid Buy Low.
  const effectiveInput = useMemo<DualInvestmentInput | null>(() => {
    if (!market || !(principal > 0) || !(targetPrice > 0) || targetPrice >= market.spot) return null;
    if (minTargetPrice !== null && targetPrice < minTargetPrice) return null;
    return buildAutoFloorDualInvestmentInput({ market, principal, targetPrice, targetLegCount: legCount });
  }, [market, principal, targetPrice, legCount, minTargetPrice]);

  // Instant local estimate — drives the chart and headline numbers with no network round-trip.
  const estimateQuote = useMemo<StructuredProductQuote | null>(() => {
    if (!market || !effectiveInput) return null;
    try {
      return buildIndicativeDualInvestmentQuote({ market, productInput: effectiveInput, nowMs: frozenNowMs });
    } catch {
      return null;
    }
  }, [market, effectiveInput, frozenNowMs]);

  // Product identity only — do NOT include live oracle feed timestamps.
  // Including spot/svi timestamps unmounted TargetBuyExecutionPanel (and its
  // success-dialog state) every market poll (~15s), including mid-wallet-sign.
  const productKey = useMemo(() => {
    if (!market || !effectiveInput) return null;
    return [
      market.oracleId,
      effectiveInput.principal,
      effectiveInput.targetPrice,
      effectiveInput.floorPrice,
      effectiveInput.targetLegCount,
    ].join(':');
  }, [market, effectiveInput]);

  // Feed version used only to schedule background re-verify; never gates mount.
  const marketTickKey = useMemo(() => {
    if (!market) return null;
    return `${market.spotTimestampMs}:${market.sviTimestampMs}`;
  }, [market]);

  const runVerify = useCallback(async (productInput: DualInvestmentInput, key: string, oracle: OracleMarket) => {
    const id = verifyIdRef.current + 1;
    verifyIdRef.current = id;
    setIsVerifying(true);
    setVerifyError(null);
    try {
      const quote = await buildVerifiedDualInvestmentQuote({ oracle, productInput });
      if (verifyIdRef.current !== id) return;
      setVerifiedQuote(quote);
      setVerifiedKey(key);
    } catch (error) {
      if (verifyIdRef.current !== id) return;
      setVerifyError(error instanceof Error ? error.message : 'Live quote failed.');
    } finally {
      if (verifyIdRef.current === id) setIsVerifying(false);
    }
  }, []);

  // Debounced verification whenever the product inputs settle on a new combination.
  // Demo mode and non-tradable rows (Snapshot) stay on the local SVI estimate.
  useEffect(() => {
    if (!tradingEnabled) return undefined;
    if (!market || !effectiveInput || !productKey || verifiedKey === productKey) return undefined;
    const handle = window.setTimeout(() => {
      void runVerify(effectiveInput, productKey, market);
    }, 450);
    return () => window.clearTimeout(handle);
  }, [market, effectiveInput, productKey, verifiedKey, runVerify, tradingEnabled]);

  // Background refresh when the oracle feed moves — keeps the previous matched
  // quote mounted so the subscribe panel / success dialog is not torn down.
  useEffect(() => {
    if (!tradingEnabled) return undefined;
    if (!market || !effectiveInput || !productKey || !marketTickKey) return undefined;
    if (verifiedKey !== productKey) return undefined;
    const handle = window.setTimeout(() => {
      void runVerify(effectiveInput, productKey, market);
    }, 450);
    return () => window.clearTimeout(handle);
  }, [marketTickKey, market, effectiveInput, productKey, verifiedKey, runVerify, tradingEnabled]);

  // Keep the matched live quote fresh on the envelope TTL.
  useEffect(() => {
    if (!tradingEnabled) return undefined;
    if (!market || !effectiveInput || !productKey || verifiedKey !== productKey) return undefined;
    const handle = window.setTimeout(() => {
      void runVerify(effectiveInput, productKey, market);
    }, DEFAULT_QUOTE_ENVELOPE_TTL_MS);
    return () => window.clearTimeout(handle);
  }, [market, effectiveInput, productKey, verifiedKey, verifiedQuote, runVerify, tradingEnabled]);

  const matchedVerified = verifiedQuote && verifiedKey === productKey ? verifiedQuote : null;
  const displayQuote = matchedVerified ?? estimateQuote;
  const subscribeQuote = matchedVerified && matchedVerified.executable ? matchedVerified : null;
  const isEstimate = !matchedVerified;
  // Amount over the connected balance blocks subscribe at the input, not at
  // wallet preflight — the inline error under Amount explains the disabled CTA.
  const insufficientFunds = funds.balance !== null && principal > funds.balance;

  // Snapshot rows: the disabled button is the state (Q8) — copy explains why.
  const disabledAction = isSnapshotRow
    ? { label: copy.dayFallback.temporarilyUnavailable, note: copy.dayFallback.snapshotSubscribeNote }
    : undefined;

  const handleSelectPreset = useCallback((input: DualInvestmentInput) => {
    setTargetPrice(input.targetPrice);
  }, []);

  return (
    <main className="dual-page" id="dual-investment">
      <AppHeader activeProduct="dual-investment" locale={locale} />
      <SnapshotBanner locale={locale} visible={isSnapshotRow} capturedAtLabel={capturedAtLabel} />

      <section className="dual-hero calculation-hero">
        <div>
          <h1>{copy.dualInvestment.title}</h1>
          <p>{copy.dualInvestment.subtitle}</p>
        </div>
        <div className="di-hero-ticker">
          <span className="di-hero-label">
            {copy.dualInvestment.btcPrice}
            <span className={isSnapshotRow ? 'di-live-flag is-stale' : 'di-live-flag'}>
              <span className="di-live-dot" aria-hidden="true" />
              {sourceLabel}
            </span>
          </span>
          <strong>{market ? format.usd(market.spot) : '--'}</strong>
        </div>
      </section>

      <DirectionPairBar
        mode={mode}
        market={market}
        productOracles={productOracles}
        onSelectOracle={setSelectedOracleId}
        snapshotCapturedAtMs={snapshot?.capturedAtMs}
        locale={locale}
      />

      <div className="di-terminal">
        <div className="di-terminal-chart">
          {displayQuote && effectiveInput ? (
            <ReturnOverview quote={displayQuote} productInput={effectiveInput} estimated={isEstimate} locale={locale} />
          ) : (
            <Card as="article" className="return-overview-panel is-empty">
              <div className="return-overview-heading">
                <h3>
                  {market
                    ? copy.dualInvestment.returnOverviewTitle(format.shortDateTime(market.expiryMs))
                    : copy.dualInvestment.returnOverviewTitleFallback}
                </h3>
              </div>
              <p className="di-overview-empty">{copy.dualInvestment.emptyOverview}</p>
            </Card>
          )}
        </div>

        {/* Order ticket: reference ladder → inputs → settle + subscribe CTA.
            Look up price first, then size the order, then commit. */}
        <div className="di-terminal-side">
          <ReferenceTable
            market={market}
            rows={scanQuery.data ?? []}
            binanceProducts={binanceProducts}
            binanceStatus={binanceStatus}
            nowMs={frozenNowMs}
            activeTargetPrice={targetPrice}
            isFetching={marketQuery.isFetching}
            updatedAtMs={isSnapshotRow ? undefined : marketQuery.dataUpdatedAt || undefined}
            onSelect={handleSelectPreset}
            onRefresh={() => {
              // The ladder is derived locally from the market feed — refreshing
              // means re-pulling the feed (and its Binance benchmark), not
              // recomputing identical numbers from the same inputs.
              void marketQuery.refetch();
              if (!isSnapshotRow) void liveBinanceQuery.refetch();
            }}
            locale={locale}
          />
          <BuyLowControls
            market={market}
            principal={principal}
            targetPrice={targetPrice}
            minTargetPrice={minTargetPrice}
            maxTargetPrice={defaultTarget > 0 ? defaultTarget : null}
            availableBalance={funds.balance}
            onPrincipalChange={setPrincipal}
            onTargetChange={setTargetPrice}
            locale={locale}
          />
          {displayQuote && effectiveInput ? (
            <DualInvestmentConfirm
              quote={displayQuote}
              productInput={effectiveInput}
              subscribeQuote={subscribeQuote}
              isVerifying={isVerifying}
              insufficientFunds={insufficientFunds}
              onSubscribeSuccess={setConfirmedSubscription}
              error={verifyError}
              demoMode={!tradingEnabled}
              subscribeDisabledMessage={copy.demo.subscribeDisabled}
              disabledAction={disabledAction}
              locale={locale}
            />
          ) : null}
        </div>
      </div>

      {displayQuote && effectiveInput ? (
        <DualInvestmentAdvanced
          quote={displayQuote}
          legCount={legCount}
          onLegCountChange={setLegCount}
          locale={locale}
        />
      ) : null}

      {confirmedSubscription ? (
        <SubscribeSuccessDialog
          quote={confirmedSubscription.quote}
          digest={confirmedSubscription.digest}
          locale={locale}
          onClose={() => setConfirmedSubscription(null)}
        />
      ) : null}

      <AppFooter locale={locale} />
    </main>
  );
}
