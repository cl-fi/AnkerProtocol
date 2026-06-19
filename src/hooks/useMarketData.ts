import { useQuery } from '@tanstack/react-query';
import { lastKnownMarketSnapshot } from '../deepbook/fixtures';
import {
  fetchOracleMarket,
  fetchPredictPricingState,
  fetchPredictStatus,
  selectNearestTradableOracle,
} from '../deepbook/predictServer';
import type { CuratedOracleListItem, CuratedOracleMarketResponse } from '../server/curatedOracles';

async function fetchCuratedBtcOracles(): Promise<CuratedOracleListItem[]> {
  const response = await fetch('/api/markets/btc-oracles');
  if (!response.ok) {
    throw new Error(`Curated oracle request failed: ${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as CuratedOracleMarketResponse;
  return payload.oracles;
}

export function useMarketData(selectedOracleId?: string) {
  return useQuery({
    queryKey: ['deepbook-market', selectedOracleId],
    queryFn: async () => {
      const [status, productOracles, predictPricing] = await Promise.all([
        fetchPredictStatus(),
        fetchCuratedBtcOracles(),
        fetchPredictPricingState().catch(() => undefined),
      ]);
      const selected =
        productOracles.find((oracle) => oracle.oracle_id === selectedOracleId) ??
        selectNearestTradableOracle(productOracles, Date.now(), 0);
      if (!selected) {
        return { market: lastKnownMarketSnapshot, productOracles: [], selectedOracleId: undefined, staleSnapshot: true };
      }
      const market = await fetchOracleMarket(selected.oracle_id, {
        serverLagSeconds: status.maxTimeLagSeconds,
      });
      return {
        market: predictPricing ? { ...market, predictPricing } : market,
        productOracles,
        selectedOracleId: selected.oracle_id,
        staleSnapshot: false,
      };
    },
    refetchInterval: 15_000,
    retry: 1,
  });
}
