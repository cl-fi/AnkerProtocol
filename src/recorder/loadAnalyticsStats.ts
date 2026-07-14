import { isFixtureDataMode } from '../config/runtimeModes';
import { ensureBenchmarkSchema } from './ensureSchema';
import {
  aggregateHeadlineStats,
  type HeadlineStats,
} from './aggregateHeadlineStats';
import { analyticsFixtureSamples } from './analyticsFixtures';
import { createNeonBenchmarkRunStore } from './neonStore';

export type AnalyticsStatsLoad =
  | { kind: 'ready'; stats: HeadlineStats; usingFixture: boolean }
  | { kind: 'unavailable'; reason: 'not_configured' | 'load_failed' };

/**
 * Loads Samples (fixture or Neon) and aggregates headline stats for the Analytics page.
 */
export async function loadAnalyticsStats(): Promise<AnalyticsStatsLoad> {
  if (isFixtureDataMode()) {
    return {
      kind: 'ready',
      stats: aggregateHeadlineStats(analyticsFixtureSamples()),
      usingFixture: true,
    };
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return { kind: 'unavailable', reason: 'not_configured' };
  }

  try {
    await ensureBenchmarkSchema(databaseUrl);
    const store = createNeonBenchmarkRunStore(databaseUrl);
    const [samples, runs] = await Promise.all([
      store.listTimestampedSamples(),
      store.listAllRuns(),
    ]);
    return {
      kind: 'ready',
      stats: aggregateHeadlineStats({ samples, runs }),
      usingFixture: false,
    };
  } catch {
    return { kind: 'unavailable', reason: 'load_failed' };
  }
}
