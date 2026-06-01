import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { StructuredProductQuote } from '../products/types';

export function PayoffChart({ quote }: { quote: StructuredProductQuote | null }) {
  if (!quote) return <section className="panel chart-panel">Loading payoff...</section>;
  return (
    <section className="panel chart-panel">
      <div className="section-title">
        <h2>Payoff</h2>
        <span>Settlement simulation</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={quote.scenarios}>
          <XAxis dataKey="settlementPrice" tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="finalUsdc" stroke="#0f766e" strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
