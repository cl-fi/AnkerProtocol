'use client';

import { useCurrentAccount, useCurrentClient } from '@mysten/dapp-kit-react';
import { useQuery } from '@tanstack/react-query';
import { selectUnallocatedPredictManager } from '../application/subscribeDualInvestment';
import { DEEPBOOK_PREDICT } from '../config/deepbook';
import { useAccountWrapperBalance } from './useAccountWrapper';
import { useAnkerPortfolio } from './useAnkerPortfolio';
import { usePredictManagers } from './usePredictManagers';

/**
 * dUSDC available to fund a Dual Investment subscription. The subscribe
 * transaction spends the unallocated manager's wrapper balance first and
 * tops up the difference from the wallet's dUSDC coins, so the spendable
 * total is wallet + wrapper. Null until the wallet connects and the wallet
 * balance loads, so views can hide balance-derived controls instead of
 * showing a zero.
 */
export function useSubscriptionFunds(): { balance: number | null } {
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const managersQuery = usePredictManagers();
  const portfolioQuery = useAnkerPortfolio();
  const manager = selectUnallocatedPredictManager(managersQuery.data, portfolioQuery.data, account?.address);
  const wrapperBalanceQuery = useAccountWrapperBalance(manager?.managerId);
  const walletBalanceQuery = useQuery({
    queryKey: ['wallet-dusdc-balance', account?.address, DEEPBOOK_PREDICT.quoteAssetType],
    enabled: Boolean(account?.address),
    queryFn: async () => {
      const { balance } = await client.core.getBalance({
        owner: account!.address,
        coinType: DEEPBOOK_PREDICT.quoteAssetType,
      });
      return Number(balance.balance) / 10 ** DEEPBOOK_PREDICT.quoteAssetDecimals;
    },
  });

  if (!account || walletBalanceQuery.data === undefined) return { balance: null };
  const wrapperBalance = manager ? (wrapperBalanceQuery.data?.dusdcBalance ?? 0) : 0;
  return { balance: walletBalanceQuery.data + wrapperBalance };
}
