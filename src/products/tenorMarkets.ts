import { DEEPBOOK_PREDICT } from '../config/deepbook';
import type { PredictCadenceConfig } from '../config/predictDeployment';
import {
  filterExpiryMarketsByCadence,
  type ExpiryMarketSummary,
} from '../deepbook/predictAdapter';

/** One calendar day — boundary between the hourly and day-scale tenor groups. */
export const DAY_MS = 86_400_000;

/** Tenor grouping on the single Dual Investment page (CONTEXT: Tenor). */
export type TenorGroup = 'hourly' | 'day';

/**
 * Row-level provenance of a tenor's market data (CONTEXT: Snapshot).
 * 'live' — a 6-24 Expiry Market, tradable.
 * 'snapshot' — the committed photograph of Legacy Oracles + Binance benchmark;
 * the only day fallback (ADR-0004), browse only.
 */
export type TenorSource = 'live' | 'snapshot';

/**
 * Whether a market belongs on the hourly shelf (ADR-0007): birth tenor under
 * one day when `createdAtMs` is known; otherwise remaining-time fallback.
 */
export function isHourlyShelfMarket(
  market: Pick<ExpiryMarketSummary, 'expiryMs' | 'createdAtMs'>,
  nowMs = Date.now(),
): boolean {
  if (typeof market.createdAtMs === 'number' && Number.isFinite(market.createdAtMs)) {
    return market.expiryMs - market.createdAtMs < DAY_MS;
  }
  return market.expiryMs - nowMs < DAY_MS;
}

/**
 * Shared discovery, different filter: hourly = 1h cadence fingerprint and
 * hourly birth tenor (ADR-0007); day = day-scale birth, kept while unexpired.
 */
export function filterMarketsForTenorGroup(
  markets: readonly ExpiryMarketSummary[],
  group: TenorGroup,
  options: {
    nowMs?: number;
    turboCadence?: Pick<PredictCadenceConfig, 'maxExpiryAllocation' | 'initialExpiryCash'>;
  } = {},
): ExpiryMarketSummary[] {
  const nowMs = options.nowMs ?? Date.now();
  if (group === 'hourly') {
    return filterExpiryMarketsByCadence(
      markets,
      options.turboCadence ?? DEEPBOOK_PREDICT.turboCadence,
      nowMs,
    ).filter((market) => isHourlyShelfMarket(market, nowMs));
  }

  return markets
    .filter((market) => market.expiryMs > nowMs && !isHourlyShelfMarket(market, nowMs))
    .sort((a, b) => a.expiryMs - b.expiryMs);
}

/** Subscribe is only for live 6-24 rows outside site-wide demo mode. */
export function isTenorTradingEnabled(input: {
  source: TenorSource | undefined;
  demoMode: boolean;
}) {
  return input.source === 'live' && !input.demoMode;
}
