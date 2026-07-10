import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TargetBuyExecutionPanelView } from './TargetBuyExecutionPanel';

vi.mock('lucide-react', () => ({
  WalletCards: () => <span data-testid="wallet-icon" />,
}));

describe('TargetBuyExecutionPanelView', () => {
  it('asks for wallet connection before subscription actions', () => {
    render(
      <TargetBuyExecutionPanelView
        hasAccount={false}
        hasManager={false}
        isQuoteExecutable={true}
        isLoadingManagers={false}
        isPending={false}
        onCreateManager={() => undefined}
        onSubscribe={() => undefined}
      />,
    );

    expect(screen.getByText('Connect wallet to subscribe')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Subscribe Buy Low' })).toBeDisabled();
  });

  it('asks the wallet to open a Predict account before subscription when none is available', () => {
    render(
      <TargetBuyExecutionPanelView
        hasAccount
        hasManager={false}
        isQuoteExecutable={true}
        isLoadingManagers={false}
        isPending={false}
        onCreateManager={() => undefined}
        onSubscribe={() => undefined}
      />,
    );

    expect(screen.getByText('Start with step 1 — open your Predict account.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Open Predict account' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Subscribe Buy Low' })).toBeDisabled();
  });

  it('enables subscribe when wallet, manager, and executable quote are ready', () => {
    render(
      <TargetBuyExecutionPanelView
        hasAccount
        hasManager
        isQuoteExecutable={true}
        isLoadingManagers={false}
        isPending={false}
        managerId="0xabc"
        onCreateManager={() => undefined}
        onSubscribe={() => undefined}
      />,
    );

    expect(screen.getByText('Account 0xabc is ready. Subscribe to finish.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Subscribe Buy Low' })).toBeEnabled();
  });

  it('shows the quote warning when the wallet is ready but the quote is not executable', () => {
    render(
      <TargetBuyExecutionPanelView
        hasAccount
        hasManager
        isQuoteExecutable={false}
        quoteWarning="Ask price 1.0010 is outside Predict mint bounds 0.01-0.99."
        isLoadingManagers={false}
        isPending={false}
        managerId="0xabc"
        onCreateManager={() => undefined}
        onSubscribe={() => undefined}
      />,
    );

    expect(screen.getByText('Ask price 1.0010 is outside Predict mint bounds 0.01-0.99.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Subscribe Buy Low' })).toBeDisabled();
  });

  it('links to the dashboard after a subscribe transaction is submitted', () => {
    render(
      <TargetBuyExecutionPanelView
        hasAccount
        hasManager
        isQuoteExecutable={true}
        isLoadingManagers={false}
        isPending={false}
        managerId="0xabc"
        digest="0xdigest"
        onCreateManager={() => undefined}
        onSubscribe={() => undefined}
      />,
    );

    expect(screen.getByText('Transaction submitted: 0xdigest')).toBeVisible();
    expect(screen.getByRole('link', { name: 'View Dashboard' })).toHaveAttribute('href', '/en/app/dashboard');
  });

  it('renders execution copy and links in Chinese', () => {
    render(
      <TargetBuyExecutionPanelView
        hasAccount
        hasManager
        isQuoteExecutable={true}
        isLoadingManagers={false}
        isPending={false}
        managerId="0xabc"
        digest="0xdigest"
        locale="zh-CN"
        onCreateManager={() => undefined}
        onSubscribe={() => undefined}
      />,
    );

    expect(screen.getByText('交易已提交。你可以在仪表盘中跟踪。')).toBeVisible();
    expect(screen.getByRole('link', { name: '查看仪表盘' })).toHaveAttribute('href', '/zh-CN/app/dashboard');
  });

  it('surfaces the awaiting-signature execution state while a wallet transaction is pending', () => {
    render(
      <TargetBuyExecutionPanelView
        hasAccount
        hasManager
        isQuoteExecutable={true}
        isLoadingManagers={false}
        isPending
        managerId="0xabc"
        onCreateManager={() => undefined}
        onSubscribe={() => undefined}
      />,
    );

    expect(screen.getByText('Awaiting wallet signature.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Waiting for wallet...' })).toBeDisabled();
  });

  it('surfaces the transaction-failed execution state when execution returns an error', () => {
    render(
      <TargetBuyExecutionPanelView
        hasAccount
        hasManager
        isQuoteExecutable={true}
        isLoadingManagers={false}
        isPending={false}
        managerId="0xabc"
        error="Preflight failed: MoveAbort in predict::mint"
        onCreateManager={() => undefined}
        onSubscribe={() => undefined}
      />,
    );

    expect(screen.getByText('Transaction failed. Review the error and retry.')).toBeVisible();
    expect(screen.getByText('Preflight failed: MoveAbort in predict::mint')).toBeVisible();
  });

  it('surfaces the quote-expired execution state separately from transaction failures', () => {
    const { container } = render(
      <TargetBuyExecutionPanelView
        hasAccount
        hasManager
        isQuoteExecutable={true}
        isLoadingManagers={false}
        isPending={false}
        managerId="0xabc"
        error="Quote expired. Refresh pricing before signing."
        onCreateManager={() => undefined}
        onSubscribe={() => undefined}
      />,
    );

    const status = container.querySelector('.execution-status');
    expect(status).not.toBeNull();
    expect(within(status as HTMLElement).getByText('Quote expired. Refresh pricing before signing.')).toBeVisible();
    expect(screen.queryByText('Transaction failed. Review the error and retry.')).toBeNull();
  });
});
