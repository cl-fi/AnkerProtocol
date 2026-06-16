import { useQuery } from '@tanstack/react-query';
import type { BinanceDualInvestmentProduct } from '../deepbook/binanceDualInvestment';
import type { OracleMarket } from '../products/types';

async function fetchBinanceDualInvestmentProductsFromProxy() {
  const response = await fetch('/api/binance/dual-investment', {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Binance Dual Investment proxy failed: ${response.status}`);
  }

  return response.json() as Promise<BinanceDualInvestmentProduct[]>;
}

export function useBinanceDualInvestment(input: {
  market?: OracleMarket;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['binance-dual-investment', 'target-buy', input.market?.expiryMs],
    enabled: Boolean(input.market) && (input.enabled ?? true),
    queryFn: () => fetchBinanceDualInvestmentProductsFromProxy(),
    refetchInterval: 10_000,
    retry: 1,
    placeholderData: (previous) => previous,
  });
}
