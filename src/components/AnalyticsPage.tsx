import type { HeadlineStats } from '../recorder/aggregateHeadlineStats';
import type { AnalyticsStatsLoad } from '../recorder/loadAnalyticsStats';
import {
  copyForLocale,
  DEFAULT_LOCALE,
  formatEdgePts,
  formatInteger,
  formatPercent,
  type Locale,
} from '../i18n';
import { AppFooter } from './AppFooter';
import { AppHeader } from './AppHeader';
import { EdgeChart } from './EdgeChart';
import { Stat, StatGroup } from '../ui';

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

function HeadlineStatsCards({
  stats,
  locale,
}: {
  stats: HeadlineStats | null;
  locale: Locale;
}) {
  const copy = copyForLocale(locale);
  const empty = copy.analytics.emptyValue;

  return (
    <StatGroup className="analytics-stats">
      <Stat
        label={copy.analytics.sampleCount}
        value={stats ? formatInteger(stats.sampleCount, locale) : empty}
      />
      <Stat
        label={copy.analytics.leadingPct}
        value={statOrEmpty(
          stats?.leadingPct == null ? null : formatPercent(stats.leadingPct, locale, { maximumFractionDigits: 1 }),
          empty,
        )}
      />
      <Stat
        label={copy.analytics.medianEdge}
        value={statOrEmpty(
          stats?.medianEdgePp == null ? null : formatEdgePts(stats.medianEdgePp, locale),
          empty,
        )}
      />
      <Stat
        label={copy.analytics.leadingStreak}
        value={stats ? formatInteger(stats.currentLeadingStreak, locale) : empty}
        sub={stats ? copy.analytics.leadingStreakUnit : undefined}
      />
      <Stat
        label={copy.analytics.ladderCoverage}
        value={statOrEmpty(
          stats?.ladderCoverage == null
            ? null
            : formatPercent(stats.ladderCoverage, locale, { maximumFractionDigits: 1 }),
          empty,
        )}
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
  const edgeSeries = load.kind === 'ready' ? load.edgeSeries : { series: [] };
  const showUnavailableBanner = load.kind === 'unavailable' || (stats !== null && stats.sampleCount === 0);
  const startDate = formatSampleStartDate(stats?.sampleStartMs ?? null, locale);

  return (
    <main className="dual-page" id="benchmark-analytics">
      <AppHeader activeProduct="analytics" locale={locale} />

      <section className="dual-hero calculation-hero">
        <div>
          <h1>{copy.analytics.title}</h1>
          <p>{copy.analytics.subtitle}</p>
        </div>
      </section>

      <section className="calculation-section" aria-label={copy.analytics.statsLabel}>
        {showUnavailableBanner ? <p className="analytics-unavailable">{copy.analytics.unavailable}</p> : null}
        <HeadlineStatsCards stats={stats} locale={locale} />
      </section>

      <EdgeChart edgeSeries={edgeSeries} locale={locale} />

      <section className="calculation-section analytics-methodology" aria-labelledby="analytics-methodology-title">
        <div className="section-heading">
          <h2 id="analytics-methodology-title">{copy.analytics.methodologyTitle}</h2>
        </div>
        <p className="analytics-methodology-intro">{copy.analytics.methodologyIntro}</p>
        <ul>
          <li>{copy.analytics.methodologyCadence}</li>
          <li>{copy.analytics.methodologyMatching}</li>
          <li>{copy.analytics.methodologyFeeBasis}</li>
          <li>{copy.analytics.methodologyDenominator}</li>
          <li>
            {startDate
              ? copy.analytics.methodologyStartDate(startDate)
              : copy.analytics.methodologyStartPending}
          </li>
          <li>
            <a href={copy.analytics.methodologyRepoUrl} target="_blank" rel="noreferrer">
              {copy.analytics.methodologyRepo}
            </a>
          </li>
        </ul>
      </section>

      <AppFooter locale={locale} />
    </main>
  );
}
