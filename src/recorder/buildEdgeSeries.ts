import {
  remainingTenorBucket,
  type TenorBucketId,
} from './aggregateHeadlineStats';
import { sampleEdgePp } from './evaluateAlertRules';
import type { TimestampedSample } from './store';

const TENOR_BUCKET_ORDER: readonly TenorBucketId[] = ['1d', '2d', '3d', '7d', '14d'];

export interface EdgeSeriesPoint {
  boundaryMs: number;
  targetPrice: number;
  edgePp: number;
  netApr: number;
  benchmarkApr: number;
  settlementOffsetMs: number;
}

export interface EdgeSeriesBucket {
  bucket: TenorBucketId;
  points: readonly EdgeSeriesPoint[];
}

export interface EdgeSeries {
  series: readonly EdgeSeriesBucket[];
}

/**
 * Pure chart seam: Samples → Edge time series grouped by tenor bucket.
 * Only live-source matched (headlineEligible) samples are plotted.
 */
export function buildEdgeSeries(samples: readonly TimestampedSample[]): EdgeSeries {
  const groups = new Map<TenorBucketId, EdgeSeriesPoint[]>();

  for (const sample of samples) {
    if (!sample.headlineEligible) continue;
    const edgePp = sampleEdgePp(sample);
    if (edgePp === null || sample.netApr === null || sample.benchmarkApr === null) continue;
    if (sample.benchmarkSettlementMs === null) continue;

    const bucket = remainingTenorBucket(sample);
    const point: EdgeSeriesPoint = {
      boundaryMs: sample.boundaryMs,
      targetPrice: sample.targetPrice,
      edgePp,
      netApr: sample.netApr,
      benchmarkApr: sample.benchmarkApr,
      settlementOffsetMs: sample.benchmarkSettlementMs - sample.ankerSettlementMs,
    };
    const group = groups.get(bucket);
    if (group) group.push(point);
    else groups.set(bucket, [point]);
  }

  return {
    series: TENOR_BUCKET_ORDER.filter((bucket) => groups.has(bucket)).map((bucket) => {
      const points = groups.get(bucket)!;
      points.sort((a, b) => a.boundaryMs - b.boundaryMs || a.targetPrice - b.targetPrice);
      return { bucket, points };
    }),
  };
}
