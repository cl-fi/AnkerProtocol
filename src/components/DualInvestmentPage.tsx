import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { ChevronRight, Grid2X2, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMarketData } from '../hooks/useMarketData';
import { buildStructuredQuote } from '../hooks/useStructuredQuote';
import type { OracleMarket, StructuredProductQuote } from '../products/types';

interface DualOffer {
  id: string;
  targetPrice: number;
  floorPrice: number;
  quote: StructuredProductQuote | null;
}

const principal = 1_000;
const stepSize = 500;

function formatPrice(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatApr(value: number) {
  return `${(value * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit' }).format(value);
}

function daysToExpiry(expiryMs: number) {
  const days = Math.ceil(Math.max(0, expiryMs - Date.now()) / 86_400_000);
  return days <= 1 ? '< 1 Day' : `${days} Days`;
}

function buildOfferInputs(market: OracleMarket) {
  return [1.005, 1.01, 1.015, 1.02, 1.03].map((ratio) => {
    const targetPrice = Math.round(market.spot * ratio);
    return {
      id: `${targetPrice}`,
      targetPrice,
      floorPrice: targetPrice - stepSize * 2,
    };
  });
}

function ProductNav() {
  return (
    <nav className="product-nav" aria-label="Products">
      <a className="active" href="#dual-investment">
        Dual Investment
      </a>
      <a href="#shark-fin" aria-disabled="true">
        Shark Fin
      </a>
      <a href="#templates" aria-disabled="true">
        Templates
      </a>
      <a href="#auto-roll" aria-disabled="true">
        Auto Roll
      </a>
    </nav>
  );
}

function PageSection({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="product-section">
      <div className="section-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function AssetSelector({ market }: { market?: OracleMarket }) {
  return (
    <PageSection title="Choose an Asset">
      <div className="asset-controls">
        <label className="asset-search">
          <Search size={18} />
          <input value="BTC" readOnly aria-label="Search coin" />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" />
          Match My Target Assets
        </label>
      </div>
      <div className="asset-grid">
        <button className="asset-tile selected" type="button">
          <span className="asset-status">LIVE</span>
          <span className="asset-symbol">BTC</span>
          <strong>BTC</strong>
          <small>{market ? `${formatApr(0.0365)} - ${formatApr(0.185)}` : 'Loading market'}</small>
        </button>
        <button className="asset-tile disabled" type="button" disabled>
          <span className="asset-symbol muted">ETH</span>
          <strong>ETH</strong>
          <small>Coming later</small>
        </button>
        <button className="asset-tile disabled" type="button" disabled>
          <span className="asset-symbol muted">SUI</span>
          <strong>SUI</strong>
          <small>Coming later</small>
        </button>
        <button className="asset-tile disabled" type="button" disabled>
          <Grid2X2 size={24} />
          <strong>All Assets</strong>
        </button>
      </div>
    </PageSection>
  );
}

function PairSelector({ market }: { market?: OracleMarket }) {
  return (
    <PageSection title="Choose a Pair">
      <div className="pair-strip">
        <div className="pair-main">
          <span className="coin-dot">BTC</span>
          <div>
            <strong>BTC / dUSDC</strong>
            <span>Target-buy BTC using DeepBook Predict legs</span>
          </div>
        </div>
        <div className="pair-stat">
          <span>Current Price</span>
          <strong>{market ? formatPrice(market.spot) : '--'}</strong>
        </div>
        <div className="pair-stat">
          <span>Forward</span>
          <strong>{market ? formatPrice(market.forward) : '--'}</strong>
        </div>
        <div className="pair-stat">
          <span>Oracle Lag</span>
          <strong>{market ? `${market.serverLagSeconds}s` : '--'}</strong>
        </div>
      </div>
    </PageSection>
  );
}

function DirectionSelector() {
  return (
    <PageSection
      title="Choose a Direction"
      action={<span className="price-context">BTC/dUSDC Current Price</span>}
    >
      <div className="direction-tabs" role="tablist" aria-label="Direction">
        <button className="active" type="button" role="tab" aria-selected="true">
          Buy Low
        </button>
        <button type="button" role="tab" aria-selected="false" disabled>
          Sell High
        </button>
      </div>
    </PageSection>
  );
}

function FilterBar() {
  const filters = ['All Settlement Dates', '< 3 Days', '< 7 Days', '7 - 30 Days', '30 - 60 Days', '> 60 Days'];
  return (
    <div className="filter-bar">
      {filters.map((filter, index) => (
        <button className={index === 0 ? 'active' : ''} type="button" key={filter}>
          {filter}
        </button>
      ))}
    </div>
  );
}

function OfferTable({
  offers,
  selectedId,
  onSelect,
  market,
}: {
  offers: DualOffer[];
  selectedId: string | null;
  onSelect: (offer: DualOffer) => void;
  market?: OracleMarket;
}) {
  return (
    <section className="offer-section">
      <FilterBar />
      <div className="table-shell">
        <table className="offer-table">
          <thead>
            <tr>
              <th>Target Price (BTC/dUSDC)</th>
              <th>APR</th>
              <th>Settlement Date</th>
              <th>Floor</th>
              <th>DeepBook Quote</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => {
              const quote = offer.quote;
              return (
                <tr
                  className={selectedId === offer.id ? 'selected' : ''}
                  key={offer.id}
                  onClick={() => onSelect(offer)}
                >
                  <td data-label="Target Price">
                    <strong>{formatPrice(offer.targetPrice)}</strong>
                    <span>BTC/dUSDC</span>
                  </td>
                  <td className="apr-cell" data-label="APR">
                    {quote ? formatApr(quote.apr) : 'Loading'}
                  </td>
                  <td data-label="Settlement Date">
                    <strong>{market ? formatDate(market.expiryMs) : '--'}</strong>
                    <span>{market ? daysToExpiry(market.expiryMs) : '--'}</span>
                  </td>
                  <td data-label="Floor">{formatPrice(offer.floorPrice)}</td>
                  <td data-label="DeepBook Quote">
                    <span className={quote?.executable ? 'quote-badge live' : 'quote-badge preview'}>
                      {quote?.executable ? 'Executable' : 'Preview'}
                    </span>
                  </td>
                  <td data-label="Action">
                    <button className="subscribe-button" type="button">
                      Subscribe
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="pagination-row">
        <span className="active">1</span>
        <span>2</span>
        <span>3</span>
        <span>4</span>
        <span>5</span>
        <span>...</span>
        <span>12</span>
        <ChevronRight size={15} />
      </div>
    </section>
  );
}

function QuoteDetail({ quote }: { quote: StructuredProductQuote | null }) {
  if (!quote) {
    return (
      <section className="quote-detail">
        <div className="detail-panel">Loading DeepBook quote...</div>
      </section>
    );
  }

  return (
    <section className="quote-detail">
      <div className="quote-summary">
        <div>
          <span>Target Buy BTC</span>
          <strong>{formatPrice(quote.principal)} dUSDC</strong>
        </div>
        <div>
          <span>Coupon</span>
          <strong>{quote.coupon.toFixed(2)} dUSDC</strong>
        </div>
        <div>
          <span>Leg Cost</span>
          <strong>{quote.totalLegCost.toFixed(2)} dUSDC</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{quote.executable ? 'Executable' : 'Preview only'}</strong>
        </div>
      </div>

      <div className="detail-grid">
        <article className="detail-panel">
          <div className="detail-title">
            <h3>Payoff Preview</h3>
            <span>Settlement simulation</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={quote.scenarios}>
              <XAxis
                dataKey="settlementPrice"
                tick={{ fill: '#64756f', fontSize: 12 }}
                axisLine={{ stroke: '#d8e5df' }}
                tickLine={false}
                tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
              />
              <YAxis tick={{ fill: '#64756f', fontSize: 12 }} axisLine={{ stroke: '#d8e5df' }} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#ffffff', border: '1px solid #cfe0d9', borderRadius: 8 }}
                labelStyle={{ color: '#12342d' }}
              />
              <Line type="monotone" dataKey="finalUsdc" stroke="#0f766e" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </article>

        <article className="detail-panel">
          <div className="detail-title">
            <h3>DeepBook Predict Legs</h3>
            <span>Oracle {quote.oracle.oracleId.slice(0, 10)}...</span>
          </div>
          <div className="leg-disclosure">
            {quote.legs.map((leg) => (
              <div className="leg-disclosure-row" key={leg.id}>
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
        </article>
      </div>
    </section>
  );
}

function FaqSection() {
  const items = [
    'When should I use Dual Investment?',
    'Are Target Price, Settlement Date, and APR fixed?',
    'What are Subscription Amount, Target Price, Settlement Date, and Floor?',
    'How are my rewards calculated?',
    'When will I get my rewards?',
  ];

  return (
    <section className="faq-section">
      <h2>Frequently Asked Questions</h2>
      <div className="faq-list">
        {items.map((item, index) => (
          <button type="button" className="faq-row" key={item}>
            <span>{index + 1}</span>
            <strong>{item}</strong>
            <span>+</span>
          </button>
        ))}
      </div>
      <button className="view-more" type="button">
        View More
      </button>
    </section>
  );
}

function Footer() {
  const columns = [
    ['Products', 'Dual Investment', 'Shark Fin', 'Strategy Templates', 'Auto Roll', 'Predict Legs'],
    ['Developers', 'Docs', 'Sui Testnet', 'DeepBook Predict', 'Risk Engine'],
    ['Company', 'About', 'Blog', 'Community', 'Terms', 'Privacy'],
    ['Support', 'FAQ', 'Risk Warning', 'Contact', 'Status'],
  ];

  return (
    <footer className="deep-footer">
      <div className="footer-brand">
        <div className="brand-mark">
          <span className="harbor-mark" />
          DeepHarbor
        </div>
        <p>CEX-style structured products, transparently built on DeepBook Predict.</p>
      </div>
      <div className="footer-columns">
        {columns.map(([title, ...links]) => (
          <div key={title}>
            <h3>{title}</h3>
            {links.map((link) => (
              <a href={`#${link.toLowerCase().replaceAll(' ', '-')}`} key={link}>
                {link}
              </a>
            ))}
          </div>
        ))}
      </div>
      <p className="risk-copy">
        Risk Warning: structured products can expire with different settlement assets. DeepHarbor currently
        previews quotes and payoff logic for hackathon demonstration on Sui testnet.
      </p>
    </footer>
  );
}

