import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WalletAccountControl } from './WalletAccountControl';

const walletState = vi.hoisted(() => ({
  account: null as { address: string } | null,
  disconnectWallet: vi.fn(),
}));

vi.mock('@mysten/dapp-kit-react', () => ({
  useCurrentAccount: () => walletState.account,
  useDAppKit: () => ({ disconnectWallet: walletState.disconnectWallet }),
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
    walletState.disconnectWallet.mockClear();
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

  it('gives a connected mobile user an account chip whose sheet owns identity and sign-out', () => {
    walletState.account = { address: `0x${'a'.repeat(64)}` };
    render(<WalletAccountControl locale="zh-CN" />);

    // The chip is named by its visible identity label (address for an
    // extension wallet, the truncated email for zkLogin).
    const chip = screen.getByRole('button', { name: '0xaaaa...aaaa' });
    fireEvent.click(chip);

    const sheet = screen.getByRole('dialog', { name: '钱包账户' });
    expect(sheet).toBeInTheDocument();
    expect(screen.getByText('Sui Testnet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /在浏览器中查看全部记录/ })).toHaveAttribute(
      'href',
      `https://testnet.suivision.xyz/account/0x${'a'.repeat(64)}`,
    );

    fireEvent.click(screen.getByRole('button', { name: '退出登录' }));
    expect(walletState.disconnectWallet).toHaveBeenCalledTimes(1);
  });

  it('retains the desktop account trigger and its disconnect', () => {
    walletState.account = { address: `0x${'a'.repeat(64)}` };
    render(<WalletAccountControl locale="zh-CN" />);

    const desktopTrigger = screen.getByRole('button', { name: '钱包账户' });
    fireEvent.click(desktopTrigger);
    expect(screen.getByRole('button', { name: '断开连接' })).toBeInTheDocument();
  });
});
