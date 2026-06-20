'use client';

import { Activity, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDualInvestmentScan, buildVerifiedDualInvestmentQuote } from '../hooks/useDualInvestmentScan';
import { useMarketData } from '../hooks/useMarketData';
import { buildAutoFloorDualInvestmentInput, buildDualInvestmentScanInputs } from '../products/dualInvestmentScan';
import { DEFAULT_QUOTE_ENVELOPE_TTL_MS } from '../products/quoteEnvelope';
import type { DualInvestmentInput, OracleMarket, StructuredProductQuote } from '../products/types';
import { AppHeader } from './AppHeader';
import {
  CustomPreviewForm,
  DEFAULT_PRINCIPAL,
  DualInvestmentModeTabs,
  OracleSnapshot,
  QuoteDetail,
  ScanBoard,
  TargetSaleComingSoon,
  type DualInvestmentMode,
} from './DualInvestmentQuoteSections';

export { QuoteRiskSummary } from './DualInvestmentQuoteSections';

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
  const [previewInput, setPreviewInput] = useState<DualInvestmentInput | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewUpdatedAt, setPreviewUpdatedAt] = useState<number | null>(null);
  const previewRequestIdRef = useRef(0);
  const defaultOracleIdRef = useRef<string | undefined>();
  const runPreviewRef = useRef<((options?: { preserveExisting?: boolean }) => Promise<void>) | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const oracleId = market?.oracleId;
    if (defaultBuyInput.targetPrice > 0 && oracleId && defaultOracleIdRef.current !== oracleId) {
      defaultOracleIdRef.current = oracleId;
      setCustomInput(defaultBuyInput);
      setPreviewQuote(null);
      setPreviewInput(null);
      setPreviewError(null);
      setPreviewUpdatedAt(null);
    }
  }, [defaultBuyInput, market?.oracleId]);

  useEffect(() => {
    previewRequestIdRef.current += 1;
    setPreviewQuote(null);
    setPreviewInput(null);
    setPreviewError(null);
    setPreviewUpdatedAt(null);
  }, [mode]);

  const runPreview = useCallback(async ({ preserveExisting = false }: { preserveExisting?: boolean } = {}) => {
    if (!market) return;
    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    const productInput = buildAutoFloorDualInvestmentInput({
      market,
      principal: customInput.principal,
      targetPrice: customInput.targetPrice,
      targetLegCount: customInput.targetLegCount,
    });
    setIsPreviewing(true);
    setPreviewError(null);
    try {
      const quote = await buildVerifiedDualInvestmentQuote({
        oracle: market,
        productInput,
      });
      if (previewRequestIdRef.current !== requestId) return;
      setCustomInput(productInput);
      setPreviewQuote(quote);
      setPreviewInput(productInput);
      setPreviewUpdatedAt(Date.now());
    } catch (error) {
      if (previewRequestIdRef.current !== requestId) return;
      if (!preserveExisting) {
        setPreviewQuote(null);
        setPreviewInput(null);
        setPreviewUpdatedAt(null);
      }
      setPreviewError(error instanceof Error ? error.message : 'Live quote preview failed.');
    } finally {
      if (previewRequestIdRef.current === requestId) {
        setIsPreviewing(false);
      }
    }
  }, [customInput, market]);

  useEffect(() => {
    runPreviewRef.current = runPreview;
  }, [runPreview]);

  useEffect(() => {
    if (!previewQuote || !previewUpdatedAt || isTargetSale) return undefined;
    const elapsedMs = Date.now() - previewUpdatedAt;
    const refreshTimer = window.setTimeout(() => {
      void runPreviewRef.current?.({ preserveExisting: true });
    }, Math.max(0, DEFAULT_QUOTE_ENVELOPE_TTL_MS - elapsedMs));

    return () => window.clearTimeout(refreshTimer);
  }, [isTargetSale, previewQuote, previewUpdatedAt]);

  function handlePreview() {
    void runPreview({ preserveExisting: Boolean(previewQuote) });
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
            Expiry selection and scan rows use oracle state with local SVI and vault utilization estimates for fast
            reference APR. Preview Live Quote still runs real batched devInspect before subscription.
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
            isFetching={scanQuery.isFetching}
            updatedAt={scanQuery.dataUpdatedAt || undefined}
            onRefresh={() => {
              void scanQuery.refetch();
            }}
            onUse={(input) => {
              previewRequestIdRef.current += 1;
              setCustomInput(input);
              setPreviewQuote(null);
              setPreviewInput(null);
              setPreviewError(null);
              setPreviewUpdatedAt(null);
            }}
          />

          <CustomPreviewForm
            market={market}
            customInput={customInput}
            isPreviewing={isPreviewing}
            onChange={(input) => {
              previewRequestIdRef.current += 1;
              setCustomInput(input);
              setPreviewQuote(null);
              setPreviewInput(null);
              setPreviewError(null);
              setPreviewUpdatedAt(null);
            }}
            onPreview={handlePreview}
          />
        </>
      )}

      {!isTargetSale && (
        <QuoteDetail
          quote={previewQuote}
          error={previewError}
          productInput={previewInput ?? customInput}
          isRefreshing={isPreviewing && Boolean(previewQuote)}
          updatedAt={previewUpdatedAt}
          autoRefreshMs={DEFAULT_QUOTE_ENVELOPE_TTL_MS}
        />
      )}

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
