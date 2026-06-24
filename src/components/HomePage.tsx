import { ArrowRight, Eye, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { copyForLocale, DEFAULT_LOCALE, localizedPath, type Locale } from '../i18n';
import { buttonClassName } from '../ui';
import { LanguageSwitcher } from './LanguageSwitcher';
import { SocialLinks } from './SocialLinks';

const DOCS_URL = 'https://docs.sui.io/onchain-finance/deepbook-predict/';
const GITHUB_URL = 'https://github.com/cl-fi/AnkerProtocol';

export function HomePage({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const copy = copyForLocale(locale);
  return (
    <div className="landing-page">
      <header className="landing-nav">
        <Link className="landing-brand" href={localizedPath(locale, '/')}>
          <span className="anchor-mark" />
          {copy.common.brand}
        </Link>
        <div className="landing-nav-actions">
          <LanguageSwitcher locale={locale} currentPath="/" />
          <Link className="landing-launch" href={localizedPath(locale, '/app')}>
            {copy.landing.launchApp}
            <ArrowRight size={17} />
          </Link>
        </div>
      </header>

      <main>
        <section className="lp-hero" aria-label={copy.common.brand}>
          <div className="lp-hero-copy">
            <span className="lp-eyebrow">
              <span className="lp-dot" /> {copy.landing.eyebrow}
            </span>
            <h1>{copy.landing.title}</h1>
            <p>{copy.landing.lead}</p>
            <div className="lp-cta-row">
              <Link className={buttonClassName()} href={localizedPath(locale, '/app')}>
                {copy.landing.launchApp}
                <ArrowRight size={17} />
              </Link>
            </div>
            <ul className="lp-trust" aria-label={copy.landing.highlightsLabel}>
              {copy.landing.highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
          </div>

          <div className="lp-hero-art">
            <div className="lp-art-tile" role="img" aria-label={copy.landing.artLabel} />
            <span className="lp-art-chip lp-art-chip-1">
              <Eye size={15} /> {copy.landing.artChips.noBlackBox}
            </span>
            <span className="lp-art-chip lp-art-chip-2">
              <ShieldCheck size={15} /> {copy.landing.artChips.checkableYield}
            </span>
          </div>
        </section>

        <section className="lp-section lp-problem" aria-labelledby="why-heading">
          <span className="section-kicker">{copy.landing.whyKicker}</span>
          <h2 id="why-heading">{copy.landing.whyTitle}</h2>
          <p className="lp-lead">{copy.landing.whyLead}</p>
          <div className="lp-compare">
            <article className="lp-compare-card is-before">
              <h3>{copy.landing.exchangeTitle}</h3>
              <ul>
                {copy.landing.exchangePoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
            <article className="lp-compare-card is-after">
              <h3>{copy.landing.ankerTitle}</h3>
              <ul>
                {copy.landing.ankerPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="lp-section" id="how" aria-labelledby="how-heading">
          <span className="section-kicker">{copy.landing.howKicker}</span>
          <h2 id="how-heading">{copy.landing.howTitle}</h2>
          <ol className="lp-steps">
            {copy.landing.steps.map(({ n, title, body }) => (
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
          <span className="section-kicker">{copy.landing.nextKicker}</span>
          <h2 id="shelf-heading">{copy.landing.nextTitle}</h2>
          <ul className="lp-shelf">
            {copy.landing.shelf.map(({ label, tag, tone }) => (
              <li className={`lp-shelf-item tag-${tone}`} key={label}>
                {label}
                <span>{tag}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-section">
          <div className="lp-final">
            <div>
              <h2>{copy.landing.finalTitle}</h2>
              <p>{copy.landing.finalBody}</p>
            </div>
            <Link className={buttonClassName()} href={localizedPath(locale, '/app')}>
              {copy.landing.launchApp}
              <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="lp-foot-brand">
          <span className="landing-brand">
            <span className="anchor-mark" />
            {copy.common.brand}
          </span>
          <p>{copy.landing.footerDescription}</p>
          <SocialLinks locale={locale} variant="footer" />
        </div>
        <nav className="lp-foot-cols" aria-label={copy.landing.footerLabel}>
          <div>
            <h3>{copy.landing.footerProduct}</h3>
            <Link href={localizedPath(locale, '/app/dual-investment')}>{copy.common.dualInvestment}</Link>
            <Link href={localizedPath(locale, '/app/dashboard')}>{copy.common.dashboard}</Link>
          </div>
          <div>
            <h3>{copy.landing.footerBuild}</h3>
            <a href={DOCS_URL} target="_blank" rel="noreferrer">
              {copy.landing.deepbookDocs}
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              {copy.landing.github}
            </a>
          </div>
        </nav>
      </footer>
    </div>
  );
}
