'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildIndicativeDualInvestmentQuote,
  buildVerifiedDualInvestmentQuote,
  useDualInvestmentScan,
} from '../hooks/useDualInvestmentScan';
import { useBinanceDualInvestment } from '../hooks/useBinanceDualInvestment';
import { useMarketData } from '../hooks/useMarketData';
import { isDemoMode } from '../config/runtimeModes';
import { copyForLocale, DEFAULT_LOCALE, formattersForLocale, type Locale } from '../i18n';
import { buildAutoFloorDualInvestmentInput, buildDualInvestmentScanInputs } from '../products/dualInvestmentScan';
import {
  isProductLineTradingEnabled,
  type ProductLine,
} from '../products/productLineMarkets';
import { DEFAULT_QUOTE_ENVELOPE_TTL_MS } from '../products/quoteEnvelope';
import type { DualInvestmentInput, OracleMarket, StructuredProductQuote } from '../products/types';
import { AppFooter } from './AppFooter';
import { AppHeader } from './AppHeader';
import { DegradationBanner } from './DegradationBanner';
import {
  BuyLowControls,
  DEFAULT_PRINCIPAL,
  DirectionPairBar,
  ReferenceTable,
  type DualInvestmentMode,
} from './DualInvestmentQuoteSections';
import { DualInvestmentAdvanced, DualInvestmentConfirm, ReturnOverview } from './DualInvestmentQuoteDetail';
import { Card } from '../ui';

export { QuoteRiskSummary } from './DualInvestmentQuoteSections';

const DEFAULT_LEG_COUNT = 6;

