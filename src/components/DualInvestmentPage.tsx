'use client';

import { Activity, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useDualInvestmentScan, buildVerifiedDualInvestmentQuote } from '../hooks/useDualInvestmentScan';
import { useMarketData } from '../hooks/useMarketData';
import { buildDualInvestmentScanInputs } from '../products/dualInvestmentScan';
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

      {!isTargetSale && <QuoteDetail quote={previewQuote} error={previewError} productInput={customInput} />}

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
