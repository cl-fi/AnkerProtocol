import { render, screen } from '@testing-library/react';
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
    expect(screen.getByRole('button', { name: 'Subscribe Target Buy' })).toBeDisabled();
  });

  it('shows create manager when the wallet has no PredictManager', () => {
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

    expect(screen.getByText('Create a PredictManager before subscribing.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Create Predict Manager' })).toBeEnabled();
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

    expect(screen.getByText('PredictManager 0xabc is ready.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Subscribe Target Buy' })).toBeEnabled();
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
    expect(screen.getByRole('button', { name: 'Subscribe Target Buy' })).toBeDisabled();
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
    expect(screen.getByRole('link', { name: 'View Dashboard' })).toHaveAttribute('href', '/app/dashboard');
  });
});
