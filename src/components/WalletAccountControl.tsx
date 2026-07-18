'use client';

import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { ArrowUpRight, Check, ChevronDown, Copy, LogOut, QrCode, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { useWalletFunds } from '../hooks/useWalletFunds';
import { useWalletIdentity } from '../hooks/useWalletIdentity';
import { copyForLocale, DEFAULT_LOCALE, formattersForLocale, localizedPath, type Locale } from '../i18n';
import { GoogleMark } from './brandMarks';
import { shortId } from './PortfolioFormat';
import { ReceiveDialog } from './ReceiveDialog';
import { SendDialog } from './SendDialog';
import { WalletConnectButton } from './WalletConnectButton';

function MobilePortfolioWalletLink({
  identity,
  locale,
}: {
  identity: ReturnType<typeof useWalletIdentity>;
  locale: Locale;
}) {
  const copy = copyForLocale(locale);
  return (
    <Link
      className="mobile-wallet-route"
      href={`${localizedPath(locale, '/app/portfolio')}#wallet-portfolio`}
      aria-label={copy.wallet.viewPortfolio}
    >
      {identity?.kind === 'social' ? (
        <span className="account-trigger-avatar">
          <GoogleMark size={16} />
        </span>
      ) : identity?.kind === 'extension' && identity.icon ? (
        <span className="account-trigger-avatar">
          {/* Wallet-standard icons are data: URIs, not remote assets. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={identity.icon} alt="" width={18} height={18} />
        </span>
      ) : (
        <Wallet size={18} aria-hidden="true" />
      )}
    </Link>
  );
}

/**
 * The top-right wallet control. Phones always route to Portfolio, the mobile
 * wallet hub. On larger screens, disconnected it is the connect CTA (opens
 * the app-owned sign-in dialog); connected it becomes the account panel — the
 * quick embedded-wallet surface. The trigger leads with the sign-in identity
 * (Google mark + email for zkLogin, wallet icon + address for extensions);
 * the panel repeats that identity with the address demoted beneath it, Total
 * assets (the same headline number as Portfolio) with an Available / In
 * Position breakdown, Receive/Send (shared dialogs with Portfolio), and
 * disconnect.
 */
export function WalletAccountControl({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const copy = copyForLocale(locale);
  const fmt = formattersForLocale(locale);
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const funds = useWalletFunds();
  const identity = useWalletIdentity();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    // pointerdown (not mousedown) so outside-tap dismissal also works on touch.
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    menuRef.current?.querySelector<HTMLElement>('button, a')?.focus();
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!account) {
    return (
      <div className="account-control">
        <MobilePortfolioWalletLink identity={identity} locale={locale} />
        <div className="desktop-wallet-entry">
          <WalletConnectButton locale={locale}>
            <Wallet size={15} aria-hidden="true" />
            <span>{copy.common.connect}</span>
          </WalletConnectButton>
        </div>
      </div>
    );
  }

  return (
    <div
      className="account-control"
      ref={rootRef}
      onBlur={(event) => {
        if (open && !rootRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <MobilePortfolioWalletLink identity={identity} locale={locale} />
      <button
        type="button"
        ref={triggerRef}
        className="account-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={copy.wallet.accountLabel}
        onClick={() => setOpen((value) => !value)}
      >
        {identity?.kind === 'social' ? (
          <span className="account-trigger-avatar">
            <GoogleMark size={15} />
          </span>
        ) : identity?.kind === 'extension' && identity.icon ? (
          <span className="account-trigger-avatar">
            {/* Wallet-standard icons are data: URIs, not remote assets. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={identity.icon} alt="" width={16} height={16} />
          </span>
        ) : (
          <span className="account-trigger-dot" aria-hidden="true" />
        )}
        <span className="account-trigger-label">
          {identity?.kind === 'social' ? (identity.email ?? copy.wallet.googleAccount) : shortId(account.address)}
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div className="account-menu" id={menuId} ref={menuRef} aria-label={copy.wallet.accountLabel}>
          <div className="account-menu-identity">
            {identity?.kind === 'social' ? (
              <span className="account-menu-avatar">
                <GoogleMark />
              </span>
            ) : identity?.kind === 'extension' && identity.icon ? (
              <span className="account-menu-avatar">
                {/* Wallet-standard icons are data: URIs, not remote assets. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={identity.icon} alt="" width={16} height={16} />
              </span>
            ) : (
              <span className="account-trigger-dot" aria-hidden="true" />
            )}
            <div className="account-menu-who">
              {identity ? (
                <strong>
                  {identity.kind === 'social' ? (identity.email ?? copy.wallet.googleAccount) : identity.name}
                </strong>
              ) : null}
              <code>{shortId(account.address)}</code>
            </div>
            <button
              type="button"
              className="account-menu-copy"
              aria-label={copied ? copy.wallet.copied : copy.wallet.copyAddress}
              onClick={() => {
                void navigator.clipboard.writeText(account.address).then(() => setCopied(true));
              }}
            >
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            </button>
          </div>
          <div className="account-menu-balance">
            <span>{copy.portfolio.totalAssets}</span>
            <strong>
              {funds.totalAssets !== null ? (
                fmt.cashAmount(funds.totalAssets)
              ) : (
                <span className="account-menu-skeleton" aria-hidden="true" />
              )}{' '}
              <em>dUSDC</em>
            </strong>
          </div>
          <dl className="account-menu-breakdown">
            <div>
              <dt>{copy.portfolio.available}</dt>
              <dd>{funds.available !== null ? fmt.cashAmount(funds.available) : '—'}</dd>
            </div>
            <div>
              <dt>{copy.portfolio.inPosition}</dt>
              <dd>{fmt.cashAmount(funds.inPosition)}</dd>
            </div>
          </dl>
          <div className="account-menu-actions">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setReceiveOpen(true);
              }}
            >
              <QrCode size={14} aria-hidden="true" />
              {copy.wallet.receive}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSendOpen(true);
              }}
            >
              <ArrowUpRight size={14} aria-hidden="true" />
              {copy.wallet.send}
            </button>
          </div>
          <div className="account-menu-footer">
            <Link
              className="account-menu-link"
              href={localizedPath(locale, '/app/portfolio')}
              onClick={() => setOpen(false)}
            >
              {copy.wallet.viewPortfolio}
            </Link>
            <button
              type="button"
              className="account-menu-disconnect"
              onClick={() => {
                setOpen(false);
                void dAppKit.disconnectWallet();
              }}
            >
              <LogOut size={13} aria-hidden="true" />
              {copy.wallet.disconnect}
            </button>
          </div>
        </div>
      ) : null}
      <ReceiveDialog open={receiveOpen} address={account.address} locale={locale} onClose={() => setReceiveOpen(false)} />
      <SendDialog open={sendOpen} locale={locale} onClose={() => setSendOpen(false)} />
    </div>
  );
}
