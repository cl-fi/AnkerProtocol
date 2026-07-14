import { afterEach, describe, expect, it, vi } from 'vitest';
import { aggregateHeadlineStats } from './aggregateHeadlineStats';
import { analyticsFixtureSamples } from './analyticsFixtures';

describe('loadAnalyticsStats', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('aggregates fixture Samples when fixture data mode is on', async () => {
    vi.stubEnv('ANKER_DETERMINISTIC_E2E', 'true');
    const { loadAnalyticsStats } = await import('./loadAnalyticsStats');

    const result = await loadAnalyticsStats();

    expect(result).toEqual({
      kind: 'ready',
      usingFixture: true,
      stats: aggregateHeadlineStats(analyticsFixtureSamples()),
    });
    if (result.kind === 'ready') {
      expect(result.stats.sampleCount).toBe(4);
      expect(result.stats.leadingPct).toBeCloseTo(0.75);
      expect(result.stats.medianEdgePp).toBeCloseTo(0.1);
      expect(result.stats.currentLeadingStreak).toBe(2);
      expect(result.stats.ladderCoverage).toBeCloseTo(0.8);
    }
  });

  it('reports not_configured when Neon is absent outside fixture mode', async () => {
    vi.stubEnv('ANKER_DETERMINISTIC_E2E', 'false');
    vi.stubEnv('NEXT_PUBLIC_ANKER_DETERMINISTIC_E2E', 'false');
    vi.stubEnv('NEXT_PUBLIC_ANKER_DEMO_MODE', 'false');
    vi.stubEnv('DATABASE_URL', '');
    const { loadAnalyticsStats } = await import('./loadAnalyticsStats');

    await expect(loadAnalyticsStats()).resolves.toEqual({
      kind: 'unavailable',
      reason: 'not_configured',
    });
  });
});
