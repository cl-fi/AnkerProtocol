import type { StructuredProductQuote } from '../products/types';

export function ScenarioCards({ quote }: { quote: StructuredProductQuote | null }) {
  if (!quote) return null;
  return (
    <section className="scenario-grid">
      {quote.scenarios.slice(0, 3).map((scenario) => (
        <article className="panel scenario" key={scenario.settlementPrice}>
          <p className="label">{scenario.label}</p>
          <div className="scenario-values">
            <strong>{scenario.finalUsdc.toFixed(2)} dUSDC</strong>
            {scenario.btcEquivalent !== undefined && (
              <span>{scenario.btcEquivalent.toFixed(6)} BTC equivalent</span>
            )}
          </div>
          <small>{scenario.realizedLegIds.length} legs pay out</small>
        </article>
      ))}
    </section>
  );
}
