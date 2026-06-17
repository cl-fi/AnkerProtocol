'use client';

import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { useQuery } from '@tanstack/react-query';
import { fetchPredictManagers } from '../deepbook/predictManagers';

export function usePredictManagers() {
  const account = useCurrentAccount();

  return useQuery({
    queryKey: ['predict-managers', account?.address],
    enabled: Boolean(account?.address),
    queryFn: () => fetchPredictManagers(account!.address),
    refetchInterval: 15_000,
  });
}
