'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

export type ActiveProduct = 'dual-investment' | 'dashboard';

const WalletConnectButton = dynamic(
  () => import('./WalletConnectButton').then((module) => module.WalletConnectButton),
  {
    ssr: false,
    loading: () => <button className="wallet-loading">Connect Wallet</button>,
  },
);

export function AppHeader({ activeProduct }: { activeProduct?: ActiveProduct }) {
  return (
    <header className="top-nav">
      <Link className="brand-mark" href="/app">
        <span className="anchor-mark" />
        Anker Protocol
      </Link>
      <nav className="product-nav" aria-label="Products">
        <Link className={activeProduct === 'dual-investment' ? 'active' : ''} href="/app/dual-investment">
          Dual Investment
        </Link>
        <Link className={activeProduct === 'dashboard' ? 'active' : ''} href="/app/dashboard">
          Dashboard
        </Link>
      </nav>
      <div className="wallet-area">
        <WalletConnectButton />
      </div>
    </header>
  );
}
