import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function HomePage() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link className="landing-brand" href="/">
          <span className="anchor-mark" />
          Anker Protocol
        </Link>
        <Link className="landing-launch" href="/app">
          Launch
          <ArrowRight size={17} />
        </Link>
      </header>

      <section className="landing-hero" aria-label="Anker Protocol">
        <div className="landing-copy">
          <h1>Drop anchor on your yield.</h1>
          <p>Structured yield products, built on DeepBook&apos;s prediction markets.</p>
        </div>
      </section>
    </main>
  );
}
