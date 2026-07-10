'use client';

import { useCurrentAccount, useCurrentClient, useDAppKit } from '@mysten/dapp-kit-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { isDemoMode } from '../config/runtimeModes';
import { useAccountWrapper, useAccountWrapperBalance } from '../hooks/useAccountWrapper';
import { copyForLocale, DEFAULT_LOCALE, type Locale } from '../i18n';
import {
  buildCreateAccountWrapperTransaction,
  buildDepositDusdcTransaction,
} from '../sui/accountTransactions';
import { toQuoteBaseUnits } from '../sui/ankerTransactionPrimitives';
import { DEEPBOOK_PREDICT } from '../config/deepbook';
import { Button, Card, InputField } from '../ui';
import { formatPreciseAmount, shortId } from './DashboardFormat';

function transactionDigest(
  result: Awaited<ReturnType<ReturnType<typeof useDAppKit>['signAndExecuteTransaction']>>,
) {
  if (result.FailedTransaction) {
    throw new Error(result.FailedTransaction.status.error?.message ?? 'Transaction failed.');
  }
  return result.Transaction.digest;
}

export function AccountFundingCard({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const copy = copyForLocale(locale);
  const accountCopy = copy.dashboard.account;
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();
  const wrapperQuery = useAccountWrapper();
  const wrapper = wrapperQuery.data;
  const hasWrapper = Boolean(wrapper?.exists && wrapper.wrapperId);
  const balanceQuery = useAccountWrapperBalance(hasWrapper ? wrapper?.wrapperId : undefined);

  const [depositAmount, setDepositAmount] = useState('10');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [digest, setDigest] = useState<string | null>(null);

  if (!account) return null;
  const ownerAddress = account.address;

  async function runTransaction(action: () => Promise<string>) {
    setIsPending(true);
    setError(null);
    setDigest(null);
    try {
      const nextDigest = await action();
      setDigest(nextDigest);
      await queryClient.invalidateQueries({ queryKey: ['account-wrapper', ownerAddress] });
      await queryClient.invalidateQueries({ queryKey: ['account-wrapper-balance'] });
      await queryClient.invalidateQueries({ queryKey: ['predict-managers', ownerAddress] });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : accountCopy.errors.transactionFailed);
    } finally {
      setIsPending(false);
    }
  }

  function handleCreate() {
    if (isDemoMode()) return;
    void runTransaction(async () => {
      const plan = buildCreateAccountWrapperTransaction();
      const result = await dAppKit.signAndExecuteTransaction({ transaction: plan.tx });
      const nextDigest = transactionDigest(result);
      await client.waitForTransaction({ digest: nextDigest });
      await wrapperQuery.refetch();
      return nextDigest;
    });
  }

  function handleDeposit() {
    if (isDemoMode() || !wrapper?.wrapperId) return;
    void runTransaction(async () => {
      const amount = Number(depositAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(accountCopy.errors.invalidAmount);
      }
      const amountBaseUnits = toQuoteBaseUnits(amount, DEEPBOOK_PREDICT.quoteAssetDecimals, 'Deposit amount');
      const plan = buildDepositDusdcTransaction({
        wrapperId: wrapper.wrapperId!,
        amountBaseUnits,
      });
      const result = await dAppKit.signAndExecuteTransaction({ transaction: plan.tx });
      const nextDigest = transactionDigest(result);
      await client.waitForTransaction({ digest: nextDigest });
      await balanceQuery.refetch();
      return nextDigest;
    });
  }

  const balanceText =
    balanceQuery.data != null
      ? `${formatPreciseAmount(balanceQuery.data.dusdcBalance, locale)} dUSDC`
      : accountCopy.balanceLoading;
  const demoBlocked = isDemoMode();

  return (
    <Card as="article" className="execution-panel account-funding-card">
      <div className="detail-title">
        <h3>{accountCopy.title}</h3>
        <span>{accountCopy.subtitle}</span>
      </div>

      {wrapperQuery.isPending ? (
        <p className="execution-message">{accountCopy.checking}</p>
      ) : !hasWrapper ? (
        <>
          <p className="execution-message">{accountCopy.createHelp}</p>
          <Button
            variant="primary"
            disabled={isPending || demoBlocked}
            onClick={handleCreate}
          >
            {isPending ? accountCopy.waitingForWallet : accountCopy.createAccount}
          </Button>
        </>
      ) : (
        <>
          <div className="di-portfolio" style={{ marginBottom: '1rem' }}>
            <div>
              <span>{accountCopy.balance}</span>
              <strong>{balanceText}</strong>
            </div>
            <div>
              <span>{accountCopy.wrapper}</span>
              <strong>{shortId(wrapper!.wrapperId!)}</strong>
            </div>
          </div>

          <InputField
            label={accountCopy.depositAmount}
            suffix="dUSDC"
            type="number"
            min="0"
            step="any"
            value={depositAmount}
            disabled={isPending || demoBlocked}
            onChange={(event) => setDepositAmount(event.target.value)}
          />

          <div style={{ marginTop: '0.75rem' }}>
            <Button
              variant="primary"
              disabled={isPending || demoBlocked}
              onClick={handleDeposit}
            >
              {isPending ? accountCopy.waitingForWallet : accountCopy.deposit}
            </Button>
          </div>
        </>
      )}

      {demoBlocked ? <p className="execution-error">{accountCopy.demoDisabled}</p> : null}
      {digest ? (
        <p className="execution-message">
          {accountCopy.transactionSubmittedPrefix} {shortId(digest)}
        </p>
      ) : null}
      {error ? <p className="execution-error">{error}</p> : null}
    </Card>
  );
}
