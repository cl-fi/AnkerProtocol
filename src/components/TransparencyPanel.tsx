import type { StructuredProductQuote } from '../products/types';

export function TransparencyPanel({ quote }: { quote: StructuredProductQuote | null }) {
  if (!quote) return <aside className="panel transparency">Loading DeepBook data...</aside>;
  return (
    <aside className="panel transparency">
      <div className="section-title">
        <h2>Predict Legs</h2>
        <span>DeepBook transparency</span>
      </div>
      <dl className="oracle-meta">
        <div>
          <dt>Oracle</dt>
          <dd>{quote.oracle.oracleId.slice(0, 10)}...</dd>
        </div>
        <div>
          <dt>Spot</dt>
          <dd>{quote.oracle.spot.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt>Forward</dt>
          <dd>{quote.oracle.forward.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt>Server lag</dt>
          <dd>{quote.oracle.serverLagSeconds}s</dd>
        </div>
      </dl>
      <div className="leg-list">
        {quote.legs.map((leg) => (
          <div className="leg-row" key={leg.id}>
            <div>
              <strong>{leg.description}</strong>
              <span>{leg.instrumentType}</span>
            </div>
            <div>
              <strong>{leg.askCost.toFixed(4)}</strong>
              <span>dUSDC</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
