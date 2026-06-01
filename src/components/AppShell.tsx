import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { useEffect, useState } from 'react';
import { useMarketData } from '../hooks/useMarketData';
import {
  buildStructuredQuote,
  useDefaultStructuredQuoteState,
  type StructuredQuoteState,
} from '../hooks/useStructuredQuote';
import type { StructuredProductQuote } from '../products/types';
import { ProductBuilder } from './ProductBuilder';
import { QuoteSummary } from './QuoteSummary';
import { PayoffChart } from './PayoffChart';
import { ScenarioCards } from './ScenarioCards';
import { TransparencyPanel } from './TransparencyPanel';

export function AppShell() {
  const marketQuery = useMarketData();
  const market = marketQuery.data?.market;
  const defaults = useDefaultStructuredQuoteState(market?.spot ?? 73_000);
  const [state, setState] = useState<StructuredQuoteState>(defaults);
  const [quote, setQuote] = useState<StructuredProductQuote | null>(null);

  useEffect(() => setState(defaults), [defaults]);

  useEffect(() => {
    if (!market) return;
    let cancelled = false;
    buildStructuredQuote({ state, oracle: market }).then((nextQuote) => {
      if (!cancelled) setQuote(nextQuote);
    });
    return () => {
      cancelled = true;
    };
  }, [market, state]);

  return (
    <main className="workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">DeepHarbor</p>
          <h1>On-chain structured products powered by DeepBook Predict.</h1>
        </div>
        <ConnectButton />
      </header>
      {marketQuery.data?.staleSnapshot && (
        <div className="snapshot-banner">Showing stale snapshot because live market data is unavailable.</div>
      )}
      <div className="grid">
        <ProductBuilder state={state} spot={market?.spot ?? 73_000} onChange={setState} />
        <div className="middle-stack">
          <QuoteSummary quote={quote} />
          <ScenarioCards quote={quote} />
          <PayoffChart quote={quote} />
        </div>
        <TransparencyPanel quote={quote} />
      </div>
    </main>
  );
}
