import { useQuery } from '@tanstack/react-query';
import { DEEPBOOK_PREDICT } from '../config/deepbook';
import { lastKnownMarketSnapshot } from '../deepbook/fixtures';
import {
  filterProductExpiryOracles,
  fetchActiveBtcOracles,
  fetchOracleMarket,
  fetchPredictStatus,
  selectNearestTradableOracle,
} from '../deepbook/predictServer';

const PRODUCT_MIN_TIME_TO_EXPIRY_MS = 7 * 86_400_000;

export function useMarketData(selectedOracleId?: string) {
  return useQuery({
    queryKey: ['deepbook-market', selectedOracleId],
    queryFn: async () => {
      const status = await fetchPredictStatus();
      const oracles = await fetchActiveBtcOracles(DEEPBOOK_PREDICT.predictObjectId);
      const productOracles = filterProductExpiryOracles(oracles);
      const selected =
        productOracles.find((oracle) => oracle.oracle_id === selectedOracleId) ??
        selectNearestTradableOracle(productOracles, Date.now(), PRODUCT_MIN_TIME_TO_EXPIRY_MS) ??
        selectNearestTradableOracle(oracles, Date.now(), PRODUCT_MIN_TIME_TO_EXPIRY_MS);
      if (!selected) {
        return { market: lastKnownMarketSnapshot, productOracles: [], selectedOracleId: undefined, staleSnapshot: true };
      }
      const market = await fetchOracleMarket(selected.oracle_id, {
        serverLagSeconds: status.maxTimeLagSeconds,
      });
      return { market, productOracles, selectedOracleId: selected.oracle_id, staleSnapshot: false };
    },
    refetchInterval: 15_000,
    retry: 1,
  });
}
