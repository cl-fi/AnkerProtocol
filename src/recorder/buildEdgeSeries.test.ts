import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../products/tenorMarkets';
import type { BenchmarkMatchStatus, BenchmarkSampleSource } from './buildBenchmarkRun';
import { buildEdgeSeries } from './buildEdgeSeries';
import type { TimestampedSample } from './store';

const BOUNDARY_A = Date.UTC(2026, 6, 14, 12, 0, 0);
const BOUNDARY_B = BOUNDARY_A - 15 * 60 * 1000;
const HOUR_MS = 3_600_000;

function sample(overrides: Partial<TimestampedSample> & { boundaryMs: number }): TimestampedSample {
  const boundaryMs = overrides.boundaryMs;
  const base: TimestampedSample = {
    boundaryMs,
    targetPrice: 73_500,
    spot: 73_560,
    coupon: 0.12,
    reserve: 4.5,
    legsCost: 0.38,
    legCount: 6,
    netApr: 0.4,
    ankerSettlementMs: boundaryMs + 3 * DAY_MS,
    benchmarkSettlementMs: boundaryMs + 3 * DAY_MS + 8 * HOUR_MS,
    benchmarkApr: 0.3,
    benchmarkProductId: 'binance-1',
    matchStatus: 'matched' as BenchmarkMatchStatus,
    source: 'live' as BenchmarkSampleSource,
    appVersion: '0.2.1',
    headlineEligible: true,
  };
  return { ...base, ...overrides };
}

describe('buildEdgeSeries', () => {
  it('returns no series when there are no samples', () => {
    expect(buildEdgeSeries([])).toEqual({ series: [] });
  });

  it('plots one point per live-source matched sample with Edge, APRs, and settlement offset', () => {
    const samples = [
      sample({
        boundaryMs: BOUNDARY_A,
        netApr: 0.4,
        benchmarkApr: 0.3,
        ankerSettlementMs: BOUNDARY_A + 3 * DAY_MS,
        benchmarkSettlementMs: BOUNDARY_A + 3 * DAY_MS + 8 * HOUR_MS,
      }),
      sample({
        boundaryMs: BOUNDARY_B,
        targetPrice: 73_000,
        netApr: 0.25,
        benchmarkApr: 0.3,
        ankerSettlementMs: BOUNDARY_B + DAY_MS,
        benchmarkSettlementMs: BOUNDARY_B + DAY_MS - 4 * HOUR_MS,
      }),
    ];

    const result = buildEdgeSeries(samples);

    expect(result.series.map((s) => s.bucket)).toEqual(['1d', '3d']);
    expect(result.series[0]!.points).toHaveLength(1);
    expect(result.series[0]!.points[0]).toMatchObject({
      boundaryMs: BOUNDARY_B,
      targetPrice: 73_000,
      netApr: 0.25,
      benchmarkApr: 0.3,
      settlementOffsetMs: -4 * HOUR_MS,
    });
    expect(result.series[0]!.points[0]!.edgePp).toBeCloseTo(-0.05);
    expect(result.series[1]!.points).toHaveLength(1);
    expect(result.series[1]!.points[0]).toMatchObject({
      boundaryMs: BOUNDARY_A,
      targetPrice: 73_500,
      netApr: 0.4,
      benchmarkApr: 0.3,
      settlementOffsetMs: 8 * HOUR_MS,
    });
    expect(result.series[1]!.points[0]!.edgePp).toBeCloseTo(0.1);
  });

  it('omits non-headline samples (snapshot, unmatched) from the series', () => {
    const samples = [
      sample({ boundaryMs: BOUNDARY_A, netApr: 0.4, benchmarkApr: 0.3 }),
      sample({
        boundaryMs: BOUNDARY_A,
        targetPrice: 72_000,
        source: 'snapshot',
        headlineEligible: false,
        netApr: 0.5,
        benchmarkApr: 0.2,
      }),
      sample({
        boundaryMs: BOUNDARY_A,
        targetPrice: 74_000,
        matchStatus: 'no_product',
        headlineEligible: false,
        benchmarkApr: null,
        benchmarkSettlementMs: null,
        benchmarkProductId: null,
      }),
    ];

    const result = buildEdgeSeries(samples);

    expect(result.series).toHaveLength(1);
    expect(result.series[0]!.bucket).toBe('3d');
    expect(result.series[0]!.points).toHaveLength(1);
    expect(result.series[0]!.points[0]!.targetPrice).toBe(73_500);
  });

  it('keeps negative Edge points and sorts points oldest-first within a bucket', () => {
    const samples = [
      sample({
        boundaryMs: BOUNDARY_A,
        netApr: 0.2,
        benchmarkApr: 0.3,
      }),
      sample({
        boundaryMs: BOUNDARY_B,
        netApr: 0.5,
        benchmarkApr: 0.3,
      }),
    ];

    const points = buildEdgeSeries(samples).series[0]!.points;
    expect(points.map((p) => p.boundaryMs)).toEqual([BOUNDARY_B, BOUNDARY_A]);
    expect(points[0]!.edgePp).toBeCloseTo(0.2);
    expect(points[1]!.edgePp).toBeCloseTo(-0.1);
  });
});
