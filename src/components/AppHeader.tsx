'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import { isDemoMode } from '../config/runtimeModes';
import { copyForLocale, DEFAULT_LOCALE, localizedPath, type Locale } from '../i18n';
import { LanguageSwitcher } from './LanguageSwitcher';

export type ActiveProduct = 'dual-investment' | 'portfolio';

const WalletConnectButton = dynamic(
  () => import('./WalletConnectButton').then((module) => module.WalletConnectButton),
  {
    ssr: false,
  },
);

function currentPathForActiveProduct(activeProduct: ActiveProduct | undefined) {
  if (activeProduct === 'portfolio') return '/app/portfolio';
  if (activeProduct === 'dual-investment') return '/app/dual-investment';
  return '/app';
}

export function DemoModeBanner({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  if (!isDemoMode()) return null;
  const copy = copyForLocale(locale);
  return (
    <aside className="demo-banner" role="status">
      <Megaphone size={16} aria-hidden="true" />
      <p>
        <strong>{copy.demo.bannerTitle}</strong>
        <span>{copy.demo.bannerBody}</span>
      </p>
    </aside>
  );
}

export function AppHeader({
  activeProduct,
  locale = DEFAULT_LOCALE,
}: {
  activeProduct?: ActiveProduct;
  locale?: Locale;
}) {
  const copy = copyForLocale(locale);
  return (
    <>
      <header className="top-nav">
        <Link className="brand-mark" href={localizedPath(locale, '/app')}>
          <span className="anchor-mark" />
          {copy.common.brand}
        </Link>
        <nav className="product-nav" aria-label={copy.appHeader.productsLabel}>
          <Link
            className={activeProduct === 'dual-investment' ? 'active' : ''}
            href={localizedPath(locale, '/app/dual-investment')}
          >
            {copy.common.dualInvestment}
          </Link>
          <Link className={activeProduct === 'portfolio' ? 'active' : ''} href={localizedPath(locale, '/app/portfolio')}>
            {copy.common.portfolio}
          </Link>
        </nav>
        <div className="top-nav-actions">
          <LanguageSwitcher locale={locale} currentPath={currentPathForActiveProduct(activeProduct)} />
          <div className="wallet-area">
            <WalletConnectButton />
          </div>
        </div>
      </header>
      <DemoModeBanner locale={locale} />
    </>
  );
}
