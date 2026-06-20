import { ArrowRight, Eye, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { suiExplorerObjectUrl } from './DashboardFormat';

const steps = [
  { n: '01', title: 'Set your target', body: 'Choose how much, your target BTC price, and when it settles.' },
  {
    n: '02',
    title: 'Preview your yield',
    body: 'See the live APR and exactly how the payout is built before you commit.',
  },
  { n: '03', title: 'Subscribe & claim', body: 'Confirm in your wallet, then claim your payout after it settles.' },
];

const shelf = [
  { label: 'BTC Buy Low', tag: 'Live' },
  { label: 'Sell High', tag: 'Soon' },
  { label: 'Range yield', tag: 'Planned' },
  { label: 'Auto-roll', tag: 'Planned' },
];

const DOCS_URL = 'https://docs.sui.io/onchain-finance/deepbook-predict/';
const CONTRACT_URL = suiExplorerObjectUrl('0xf8fc120ddb43b29bab88fb42588f94db9d1af34164969d2d76400f068c5a7640');

export function HomePage() {
  return (
    <div className="landing-page">
      <header className="landing-nav">
        <Link className="landing-brand" href="/">
          <span className="anchor-mark" />
          Anker Protocol
        </Link>
        <Link className="landing-launch" href="/app">
          Launch app
          <ArrowRight size={17} />
        </Link>
      </header>

      <main>
        <section className="lp-hero" aria-label="Anker Protocol">
          <div className="lp-hero-copy">
            <span className="lp-eyebrow">
              <span className="lp-dot" /> Built on DeepBook Predict · Sui testnet
            </span>
            <h1>Drop anchor on your yield.</h1>
            <p>
              DeepBook Predict prices volatility on-chain. Anker turns it into structured yield products — starting with
              Dual Investment.
            </p>
            <div className="lp-cta-row">
              <Link className="primary-action" href="/app">
                Launch app
                <ArrowRight size={17} />
              </Link>
            </div>
            <ul className="lp-trust" aria-label="Highlights">
              <li>Buy BTC lower</li>
              <li>Fully transparent</li>
              <li>You stay in control</li>
            </ul>
          </div>

          <div className="lp-hero-art">
            <div className="lp-art-tile" role="img" aria-label="Anker anchor mark" />
            <span className="lp-art-chip lp-art-chip-1">
              <Eye size={15} /> No black box
            </span>
            <span className="lp-art-chip lp-art-chip-2">
              <ShieldCheck size={15} /> Yield you can check
            </span>
          </div>
        </section>

        <section className="lp-section lp-problem" aria-labelledby="why-heading">
          <span className="section-kicker">Why Anker</span>
          <h2 id="why-heading">Dual Investment, minus the black box</h2>
          <p className="lp-lead">
            Buy Low is already one of the most popular products on exchanges. The catch: you can&apos;t see how the yield
            is made, and the exchange controls the price.
          </p>
          <div className="lp-compare">
            <article className="lp-compare-card is-before">
              <h3>On a typical exchange</h3>
              <ul>
                <li>You can&apos;t see where the yield comes from</li>
                <li>The exchange sets the price and keeps the spread</li>
                <li>Everything happens off-chain, out of view</li>
              </ul>
            </article>
            <article className="lp-compare-card is-after">
              <h3>With Anker</h3>
              <ul>
                <li>See exactly how the yield is built</li>
                <li>Prices come straight from the on-chain market</li>
                <li>Your position stays in your own wallet</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="lp-section" id="how" aria-labelledby="how-heading">
          <span className="section-kicker">How it works</span>
          <h2 id="how-heading">Three steps, fully on-chain</h2>
          <ol className="lp-steps">
            {steps.map(({ n, title, body }) => (
              <li className="lp-step" key={n}>
                <span className="lp-step-n">{n}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-section" id="shelf" aria-labelledby="shelf-heading">
          <span className="section-kicker">What&apos;s next</span>
          <h2 id="shelf-heading">Buy Low today. More to come.</h2>
          <ul className="lp-shelf">
            {shelf.map(({ label, tag }) => (
              <li className={`lp-shelf-item tag-${tag.toLowerCase()}`} key={label}>
                {label}
                <span>{tag}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-section">
          <div className="lp-final">
            <div>
              <h2>Ready to drop anchor?</h2>
              <p>Set a target, preview the yield, and try BTC Buy Low on testnet.</p>
            </div>
            <Link className="primary-action" href="/app">
              Launch app
              <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="lp-foot-brand">
          <span className="landing-brand">
            <span className="anchor-mark" />
            Anker Protocol
          </span>
          <p>Structured yield products, built on DeepBook Predict.</p>
        </div>
        <nav className="lp-foot-cols" aria-label="Footer">
          <div>
            <h3>Product</h3>
            <Link href="/app/dual-investment">Dual Investment</Link>
            <Link href="/app/dashboard">Dashboard</Link>
          </div>
          <div>
            <h3>Build</h3>
            <a href={DOCS_URL} target="_blank" rel="noreferrer">
              DeepBook Predict docs
            </a>
            <a href={CONTRACT_URL} target="_blank" rel="noreferrer">
              Contract on Sui
            </a>
          </div>
        </nav>
      </footer>
    </div>
  );
}
