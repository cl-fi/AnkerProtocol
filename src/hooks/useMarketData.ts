import { useQuery } from '@tanstack/react-query';
import {
  fetchOracleMarket,
  fetchPredictPricingState,
  fetchPredictStatus,
  selectNearestTradableOracle,
} from '../deepbook/predictServer';
import type { TenorSource } from '../products/tenorMarkets';
import type { OracleMarket } from '../products/types';
import type {
  CuratedOracleListItem,
  CuratedOracleMarketResponse,
  DaySnapshotMeta,
} from '../server/curatedOracles';

async function fetchCuratedBtcOracles(): Promise<CuratedOracleMarketResponse> {
  const response = await fetch('/api/markets/btc-oracles');
  if (!response.ok) {
    throw new Error(`Curated oracle request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<CuratedOracleMarketResponse>;
}

/**
 * Landing default: furthest day row (primary product), else nearest tradable
 * hourly row. Near-term day tenors often have no Binance match; the long end
 * of the ladder (e.g. ~48d) is the better first paint.
 */
export function defaultOracleSelection(
  oracles: CuratedOracleListItem[],
  nowMs = Date.now(),
): CuratedOracleListItem | undefined {
  const dayRows = oracles.filter((oracle) => oracle.group === 'day');
  if (dayRows.length > 0) return dayRows[dayRows.length - 1];
  return selectNearestTradableOracle(oracles, nowMs, 0);
}

export interface MarketDataResult {
  market: OracleMarket | undefined;
  productOracles: CuratedOracleListItem[];
  selectedOracleId: string | undefined;
  /** Provenance of the selected row — drives badges and the subscribe state. */
  selectedSource: TenorSource | undefined;
  /** Present when day rows come from the committed Snapshot (photograph model). */
  snapshot?: DaySnapshotMeta;
}

export const MARKET_REFETCH_INTERVAL_MS = 15_000;

export function useMarketData(selectedOracleId?: string) {
  return useQuery({
    queryKey: ['deepbook-market', selectedOracleId],
    queryFn: async (): Promise<MarketDataResult> => {
      const curated = await fetchCuratedBtcOracles();
      const productOracles = curated.oracles;
      const selected =
        productOracles.find((oracle) => oracle.oracle_id === selectedOracleId) ??
        defaultOracleSelection(productOracles);

      if (!selected) {
        return {
          market: undefined,
          productOracles: [],
          selectedOracleId: undefined,
          selectedSource: undefined,
          snapshot: curated.snapshot,
        };
      }

      // Snapshot rows embed their browse market — the 6-24 indexer can't serve them.
      if (selected.market) {
        return {
          market: selected.market,
          productOracles,
          selectedOracleId: selected.oracle_id,
          selectedSource: selected.source,
          snapshot: curated.snapshot,
        };
      }

      const [status, predictPricing] = await Promise.all([
        fetchPredictStatus(),
        fetchPredictPricingState().catch(() => undefined),
      ]);
      const market = await fetchOracleMarket(selected.oracle_id, {
        serverLagSeconds: status.maxTimeLagSeconds,
      });
      return {
        market: predictPricing ? { ...market, predictPricing } : market,
        productOracles,
        selectedOracleId: selected.oracle_id,
        selectedSource: selected.source,
        snapshot: curated.snapshot,
      };
    },
    refetchInterval: MARKET_REFETCH_INTERVAL_MS,
    retry: 1,
  });
}
