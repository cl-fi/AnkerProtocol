'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildIndicativeDualInvestmentQuote,
  buildVerifiedDualInvestmentQuote,
  useDualInvestmentScan,
} from '../hooks/useDualInvestmentScan';
import { useBinanceDualInvestment } from '../hooks/useBinanceDualInvestment';
import { useMarketData } from '../hooks/useMarketData';
import { copyForLocale, DEFAULT_LOCALE, formattersForLocale, type Locale } from '../i18n';
import { buildAutoFloorDualInvestmentInput, buildDualInvestmentScanInputs } from '../products/dualInvestmentScan';
import { DEFAULT_QUOTE_ENVELOPE_TTL_MS } from '../products/quoteEnvelope';
import type { DualInvestmentInput, OracleMarket, StructuredProductQuote } from '../products/types';
import { AppHeader } from './AppHeader';
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
  const scanQuery = useDualInvestmentScan({ market, principal: DEFAULT_PRINCIPAL, enabled: true });
  const binanceQuery = useBinanceDualInvestment({ market, enabled: true });

  const [principal, setPrincipal] = useState(DEFAULT_PRINCIPAL);
  const [targetPrice, setTargetPrice] = useState(0);
  const [legCount, setLegCount] = useState(DEFAULT_LEG_COUNT);

  const [verifiedQuote, setVerifiedQuote] = useState<StructuredProductQuote | null>(null);
  const [verifiedKey, setVerifiedKey] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const verifyIdRef = useRef(0);
  const seededOracleRef = useRef<string | undefined>();

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
  useEffect(() => {
    if (!market || !effectiveInput || !currentKey || verifiedKey === currentKey) return undefined;
    const handle = window.setTimeout(() => {
      void runVerify(effectiveInput, currentKey, market);
    }, 450);
    return () => window.clearTimeout(handle);
  }, [market, effectiveInput, currentKey, verifiedKey, runVerify]);

  // Keep the matched live quote fresh on the envelope TTL.
  useEffect(() => {
    if (!market || !effectiveInput || !currentKey || verifiedKey !== currentKey) return undefined;
    const handle = window.setTimeout(() => {
      void runVerify(effectiveInput, currentKey, market);
    }, DEFAULT_QUOTE_ENVELOPE_TTL_MS);
    return () => window.clearTimeout(handle);
  }, [market, effectiveInput, currentKey, verifiedKey, verifiedQuote, runVerify]);

  const matchedVerified = verifiedQuote && verifiedKey === currentKey ? verifiedQuote : null;
  const displayQuote = matchedVerified ?? estimateQuote;
  const subscribeQuote = matchedVerified && matchedVerified.executable ? matchedVerified : null;
  const isEstimate = !matchedVerified;
  const estimateApr = estimateQuote && estimateQuote.coupon > 0 ? estimateQuote.apr : null;

  const handleSelectPreset = useCallback((input: DualInvestmentInput) => {
    setTargetPrice(input.targetPrice);
  }, []);

  return (
    <main className="dual-page" id="dual-investment">
      <AppHeader activeProduct="dual-investment" locale={locale} />

      <section className="dual-hero calculation-hero">
        <div>
          <h1>{copy.dualInvestment.title}</h1>
          <p>{copy.dualInvestment.subtitle}</p>
        </div>
        <div className="di-hero-ticker">
          <span className="di-hero-label">
            {copy.dualInvestment.btcPrice}
            <span className={marketQuery.data?.staleSnapshot ? 'di-live-flag is-stale' : 'di-live-flag'}>
              <span className="di-live-dot" aria-hidden="true" />
              {marketQuery.data?.staleSnapshot ? copy.common.snapshot : copy.common.live}
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
    </main>
  );
}
