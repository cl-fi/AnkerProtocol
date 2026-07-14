import { DAY_MS } from '../products/tenorMarkets';
import type { TimestampedSample } from './store';

/** Fixed fixture boundary used by deterministic E2E / Demo Mode Analytics. */
export const ANALYTICS_FIXTURE_START_MS = Date.UTC(2026, 6, 13, 12, 0, 0);
const BOUNDARY_B = ANALYTICS_FIXTURE_START_MS + 15 * 60 * 1000;
const BOUNDARY_C = BOUNDARY_B + 15 * 60 * 1000;

function fixtureSample(
  overrides: Partial<TimestampedSample> & Pick<TimestampedSample, 'boundaryMs' | 'targetPrice'>,
): TimestampedSample {
  const boundaryMs = overrides.boundaryMs;
  return {
    spot: 73_560,
    coupon: 0.12,
    reserve: 4.5,
    legsCost: 0.38,
    legCount: 6,
    netApr: 0.4,
    ankerSettlementMs: boundaryMs + 3 * DAY_MS,
    benchmarkSettlementMs: boundaryMs + 3 * DAY_MS + 8 * 3_600_000,
    benchmarkApr: 0.3,
    benchmarkProductId: 'fixture-binance',
    matchStatus: 'matched',
    source: 'live',
    appVersion: '0.2.1',
    headlineEligible: true,
    ...overrides,
  };
}

/**
 * Deterministic Samples for fixture-mode Analytics.
 * Headline: 4 eligible (3 leading), median Edge +0.10, streak 2 Runs, coverage 4/5.
 */
export function analyticsFixtureSamples(): readonly TimestampedSample[] {
  return [
    // Newest Run — edges +0.10, +0.10 → median +0.10
    fixtureSample({
      boundaryMs: BOUNDARY_C,
      targetPrice: 73_500,
      netApr: 0.4,
      benchmarkApr: 0.3,
    }),
    fixtureSample({
      boundaryMs: BOUNDARY_C,
      targetPrice: 73_000,
      netApr: 0.4,
      benchmarkApr: 0.3,
    }),
    // Prior Run — edges +0.20, −0.05 → median +0.075
    fixtureSample({
      boundaryMs: BOUNDARY_B,
      targetPrice: 73_500,
      netApr: 0.5,
      benchmarkApr: 0.3,
    }),
    fixtureSample({
      boundaryMs: BOUNDARY_B,
      targetPrice: 72_500,
      netApr: 0.25,
      benchmarkApr: 0.3,
    }),
    // Unmatched — coverage only
    fixtureSample({
      boundaryMs: ANALYTICS_FIXTURE_START_MS,
      targetPrice: 74_000,
      netApr: 0.35,
      benchmarkApr: null,
      benchmarkSettlementMs: null,
      benchmarkProductId: null,
      matchStatus: 'no_product',
      headlineEligible: false,
    }),
  ];
}
