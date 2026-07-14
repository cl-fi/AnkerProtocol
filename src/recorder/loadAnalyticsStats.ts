import { isFixtureDataMode } from '../config/runtimeModes';
import { ensureBenchmarkSchema } from './ensureSchema';
import {
  aggregateHeadlineStats,
  type HeadlineStats,
} from './aggregateHeadlineStats';
import { analyticsFixtureSamples } from './analyticsFixtures';
import { buildEdgeTracks, type EdgeTracks } from './buildEdgeTracks';
import { createNeonBenchmarkRunStore } from './neonStore';

export type AnalyticsStatsLoad =
  | { kind: 'ready'; stats: HeadlineStats; edgeTracks: EdgeTracks; usingFixture: boolean }
  | { kind: 'unavailable'; reason: 'not_configured' | 'load_failed' };

/**
 * Loads Samples (fixture or Neon) and builds Analytics page inputs:
 * headline stats + Edge Tracks.
 */
export async function loadAnalyticsStats(): Promise<AnalyticsStatsLoad> {
  if (isFixtureDataMode()) {
    const samples = analyticsFixtureSamples();
    return {
      kind: 'ready',
      stats: aggregateHeadlineStats(samples),
      edgeTracks: buildEdgeTracks(samples),
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
      edgeTracks: buildEdgeTracks(samples),
      usingFixture: false,
    };
  } catch {
    return { kind: 'unavailable', reason: 'load_failed' };
  }
}
