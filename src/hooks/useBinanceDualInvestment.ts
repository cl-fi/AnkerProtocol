import { useQuery } from '@tanstack/react-query';
import { fetchBinanceDualInvestmentProducts } from '../deepbook/binanceDualInvestment';
import type { OracleMarket } from '../products/types';

export function useBinanceDualInvestment(input: {
  market?: OracleMarket;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['binance-dual-investment', 'target-buy', input.market?.expiryMs],
    enabled: Boolean(input.market) && (input.enabled ?? true),
    queryFn: () => fetchBinanceDualInvestmentProducts(),
    refetchInterval: 10_000,
    retry: 1,
    placeholderData: (previous) => previous,
  });
}
