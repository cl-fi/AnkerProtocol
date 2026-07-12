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
 * Row-level provenance of a tenor's market data (CONTEXT: Legacy Oracle, Snapshot).
 * 'live' — a 6-24 Expiry Market, tradable.
 * 'legacy' — a still-updating 4-16 Legacy Oracle: live pricing, never tradable.
 * 'snapshot' — the committed photograph of Legacy Oracles + Binance benchmark.
 */
export type TenorSource = 'live' | 'legacy' | 'snapshot';

/**
 * Shared discovery, different filter: hourly = 1h cadence fingerprint and
 * sub-day expiry distance (ADR-0002); day = expiry at least one day away.
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
    ).filter((market) => market.expiryMs - nowMs < DAY_MS);
  }

  return markets
    .filter((market) => market.expiryMs > nowMs && market.expiryMs - nowMs >= DAY_MS)
    .sort((a, b) => a.expiryMs - b.expiryMs);
}

/** Subscribe is only for live 6-24 rows outside site-wide demo mode. */
export function isTenorTradingEnabled(input: {
  source: TenorSource | undefined;
  demoMode: boolean;
}) {
  return input.source === 'live' && !input.demoMode;
}
