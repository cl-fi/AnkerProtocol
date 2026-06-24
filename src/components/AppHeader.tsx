'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { copyForLocale, DEFAULT_LOCALE, localizedPath, type Locale } from '../i18n';
import { LanguageSwitcher } from './LanguageSwitcher';

export type ActiveProduct = 'dual-investment' | 'dashboard';

const WalletConnectButton = dynamic(
  () => import('./WalletConnectButton').then((module) => module.WalletConnectButton),
  {
    ssr: false,
  },
);

function currentPathForActiveProduct(activeProduct: ActiveProduct | undefined) {
  if (activeProduct === 'dashboard') return '/app/dashboard';
  if (activeProduct === 'dual-investment') return '/app/dual-investment';
  return '/app';
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
        <Link className={activeProduct === 'dashboard' ? 'active' : ''} href={localizedPath(locale, '/app/dashboard')}>
          {copy.common.dashboard}
        </Link>
      </nav>
      <div className="top-nav-actions">
        <LanguageSwitcher locale={locale} currentPath={currentPathForActiveProduct(activeProduct)} />
        <div className="wallet-area">
          <WalletConnectButton />
        </div>
      </div>
    </header>
  );
}