export function DualInvestmentPage({
  initialMode = 'buy-low',
  locale = DEFAULT_LOCALE,
  productLine = 'turbo',
}: {
  initialMode?: DualInvestmentMode;
  locale?: Locale;
  productLine?: ProductLine;
}) {
  const mode = initialMode;
  const copy = copyForLocale(locale);
  const format = formattersForLocale(locale);
  const [selectedOracleId, setSelectedOracleId] = useState<string | undefined>();
  const marketQuery = useMarketData(selectedOracleId, productLine);
  const market = marketQuery.data?.market;
  const productOracles = marketQuery.data?.productOracles ?? [];
  const dataSourceKind = marketQuery.data?.dataSource ?? 'live';
  const fixtureDegraded = dataSourceKind === 'fixture';
  const tradingEnabled = isProductLineTradingEnabled({
    dataSourceKind,
    demoMode: isDemoMode(),
  });
  const scanQuery = useDualInvestmentScan({ market, principal: DEFAULT_PRINCIPAL, enabled: true });
  const binanceQuery = useBinanceDualInvestment({ market, enabled: true });
  const binanceStatus =
    binanceQuery.isPending && !binanceQuery.data ? 'loading' : binanceQuery.isError ? 'error' : 'ready';

  const [principal, setPrincipal] = useState(DEFAULT_PRINCIPAL);
  const [targetPrice, setTargetPrice] = useState(0);
  const [legCount, setLegCount] = useState(DEFAULT_LEG_COUNT);

  const [verifiedQuote, setVerifiedQuote] = useState<StructuredProductQuote | null>(null);
  const [verifiedKey, setVerifiedKey] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const verifyIdRef = useRef(0);
  const seededOracleRef = useRef<string | undefined>();

  const pageTitle = productLine === 'multi-day' ? copy.dualInvestment.multiDayTitle : copy.dualInvestment.title;
  const pageSubtitle =
    productLine === 'multi-day' ? copy.dualInvestment.multiDaySubtitle : copy.dualInvestment.subtitle;
  const activeProduct = productLine === 'multi-day' ? 'multi-day' : 'dual-investment';
  const sourceLabel = fixtureDegraded ? copy.degradation.sourceFixture : copy.common.live;

  // Seed the default Buy Low target once per oracle (nearest grid step below spot).
  const defaultTarget = useMemo(() => {
    if (!market) return 0;
    return buildDualInvestmentScanInputs({ market, principal: DEFAULT_PRINCIPAL })[0]?.targetPrice ?? 0;
  }, [market]);

  useEffect(() => {
    const oracleId = market?.oracleId;
    if (defaultTarget > 0 && oracleId && seededOracleRef.current !== oracleId) {
      seededOracleRef.current = oracleId;
      setTargetPrice(defaultTarget);
    }
  }, [defaultTarget, market?.oracleId]);

  // Full product input (with auto floor) — null until the inputs make a valid Buy Low.
  const effectiveInput = useMemo<DualInvestmentInput | null>(() => {
    if (!market || !(principal > 0) || !(targetPrice > 0) || targetPrice >= market.spot) return null;
    return buildAutoFloorDualInvestmentInput({ market, principal, targetPrice, targetLegCount: legCount });
  }, [market, principal, targetPrice, legCount]);

  // Instant local estimate — drives the chart and headline numbers with no network round-trip.
  const estimateQuote = useMemo<StructuredProductQuote | null>(() => {
    if (!market || !effectiveInput) return null;
    try {
      return buildIndicativeDualInvestmentQuote({ market, productInput: effectiveInput });
    } catch {
      return null;
    }
  }, [market, effectiveInput]);

  const currentKey = useMemo(() => {
    if (!market || !effectiveInput) return null;
    return [
      market.oracleId,
      market.spotTimestampMs,
      market.sviTimestampMs,
      effectiveInput.principal,
      effectiveInput.targetPrice,
      effectiveInput.floorPrice,
      effectiveInput.targetLegCount,
    ].join(':');
  }, [market, effectiveInput]);

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

  // Debounced verification whenever the inputs settle on a new combination.
  // Demo mode and D4 fixture degradation stay on the local SVI estimate.
  useEffect(() => {
    if (!tradingEnabled) return undefined;
    if (!market || !effectiveInput || !currentKey || verifiedKey === currentKey) return undefined;
    const handle = window.setTimeout(() => {
      void runVerify(effectiveInput, currentKey, market);
    }, 450);
    return () => window.clearTimeout(handle);
  }, [market, effectiveInput, currentKey, verifiedKey, runVerify, tradingEnabled]);

  // Keep the matched live quote fresh on the envelope TTL.
  useEffect(() => {
    if (!tradingEnabled) return undefined;
    if (!market || !effectiveInput || !currentKey || verifiedKey !== currentKey) return undefined;
    const handle = window.setTimeout(() => {
      void runVerify(effectiveInput, currentKey, market);
    }, DEFAULT_QUOTE_ENVELOPE_TTL_MS);
    return () => window.clearTimeout(handle);
  }, [market, effectiveInput, currentKey, verifiedKey, verifiedQuote, runVerify, tradingEnabled]);

  const matchedVerified = verifiedQuote && verifiedKey === currentKey ? verifiedQuote : null;
  const displayQuote = matchedVerified ?? estimateQuote;
  const subscribeQuote = matchedVerified && matchedVerified.executable ? matchedVerified : null;
  const isEstimate = !matchedVerified;
  const estimateApr = estimateQuote && estimateQuote.coupon > 0 ? estimateQuote.apr : null;
  const periodReturn =
    estimateQuote && estimateQuote.coupon > 0 && estimateQuote.principal > 0
      ? estimateQuote.coupon / estimateQuote.principal
      : null;

  const handleSelectPreset = useCallback((input: DualInvestmentInput) => {
    setTargetPrice(input.targetPrice);
  }, []);

  return (
    <main className="dual-page" id="dual-investment">
      <AppHeader activeProduct={activeProduct} locale={locale} />
      <DegradationBanner locale={locale} visible={fixtureDegraded} />

      <section className="dual-hero calculation-hero">
        <div>
          <h1>{pageTitle}</h1>
          <p>{pageSubtitle}</p>
        </div>
        <div className="di-hero-ticker">
          <span className="di-hero-label">
            {copy.dualInvestment.btcPrice}
            <span className={fixtureDegraded || marketQuery.data?.staleSnapshot ? 'di-live-flag is-stale' : 'di-live-flag'}>
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
        locale={locale}
      />

      <div className="di-terminal">
        <div className="di-terminal-chart">
          {displayQuote && effectiveInput ? (
            <ReturnOverview quote={displayQuote} productInput={effectiveInput} estimated={isEstimate} locale={locale} />
          ) : (
            <Card as="article" className="return-overview-panel is-empty">
              <div className="return-overview-heading">
                <div>
                  <h3>{copy.dualInvestment.returnOverview}</h3>
                  <p>{copy.dualInvestment.returnOverviewBody}</p>
                </div>
              </div>
              <p className="di-overview-empty">{copy.dualInvestment.emptyOverview}</p>
            </Card>
          )}
        </div>

        <div className="di-terminal-side">
          <ReferenceTable
            market={market}
            rows={scanQuery.data ?? []}
            binanceProducts={binanceQuery.data ?? []}
            binanceStatus={binanceStatus}
            activeTargetPrice={targetPrice}
            isFetching={scanQuery.isFetching}
            onSelect={handleSelectPreset}
            onRefresh={() => {
              void scanQuery.refetch();
            }}
            locale={locale}
          />
          <BuyLowControls
            market={market}
            principal={principal}
            targetPrice={targetPrice}
            estimateApr={estimateApr}
            periodReturn={periodReturn}
            onPrincipalChange={setPrincipal}
            onTargetChange={setTargetPrice}
            locale={locale}
          />
        </div>
      </div>

      {displayQuote && effectiveInput ? (
        <DualInvestmentConfirm
          quote={displayQuote}
          productInput={effectiveInput}
          subscribeQuote={subscribeQuote}
          isVerifying={isVerifying}
          error={verifyError}
          demoMode={!tradingEnabled}
          subscribeDisabledMessage={
            fixtureDegraded ? copy.degradation.subscribeDisabled : copy.demo.subscribeDisabled
          }
          locale={locale}
        />
      ) : null}

      {displayQuote && effectiveInput ? (
        <DualInvestmentAdvanced
          quote={displayQuote}
          legCount={legCount}
          onLegCountChange={setLegCount}
          locale={locale}
        />
      ) : null}

      {!tradingEnabled && fixtureDegraded ? (
        <p className="degradation-subscribe-note" role="status">
          {copy.degradation.subscribeDisabled}
        </p>
      ) : null}

      <AppFooter locale={locale} />
    </main>
  );
}
