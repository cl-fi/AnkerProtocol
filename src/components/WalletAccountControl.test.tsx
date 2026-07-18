import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletAccountControl } from './WalletAccountControl';

const walletState = vi.hoisted(() => ({
  account: null as { address: string } | null,
}));

vi.mock('@mysten/dapp-kit-react', () => ({
  useCurrentAccount: () => walletState.account,
  useDAppKit: () => ({ disconnectWallet: vi.fn() }),
}));

vi.mock('../hooks/useWalletFunds', () => ({
  useWalletFunds: () => ({ available: 100, inPosition: 200, totalAssets: 300 }),
}));

vi.mock('../hooks/useWalletIdentity', () => ({
  useWalletIdentity: () =>
    walletState.account ? { kind: 'extension', name: 'Slush', icon: null } : null,
}));

vi.mock('./WalletConnectButton', () => ({
  WalletConnectButton: ({ children }: { children?: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock('./ReceiveDialog', () => ({ ReceiveDialog: () => null }));
vi.mock('./SendDialog', () => ({ SendDialog: () => null }));

describe('WalletAccountControl responsive entry points', () => {
  beforeEach(() => {
    walletState.account = null;
  });

  afterEach(() => cleanup());

  it('routes a disconnected mobile user to the localized Portfolio wallet hub', () => {
    render(<WalletAccountControl locale="en" />);

    expect(screen.getByRole('link', { name: 'View Portfolio' })).toHaveAttribute(
      'href',
      '/en/app/portfolio#wallet-portfolio',
    );
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
  });

  it('routes a connected mobile user to Portfolio while retaining the desktop account trigger', () => {
    walletState.account = { address: `0x${'a'.repeat(64)}` };
    render(<WalletAccountControl locale="zh-CN" />);

    expect(screen.getByRole('link', { name: '查看持仓' })).toHaveAttribute(
      'href',
      '/zh-CN/app/portfolio#wallet-portfolio',
    );
    const desktopTrigger = screen.getByRole('button', { name: '钱包账户' });
    expect(desktopTrigger).toBeInTheDocument();

    fireEvent.click(desktopTrigger);
    expect(screen.getByRole('button', { name: '断开连接' })).toBeInTheDocument();
  });
});
