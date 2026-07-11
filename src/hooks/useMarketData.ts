import { useQuery } from '@tanstack/react-query';
import { dayScaleMarketSnapshot } from '../deepbook/dayScaleFixtures';
import { lastKnownMarketSnapshot } from '../deepbook/fixtures';
import {
  fetchOracleMarket,
  fetchPredictPricingState,
  fetchPredictStatus,
  selectNearestTradableOracle,
} from '../deepbook/predictServer';
import type { ProductLine } from '../products/productLineMarkets';
import type { CuratedOracleListItem, CuratedOracleMarketResponse } from '../server/curatedOracles';

async function fetchCuratedBtcOracles(productLine: ProductLine): Promise<CuratedOracleMarketResponse> {
  const params = productLine === 'multi-day' ? '?productLine=multi-day' : '';
  const response = await fetch(`/api/markets/btc-oracles${params}`);
  if (!response.ok) {
    throw new Error(`Curated oracle request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<CuratedOracleMarketResponse>;
}

export function useMarketData(selectedOracleId?: string, productLine: ProductLine = 'turbo') {
  return useQuery({
    queryKey: ['deepbook-market', productLine, selectedOracleId],
    queryFn: async () => {
      const [status, curated, predictPricing] = await Promise.all([
        fetchPredictStatus(),
        fetchCuratedBtcOracles(productLine),
        fetchPredictPricingState().catch(() => undefined),
      ]);
      const productOracles = curated.oracles;
      const dataSource = curated.dataSource ?? 'live';
      const selected =
        productOracles.find((oracle: CuratedOracleListItem) => oracle.oracle_id === selectedOracleId) ??
        selectNearestTradableOracle(productOracles, Date.now(), 0);

      if (!selected) {
        return {
          market: lastKnownMarketSnapshot,
          productOracles: [] as CuratedOracleListItem[],
          selectedOracleId: undefined,
          staleSnapshot: true,
          dataSource: dataSource,
          reason: curated.reason,
        };
      }

      if (dataSource === 'fixture' && productLine === 'multi-day') {
        return {
          market: dayScaleMarketSnapshot({ expiryMarketId: selected.oracle_id }),
          productOracles,
          selectedOracleId: selected.oracle_id,
          staleSnapshot: true,
          dataSource: 'fixture' as const,
          reason: curated.reason ?? 'no-day-scale-markets',
        };
      }

      const market = await fetchOracleMarket(selected.oracle_id, {
        serverLagSeconds: status.maxTimeLagSeconds,
      });
      return {
        market: predictPricing ? { ...market, predictPricing } : market,
        productOracles,
        selectedOracleId: selected.oracle_id,
        staleSnapshot: false,
        dataSource: 'live' as const,
        reason: undefined,
      };
    },
    refetchInterval: 15_000,
    retry: 1,
  });
}
