'use client';

import { useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DAY_MS } from '../products/tenorMarkets';
import type { EdgeTrack, EdgeTrackPoint, EdgeTracks } from '../recorder/buildEdgeTracks';
import {
  copyForLocale,
  formatApr,
  formatEdgePts,
  formatPercent,
  type Locale,
} from '../i18n';
import { Badge, type Tone } from '../ui';

const HOUR_MS = 3_600_000;
const STATUS_TONE: Record<EdgeTrack['status'], Tone> = {
  active: 'positive',
  hourlyShelf: 'warning',
  expired: 'neutral',
};

function numberLocale(locale: Locale) {
  return locale === 'zh-CN' ? 'zh-CN' : 'en-US';
}

function formatUtcInstant(ms: number, locale: Locale) {
  return new Date(ms).toLocaleString(numberLocale(locale), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  });
}

function formatUtcDay(ms: number, locale: Locale) {
  return new Date(ms).toLocaleString(numberLocale(locale), {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatUtcTime(ms: number, locale: Locale) {
  return new Date(ms).toLocaleString(numberLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  });
}

function statusLabel(status: EdgeTrack['status'], copy: ReturnType<typeof copyForLocale>) {
  if (status === 'active') return copy.analytics.statusActive;
  if (status === 'hourlyShelf') return copy.analytics.statusHourlyShelf;
  return copy.analytics.statusExpired;
}

function trackOptionLabel(track: EdgeTrack, locale: Locale) {
  const copy = copyForLocale(locale);
  const roundedDays = Math.round(track.summary.firstSeenRemainingMs / DAY_MS);
  const days = roundedDays < 1 ? 1 : roundedDays;
  return `${formatUtcInstant(track.settlementMs, locale)} · ${copy.analytics.marketTenorApprox(days)}`;
}

export function EdgeTrackTooltipContent({
  point,
  locale,
}: {
  point: EdgeTrackPoint;
  locale: Locale;
}) {
  const copy = copyForLocale(locale);
  return (
    <div className="analytics-edge-tooltip" role="status">
      <strong>
        {formatUtcInstant(point.boundaryMs, locale)} · {copy.analytics.tooltipRows(point.rowCount)}
      </strong>
      <div>
        <span>{copy.analytics.medianEdge}</span>
        <strong>{formatEdgePts(point.medianEdgePp, locale)}</strong>
      </div>
      <div>
        <span>{copy.analytics.tooltipRange}</span>
        <strong>
          {formatEdgePts(point.minEdgePp, locale)} – {formatEdgePts(point.maxEdgePp, locale)}
        </strong>
      </div>
      <div>
        <span>{copy.analytics.tooltipAnkerApr}</span>
        <strong>{formatApr(point.medianNetApr, locale)}</strong>
      </div>
      <div>
        <span>{copy.analytics.tooltipBinanceApr}</span>
        <strong>{formatApr(point.medianBenchmarkApr, locale)}</strong>
      </div>
    </div>
  );
}

function TrackSummaryStrip({ track, locale }: { track: EdgeTrack; locale: Locale }) {
  const copy = copyForLocale(locale);
  const { summary } = track;
  const entries: [string, string][] = [
    [copy.analytics.sampleCount, summary.sampleCount.toLocaleString(numberLocale(locale))],
    [
      copy.analytics.leadingPct,
      summary.leadingPct === null
        ? copy.analytics.emptyValue
        : formatPercent(summary.leadingPct, locale, { maximumFractionDigits: 1 }),
    ],
    [
      copy.analytics.medianEdge,
      summary.medianEdgePp === null
        ? copy.analytics.emptyValue
        : formatEdgePts(summary.medianEdgePp, locale),
    ],
    [
      copy.analytics.trackWindow,
      `${formatUtcInstant(summary.firstBoundaryMs, locale)} – ${formatUtcInstant(summary.lastBoundaryMs, locale)}`,
    ],
  ];
  return (
    <dl
      className="analytics-track-summary"
      aria-label={copy.analytics.trackSummaryLabel}
      data-testid="analytics-track-summary"
    >
      {entries.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function yDomain(track: EdgeTrack): [number, number] {
  const lo = Math.min(0, ...track.points.map((p) => p.minEdgePp));
  const hi = Math.max(0, ...track.points.map((p) => p.maxEdgePp));
  const pad = Math.max(0.01, (hi - lo) * 0.1);
  return [lo - pad, hi + pad];
}

/** Ticks at a readable 1/2/5 step; zero is a multiple of the step, so it always gets a tick. */
function yTicks([lo, hi]: [number, number]): number[] {
  const rawStep = (hi - lo) / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  const step = (normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1) * magnitude;
  const ticks: number[] = [];
  for (let tick = Math.ceil(lo / step) * step; tick <= hi + step / 1e6; tick += step) {
    ticks.push(Math.abs(tick) < step / 1e6 ? 0 : tick);
  }
  return ticks;
}

function TrackChart({ track, locale }: { track: EdgeTrack; locale: Locale }) {
  const copy = copyForLocale(locale);
  const spanMs =
    track.points[track.points.length - 1]!.boundaryMs - track.points[0]!.boundaryMs;
  const tickFormatter =
    spanMs < 48 * HOUR_MS
      ? (value: number) => formatUtcTime(value, locale)
      : (value: number) => formatUtcDay(value, locale);
  const domain = yDomain(track);
  const data = track.points.map((point) => ({
    ...point,
    band: [point.minEdgePp, point.maxEdgePp] as [number, number],
  }));

  return (
    <div className="analytics-edge-chart-frame" data-testid="analytics-edge-chart">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="var(--copper-line)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            type="number"
            dataKey="boundaryMs"
            domain={['dataMin', 'dataMax']}
            tickFormatter={tickFormatter}
            stroke="var(--ink-soft)"
            tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
          />
          <YAxis
            domain={domain}
            ticks={yTicks(domain)}
            tickFormatter={(value: number) => formatEdgePts(value, locale)}
            stroke="var(--ink-soft)"
            tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
            width={72}
          />
          <ReferenceLine
            y={0}
            stroke="var(--navy)"
            strokeWidth={2}
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
              const point = payload[0]?.payload as EdgeTrackPoint | undefined;
              if (!point) return null;
              return <EdgeTrackTooltipContent point={point} locale={locale} />;
            }}
          />
          <Area
            dataKey="band"
            stroke="none"
            fill="var(--navy)"
            fillOpacity={0.15}
            activeDot={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="medianEdgePp"
            type="monotone"
            stroke="var(--navy)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EdgeChart({
  edgeTracks,
  locale,
}: {
  edgeTracks: EdgeTracks;
  locale: Locale;
}) {
  const copy = copyForLocale(locale);
  const tracks = edgeTracks.tracks;
  const [selectedSettlementMs, setSelectedSettlementMs] = useState<number | null>(null);
  const selected =
    tracks.find((track) => track.settlementMs === selectedSettlementMs) ?? tracks[0] ?? null;
  const activeTracks = tracks.filter((track) => track.status === 'active');
  const endedTracks = tracks.filter((track) => track.status !== 'active');

  const renderOption = (track: EdgeTrack) => (
    <option key={track.settlementMs} value={track.settlementMs}>
      {trackOptionLabel(track, locale)}
    </option>
  );

  return (
    <section className="calculation-section analytics-edge-chart" aria-label={copy.analytics.chartLabel}>
      <div className="section-heading">
        <h2>{copy.analytics.chartTitle}</h2>
        <p>{copy.analytics.chartSubtitle}</p>
      </div>

      {selected === null ? (
        <p className="analytics-unavailable">{copy.analytics.chartEmpty}</p>
      ) : (
        <>
          <div className="analytics-track-controls">
            <label className="expiry-select analytics-track-select">
              <span className="di-select-label">{copy.analytics.marketSelectLabel}</span>
              <select
                aria-label={copy.analytics.marketSelectLabel}
                value={selected.settlementMs}
                onChange={(event) => setSelectedSettlementMs(Number(event.currentTarget.value))}
              >
                {activeTracks.length > 0 ? (
                  <optgroup label={copy.analytics.marketGroupActive}>
                    {activeTracks.map(renderOption)}
                  </optgroup>
                ) : null}
                {endedTracks.length > 0 ? (
                  <optgroup label={copy.analytics.marketGroupEnded}>
                    {endedTracks.map(renderOption)}
                  </optgroup>
                ) : null}
              </select>
            </label>
            <Badge tone={STATUS_TONE[selected.status]}>{statusLabel(selected.status, copy)}</Badge>
          </div>

          <TrackSummaryStrip track={selected} locale={locale} />

          {selected.points.length < 2 ? (
            <p className="analytics-unavailable">{copy.analytics.trackInsufficient}</p>
          ) : (
            <TrackChart track={selected} locale={locale} />
          )}
        </>
      )}
    </section>
  );
}
