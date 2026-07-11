import { DEEPBOOK_PREDICT } from '../config/deepbook';
import type { PredictCadenceConfig } from '../config/predictDeployment';
import {
  filterExpiryMarketsByCadence,
  type ExpiryMarketSummary,
} from '../deepbook/predictAdapter';

/** One calendar day — boundary between Turbo (hourly) and multi-day Dual Investment. */
export const DAY_MS = 86_400_000;

export type ProductLine = 'turbo' | 'multi-day';

export type ProductLineDataSource =
  | { kind: 'live'; markets: ExpiryMarketSummary[] }
  | { kind: 'fixture'; reason: 'no-day-scale-markets'; markets: ExpiryMarketSummary[] };

/**
 * Shared discovery, different filter (D4): Turbo = 1h cadence fingerprint and
 * sub-day expiry distance (ADR-0002); multi-day = expiry at least one day away.
 */
export function filterMarketsForProductLine(
  markets: readonly ExpiryMarketSummary[],
  line: ProductLine,
  options: {
    nowMs?: number;
    turboCadence?: Pick<PredictCadenceConfig, 'maxExpiryAllocation' | 'initialExpiryCash'>;
  } = {},
): ExpiryMarketSummary[] {
  const nowMs = options.nowMs ?? Date.now();
  if (line === 'turbo') {
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

/**
 * D4 data-source resolution: live day-scale markets when present; otherwise
 * labeled fixtures. Flipping discovered rows flips the mode with no code change.
 */
export function resolveProductLineDataSource(input: {
  line: ProductLine;
  discovered: readonly ExpiryMarketSummary[];
  fixtures: readonly ExpiryMarketSummary[];
  nowMs?: number;
  turboCadence?: Pick<PredictCadenceConfig, 'maxExpiryAllocation' | 'initialExpiryCash'>;
}): ProductLineDataSource {
  const markets = filterMarketsForProductLine(input.discovered, input.line, {
    nowMs: input.nowMs,
    turboCadence: input.turboCadence,
  });

  if (markets.length > 0) {
    return { kind: 'live', markets };
  }

  if (input.line === 'multi-day') {
    return {
      kind: 'fixture',
      reason: 'no-day-scale-markets',
      markets: [...input.fixtures],
    };
  }

  return { kind: 'live', markets: [] };
}

/** Trading is off for fixture degradation and site-wide demo mode. */
export function isProductLineTradingEnabled(input: {
  dataSourceKind: ProductLineDataSource['kind'];
  demoMode: boolean;
}) {
  return input.dataSourceKind === 'live' && !input.demoMode;
}
