'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TenorBucketId } from '../recorder/aggregateHeadlineStats';
import type { EdgeSeries, EdgeSeriesPoint } from '../recorder/buildEdgeSeries';
import { copyForLocale, formatApr, formatEdgePts, type Locale } from '../i18n';

const BUCKET_COLORS: Record<TenorBucketId, string> = {
  '1d': 'var(--coral)',
  '2d': 'var(--gold)',
  '3d': 'var(--navy)',
  '7d': 'var(--grass)',
  '14d': 'var(--slate)',
};

const HOUR_MS = 3_600_000;

function numberLocale(locale: Locale) {
  return locale === 'zh-CN' ? 'zh-CN' : 'en-US';
}

function formatSettlementOffset(offsetMs: number, locale: Locale) {
  const hours = offsetMs / HOUR_MS;
  const sign = hours > 0 ? '+' : '';
  const formatted = `${sign}${hours.toLocaleString(numberLocale(locale), {
    maximumFractionDigits: 1,
    minimumFractionDigits: hours % 1 === 0 ? 0 : 1,
  })}h`;
  return formatted;
}

function formatAxisTime(boundaryMs: number, locale: Locale) {
  return new Date(boundaryMs).toLocaleString(numberLocale(locale), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  });
}

export function EdgeSeriesTooltipContent({
  point,
  bucket,
  locale,
}: {
  point: EdgeSeriesPoint;
  bucket: TenorBucketId;
  locale: Locale;
}) {
  const copy = copyForLocale(locale);
  return (
    <div className="analytics-edge-tooltip" role="status">
      <strong>
        {copy.analytics.tenorBucket(bucket)} · {formatEdgePts(point.edgePp, locale)}
      </strong>
      <div>
        <span>{copy.analytics.tooltipAnkerApr}</span>
        <strong>{formatApr(point.netApr, locale)}</strong>
      </div>
      <div>
        <span>{copy.analytics.tooltipBinanceApr}</span>
        <strong>{formatApr(point.benchmarkApr, locale)}</strong>
      </div>
      <div>
        <span>{copy.analytics.tooltipSettlementOffset}</span>
        <strong>{formatSettlementOffset(point.settlementOffsetMs, locale)}</strong>
      </div>
    </div>
  );
}

function yDomain(series: EdgeSeries): [number, number] {
  const edges = series.series.flatMap((bucket) => bucket.points.map((p) => p.edgePp));
  if (edges.length === 0) return [-0.05, 0.05];
  const min = Math.min(0, ...edges);
  const max = Math.max(0, ...edges);
  const pad = Math.max(0.01, (max - min) * 0.1);
  return [min - pad, max + pad];
}

export function EdgeChart({
  edgeSeries,
  locale,
}: {
  edgeSeries: EdgeSeries;
  locale: Locale;
}) {
  const copy = copyForLocale(locale);
  const hasPoints = edgeSeries.series.some((bucket) => bucket.points.length > 0);

  return (
    <section className="calculation-section analytics-edge-chart" aria-label={copy.analytics.chartLabel}>
      <div className="section-heading">
        <h2>{copy.analytics.chartTitle}</h2>
        <p>{copy.analytics.chartSubtitle}</p>
      </div>

      {!hasPoints ? (
        <p className="analytics-unavailable">{copy.analytics.chartEmpty}</p>
      ) : (
        <div className="analytics-edge-chart-frame" data-testid="analytics-edge-chart">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="var(--copper-line)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                type="number"
                dataKey="boundaryMs"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(value: number) => formatAxisTime(value, locale)}
                stroke="var(--ink-soft)"
                tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
              />
              <YAxis
                domain={yDomain(edgeSeries)}
                tickFormatter={(value: number) => formatEdgePts(value, locale)}
                stroke="var(--ink-soft)"
                tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
                width={72}
              />
              <ReferenceLine
                y={0}
                stroke="var(--navy)"
                strokeWidth={1.5}
                label={{
                  value: copy.analytics.chartZeroAxis,
                  position: 'insideTopRight',
                  fill: 'var(--ink-soft)',
                  fontSize: 11,
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0];
                  const point = item?.payload as EdgeSeriesPoint | undefined;
                  const bucket = item?.name as TenorBucketId | undefined;
                  if (!point || !bucket) return null;
                  return <EdgeSeriesTooltipContent point={point} bucket={bucket} locale={locale} />;
                }}
              />
              <Legend
                formatter={(value: string) => copy.analytics.tenorBucket(value as TenorBucketId)}
              />
              {edgeSeries.series.map((bucketSeries) => (
                <Line
                  key={bucketSeries.bucket}
                  data={bucketSeries.points}
                  type="monotone"
                  dataKey="edgePp"
                  name={bucketSeries.bucket}
                  stroke={BUCKET_COLORS[bucketSeries.bucket]}
                  strokeWidth={2.5}
                  dot={{ r: 5, strokeWidth: 1.5, fill: 'var(--paper)' }}
                  activeDot={{ r: 7 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
