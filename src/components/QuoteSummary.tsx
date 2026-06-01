import type { StructuredProductQuote } from '../products/types';

export function QuoteSummary({ quote }: { quote: StructuredProductQuote | null }) {
  if (!quote) return <section className="panel">Loading quote...</section>;
  return (
    <section className="panel quote-summary">
      <div>
        <p className="label">Estimated APR</p>
        <strong>{(quote.apr * 100).toFixed(2)}%</strong>
      </div>
      <div>
        <p className="label">Coupon / unused yield</p>
        <strong>{quote.coupon.toFixed(2)} dUSDC</strong>
      </div>
      <div>
        <p className="label">Leg cost</p>
        <strong>{quote.totalLegCost.toFixed(2)} dUSDC</strong>
      </div>
      <div className={quote.executable ? 'status good' : 'status warn'}>
        {quote.executable ? 'Executable quote' : 'Preview quote'}
      </div>
      {quote.warning && <p className="warning">{quote.warning}</p>}
    </section>
  );
}
