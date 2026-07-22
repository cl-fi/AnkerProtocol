'use client';

import { useEffect, useState } from 'react';
import { copyForLocale, type Locale } from '../i18n';
import { formatInstant, offsetLabel, useDisplayTimeZone } from './EdgeChart';

const RUN_CADENCE_MS = 15 * 60_000;
/** Two missed Runs on the 15-minute cadence reads as "Delayed", not jitter. */
const DELAYED_AFTER_MS = 3 * RUN_CADENCE_MS;

/**
 * Hero-right slot: the Recorder heartbeat — analytics' counterpart to the
 * product page's live-price ticker. Freshness is judged only after hydration
 * (server "now" and a cached ISR page must not disagree with the viewer).
 */
export function AnalyticsRecorderStatus({
  lastRunMs,
  locale,
}: {
  lastRunMs: number | null;
  locale: Locale;
}) {
  const copy = copyForLocale(locale);
  const timeZone = useDisplayTimeZone();
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => setNowMs(Date.now()), []);

  if (lastRunMs === null) return null;

  const delayed = nowMs !== null && nowMs - lastRunMs > DELAYED_AFTER_MS;

  // Kicker and timestamp are wrapped so phones can retire them (the hero
  // keeps just the LIVE chip; the chart caption restates the last Run).
  return (
    <div className="di-hero-ticker analytics-recorder">
      <span className="di-hero-label">
        <span className="analytics-recorder-kicker">{copy.analytics.recorderKicker}</span>
        <span className={delayed ? 'di-live-flag is-stale' : 'di-live-flag'}>
          <span className="di-live-dot" aria-hidden="true" />
          {delayed ? copy.analytics.recorderDelayed : copy.analytics.recorderLive}
        </span>
      </span>
      <strong className="analytics-recorder-lastrun">
        {copy.analytics.recorderLastRun(
          `${formatInstant(lastRunMs, locale, timeZone)} (${offsetLabel(lastRunMs, timeZone)})`,
        )}
      </strong>
    </div>
  );
}