export function DualInvestmentPage() {
  const marketQuery = useMarketData();
  const market = marketQuery.data?.market;
  const offerInputs = useMemo(() => (market ? buildOfferInputs(market) : []), [market]);
  const [offers, setOffers] = useState<DualOffer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!market) return;
    let cancelled = false;
    setOffers(offerInputs.map((offer) => ({ ...offer, quote: null })));
    setSelectedId((current) => current ?? offerInputs[0]?.id ?? null);

    Promise.all(
      offerInputs.map(async (offer) => {
        const quote = await buildStructuredQuote({
          oracle: market,
          state: {
            productType: 'dual-investment',
            dualInput: {
              principal,
              targetPrice: offer.targetPrice,
              floorPrice: offer.floorPrice,
              stepSize,
            },
            sharkInput: {
              principal,
              lowerBound: Math.round(market.spot),
              upperBound: Math.round(market.spot * 1.06),
              stepSize: 1_000,
              baseApr: 0.05,
            },
          },
        });
        return { ...offer, quote };
      }),
    ).then((nextOffers) => {
      if (!cancelled) {
        setOffers(nextOffers);
        setSelectedId((current) => current ?? nextOffers[0]?.id ?? null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [market, offerInputs]);

  const selectedOffer = offers.find((offer) => offer.id === selectedId) ?? offers[0] ?? null;

  return (
    <main className="dual-page" id="dual-investment">
      <header className="top-nav">
        <div className="brand-mark">
          <span className="harbor-mark" />
          DeepHarbor
        </div>
        <ProductNav />
        <div className="wallet-area">
          <ConnectButton />
        </div>
      </header>

      <section className="dual-hero">
        <div>
          <h1>Dual Investment</h1>
          <p>Target-buy BTC with transparent DeepBook Predict legs, live quote previews, and settlement payoff disclosure.</p>
        </div>
        <a className="primary-action" href="#offers">
          View BTC Offers
        </a>
      </section>

      <AssetSelector market={market} />
      <PairSelector market={market} />
      <DirectionSelector />
      <div id="offers">
        <OfferTable offers={offers} selectedId={selectedId} onSelect={(offer) => setSelectedId(offer.id)} market={market} />
      </div>
      <QuoteDetail quote={selectedOffer?.quote ?? null} />

      <section className="transparency-note">
        <ShieldCheck size={18} />
        <span>
          Quotes use live DeepBook Predict preview when available. Rows fall back to preview pricing if an
          on-chain leg is outside the current pricing bounds.
        </span>
        <SlidersHorizontal size={18} />
      </section>

      <FaqSection />
      <Footer />
    </main>
  );
}
