import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import { PortfolioPage } from './PortfolioPage';

const OWNER = `0x${'a'.repeat(64)}`;

const walletState = vi.hoisted(() => ({
  account: { address: `0x${'a'.repeat(64)}` } as { address: string } | null,
  connectWallet: vi.fn(),
  disconnectWallet: vi.fn(),
}));

const ankerConfig = vi.hoisted(() => ({ packageId: '0xconfigured' }));

vi.mock('lucide-react', () => ({
  ArrowUpRight: () => <span data-testid="icon" />,
  Check: () => <span data-testid="icon" />,
  Copy: () => <span data-testid="icon" />,
  LogOut: () => <span data-testid="icon" />,
  QrCode: () => <span data-testid="icon" />,
  RefreshCw: () => <span data-testid="icon" />,
  Sparkles: () => <span data-testid="icon" />,
}));

vi.mock('@mysten/dapp-kit-react', () => ({
  useCurrentAccount: () => walletState.account,
  useCurrentClient: () => ({}),
  useCurrentWallet: () => null,
  useDAppKit: () => ({
    connectWallet: walletState.connectWallet,
    disconnectWallet: walletState.disconnectWallet,
  }),
  useWallets: () => [],
}));

vi.mock('../sui/ankerTransactions', () => ({
  DEFAULT_ANKER_CONFIG: ankerConfig,
}));

vi.mock('./AppHeader', () => ({
  AppHeader: () => <header data-testid="app-header" />,
}));

vi.mock('./AppFooter', () => ({
  AppFooter: () => <footer data-testid="app-footer" />,
}));

vi.mock('./ReceiveDialog', () => ({
  ReceiveDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="receive-dialog" /> : null),
}));

vi.mock('./SendDialog', () => ({
  SendDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="send-dialog" /> : null),
}));

vi.mock('./ClaimSuccessDialog', () => ({
  ClaimSuccessDialog: () => null,
}));

vi.mock('./PortfolioClaimAction', () => ({
  ClaimActionView: () => null,
  claimActionViewModel: vi.fn(),
  claimEstimateForNote: vi.fn(),
}));

vi.mock('./PortfolioProductNoteCard', () => ({
  ProductNoteCard: ({ note }: { note: { noteId: string } }) => <article data-testid={`card-${note.noteId}`} />,
  SubscriptionDigestValue: () => null,
  depositedCashText: vi.fn(),
  noteStatusBadge: vi.fn(),
}));

vi.mock('../hooks/useProductNoteMarketStates', () => ({
  useProductNoteMarketStates: () => ({ byMarketId: {} }),
}));

vi.mock('../hooks/useProductNoteEventIndex', () => ({
  useProductNoteEventIndex: () => ({ data: undefined }),
}));

vi.mock('../hooks/useWalletFunds', () => ({
  useWalletFunds: () => ({
    available: 200,
    inPosition: 800,
    totalAssets: 1_000,
    walletBaseUnits: 200_000_000n,
    wrapper: null,
    refresh: vi.fn(),
  }),
}));

const openNote = {
  noteId: `0x${'1'.repeat(64)}`,
  status: 'open',
  principal: 800,
  coupon: 12.34,
  feeBps: 1_000,
  redeemedPayout: 0,
  redeemedFee: 0,
  oracleId: `0x${'2'.repeat(64)}`,
  expiryMs: Date.now() + 86_400_000,
} as AnkerProductNoteRecord;

const redeemedNote = {
  noteId: `0x${'3'.repeat(64)}`,
  status: 'redeemed',
  principal: 500,
  coupon: 8,
  redeemedPayout: 540,
  redeemedFee: 5.4,
  oracleId: `0x${'4'.repeat(64)}`,
  expiryMs: Date.now() - 86_400_000,
} as AnkerProductNoteRecord;

vi.mock('../hooks/useAnkerPortfolio', () => ({
  useAnkerPortfolio: () => ({
    data: [openNote, redeemedNote],
    isPending: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

describe('PortfolioPage wallet band (connected)', () => {
  beforeEach(() => {
    walletState.account = { address: OWNER };
    ankerConfig.packageId = '0xconfigured';
    vi.clearAllMocks();
  });

  it('shows Total Assets = Available + In Position, the tiles, and the wallet actions', () => {
    render(<PortfolioPage />);

    // Total Assets (总资产) = 200 Available + 800 In Position — expected
    // rewards are never counted in; they render twice (hero pill + tile),
    // net of the 10% fee (12.34 × 0.9) like the Cumulative tile beside them.
    expect(screen.getByText('Total assets')).toBeInTheDocument();
    expect(screen.getByText(/1,000/)).toBeInTheDocument();
    expect(screen.getAllByText(/11\.11/)).toHaveLength(2);
    expect(screen.queryByText(/12\.34/)).not.toBeInTheDocument();
    expect(screen.getByText('Expected rewards')).toBeInTheDocument();

    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('In position')).toBeInTheDocument();
    // Cumulative Rewards (累计收益): net payout − principal over claimed
    // positions = 540 − 5.4 − 500.
    expect(screen.getByText('Cumulative rewards')).toBeInTheDocument();
    expect(screen.getByText(/\+34\.6/)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Receive/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send/ })).toBeInTheDocument();

    // Position vocabulary, never Note (ADR-free glossary rule).
    expect(screen.getByText('Your positions')).toBeInTheDocument();
    expect(screen.queryByText(/Your Notes/)).not.toBeInTheDocument();

    // Both position cards render.
    expect(screen.getByTestId(`card-${openNote.noteId}`)).toBeInTheDocument();
    expect(screen.getByTestId(`card-${redeemedNote.noteId}`)).toBeInTheDocument();
  });

  it('opens the shared Send dialog from the wallet band', () => {
    render(<PortfolioPage />);
    expect(screen.queryByTestId('send-dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Send/ }));
    expect(screen.getByTestId('send-dialog')).toBeInTheDocument();
  });

  it('lets a connected mobile user disconnect from the Portfolio wallet hub', () => {
    render(<PortfolioPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(walletState.disconnectWallet).toHaveBeenCalledTimes(1);
  });

  it('keeps Disconnect available when the product contract is not configured', () => {
    ankerConfig.packageId = '0x0';
    render(<PortfolioPage />);

    expect(screen.getByText(/contract package is not configured/i)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(walletState.disconnectWallet).toHaveBeenCalledTimes(1);
  });

  it('lets a disconnected user start the wallet connection flow from Portfolio', () => {
    walletState.account = null;
    render(<PortfolioPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeVisible();
  });
});
