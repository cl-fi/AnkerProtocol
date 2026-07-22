import { ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { HeadlineStats } from '../recorder/aggregateHeadlineStats';
import type { AnalyticsStatsLoad } from '../recorder/loadAnalyticsStats';
import {
  copyForLocale,
  DEFAULT_LOCALE,
  formatEdgePts,
  formatInteger,
  formatPercent,
  localizedPath,
  type Locale,
} from '../i18n';
import { AnalyticsMethodology } from './AnalyticsMethodology';
import { AnalyticsRecorderStatus } from './AnalyticsRecorderStatus';
import { AppFooter } from './AppFooter';
import { AppHeader } from './AppHeader';
import { EdgeChart } from './EdgeChart';
import { buttonClassName, Stat, StatGroup } from '../ui';

function formatSampleStartDate(sampleStartMs: number | null, locale: Locale) {
  if (sampleStartMs === null) return null;
  const numberLocale = locale === 'zh-CN' ? 'zh-CN' : 'en-US';
  return new Date(sampleStartMs).toLocaleDateString(numberLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function statOrEmpty(value: string | null, empty: string) {
  return value ?? empty;
}

/**
 * Verdict band — the page's one-sentence story ("Anker leads X% of the time,
 * by Y pts"), promoted above the supporting counts. Mirrors the Portfolio
 * wallet band: display-size hero figure + gold accent pill.
 */
function VerdictBand({
  stats,
  startDate,
  locale,
}: {
  stats: HeadlineStats | null;
  startDate: string | null;
  locale: Locale;
}) {
  const copy = copyForLocale(locale);
  const leadingPct =
    stats?.leadingPct == null ? null : formatPercent(stats.leadingPct, locale, { maximumFractionDigits: 1 });
  const medianEdge = stats?.medianEdgePp == null ? null : formatEdgePts(stats.medianEdgePp, locale);
  const samples = stats === null ? null : formatInteger(stats.sampleCount, locale);

  return (
    <div className="analytics-verdict">
      <span className="analytics-verdict-label">{copy.analytics.leadingPct}</span>
      <span className="analytics-verdict-row">
        <strong className="analytics-verdict-value">{leadingPct ?? copy.analytics.emptyValue}</strong>
        {medianEdge !== null ? (
          <em className="analytics-verdict-edge">
            <Sparkles size={13} aria-hidden="true" />
            <span>{copy.analytics.medianEdge}</span> {medianEdge}
          </em>
        ) : null}
      </span>
      {samples !== null ? (
        <span className="analytics-verdict-support">
          {startDate
            ? copy.analytics.verdictSupport(samples, startDate)
            : copy.analytics.verdictSupportNoDate(samples)}
        </span>
      ) : null}
    </div>
  );
}

/** Supporting tiles: data-credibility metrics, deliberately below the verdict. */
function SupportingStats({ stats, locale }: { stats: HeadlineStats | null; locale: Locale }) {
  const copy = copyForLocale(locale);
  const empty = copy.analytics.emptyValue;

  return (
    <StatGroup className="analytics-stats">
      <Stat
        label={copy.analytics.sampleCount}
        value={stats ? formatInteger(stats.sampleCount, locale) : empty}
        hint={copy.analytics.sampleCountHint}
      />
      <Stat
        label={copy.analytics.leadingStreak}
        value={stats ? formatInteger(stats.currentLeadingStreak, locale) : empty}
        sub={stats ? copy.analytics.leadingStreakUnit : undefined}
        hint={copy.analytics.leadingStreakHint}
      />
      <Stat
        label={copy.analytics.ladderCoverage}
        value={statOrEmpty(
          stats?.ladderCoverage == null
            ? null
            : formatPercent(stats.ladderCoverage, locale, { maximumFractionDigits: 1 }),
          empty,
        )}
        hint={copy.analytics.ladderCoverageHint}
      />
    </StatGroup>
  );
}

export function AnalyticsPage({
  locale = DEFAULT_LOCALE,
  load,
}: {
  locale?: Locale;
  load: AnalyticsStatsLoad;
}) {
  const copy = copyForLocale(locale);
  const stats = load.kind === 'ready' ? load.stats : null;
  const edgeTracks = load.kind === 'ready' ? load.edgeTracks : { tracks: [] };
  const showUnavailableBanner = load.kind === 'unavailable' || (stats !== null && stats.sampleCount === 0);
  const startDate = formatSampleStartDate(stats?.sampleStartMs ?? null, locale);
  const lastRunMs =
    edgeTracks.tracks.length === 0
      ? null
      : Math.max(...edgeTracks.tracks.map((track) => track.summary.lastBoundaryMs));

  return (
    <main className="dual-page" id="benchmark-analytics">
      <AppHeader activeProduct="analytics" locale={locale} />

      <section className="dual-hero calculation-hero analytics-hero">
        <div>
          <h1>{copy.analytics.title}</h1>
          <p>{copy.analytics.subtitle}</p>
        </div>
        <AnalyticsRecorderStatus lastRunMs={lastRunMs} locale={locale} />
      </section>

      <section className="calculation-section" aria-label={copy.analytics.statsLabel}>
        {showUnavailableBanner ? <p className="analytics-unavailable">{copy.analytics.unavailable}</p> : null}
        <VerdictBand stats={stats} startDate={startDate} locale={locale} />
        <SupportingStats stats={stats} locale={locale} />
      </section>

      <EdgeChart edgeTracks={edgeTracks} locale={locale} />

      <AnalyticsMethodology locale={locale} startDate={startDate} />

      {/* Close the loop: the Edge shown here historically is live, rung by
          rung, on the product ladder — send the convinced reader there.
          Desktop-only: the phone tab dock already navigates to the product. */}
      <section className="calculation-section analytics-cta-section">
        <div className="analytics-cta">
          <div>
            <h2>{copy.analytics.ctaTitle}</h2>
            <p>{copy.analytics.ctaBody}</p>
          </div>
          <Link className={buttonClassName()} href={localizedPath(locale, '/app/dual-investment')}>
            {copy.analytics.ctaButton}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <AppFooter locale={locale} />
    </main>
  );
}
