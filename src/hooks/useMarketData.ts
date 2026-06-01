import { useQuery } from '@tanstack/react-query';
import { DEEPBOOK_PREDICT } from '../config/deepbook';
import { lastKnownMarketSnapshot } from '../deepbook/fixtures';
import { fetchActiveBtcOracles, fetchOracleMarket, fetchPredictStatus } from '../deepbook/predictServer';

export function useMarketData() {
  return useQuery({
    queryKey: ['deepbook-market'],
    queryFn: async () => {
      const status = await fetchPredictStatus();
      const oracles = await fetchActiveBtcOracles(DEEPBOOK_PREDICT.predictObjectId);
      const selected = oracles.sort((a, b) => a.expiry - b.expiry)[0];
      if (!selected) {
        return { market: lastKnownMarketSnapshot, staleSnapshot: true };
      }
      const market = await fetchOracleMarket(selected.oracle_id, {
        serverLagSeconds: status.maxTimeLagSeconds,
      });
      return { market, staleSnapshot: false };
    },
    refetchInterval: 15_000,
    retry: 1,
  });
}
