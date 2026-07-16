'use client';

import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { ArrowUpRight, Check, ChevronDown, Copy, LogOut, QrCode, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { useWalletFunds } from '../hooks/useWalletFunds';
import { useWalletIdentity } from '../hooks/useWalletIdentity';
import { copyForLocale, DEFAULT_LOCALE, formattersForLocale, localizedPath, type Locale } from '../i18n';
import { shortId } from './PortfolioFormat';
import { ReceiveDialog } from './ReceiveDialog';
import { SendDialog } from './SendDialog';
import { WalletConnectButton } from './WalletConnectButton';

/** The Google "G" mark, for the zkLogin identity row. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

/**
 * The top-right wallet control. Disconnected it stays the dapp-kit connect
 * button (wallet list incl. Google zkLogin); connected it becomes the account
 * panel — the quick embedded-wallet surface: the sign-in identity (Google
 * email for zkLogin, wallet name for extensions) with the address demoted
 * beneath it, Total assets (the same headline number as Portfolio) with an
 * Available / In Position breakdown, Receive/Send (shared dialogs with
 * Portfolio), and disconnect.
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
      <WalletConnectButton>
        <Wallet size={15} aria-hidden="true" />
        <span>{copy.common.connect}</span>
      </WalletConnectButton>
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
        <span className="account-trigger-dot" aria-hidden="true" />
        <span>{shortId(account.address)}</span>
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
                fmt.amount(funds.totalAssets)
              ) : (
                <span className="account-menu-skeleton" aria-hidden="true" />
              )}{' '}
              <em>dUSDC</em>
            </strong>
          </div>
          <dl className="account-menu-breakdown">
            <div>
              <dt>{copy.portfolio.available}</dt>
              <dd>{funds.available !== null ? fmt.amount(funds.available) : '—'}</dd>
            </div>
            <div>
              <dt>{copy.portfolio.inPosition}</dt>
              <dd>{fmt.amount(funds.inPosition)}</dd>
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
