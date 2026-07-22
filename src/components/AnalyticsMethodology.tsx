'use client';

import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { copyForLocale, type Locale } from '../i18n';
import { Dialog } from '../ui';

function MethodologyDefinitions({ locale, startDate }: { locale: Locale; startDate: string | null }) {
  const copy = copyForLocale(locale);
  return (
    <>
      <dl className="analytics-methodology-grid">
        {copy.analytics.methodologyEntries.map((entry) => (
          <div key={entry.term}>
            <dt>{entry.term}</dt>
            <dd>{entry.def}</dd>
          </div>
        ))}
        <div>
          <dt>{copy.analytics.methodologyStartTerm}</dt>
          <dd>
            {startDate ? copy.analytics.methodologyStartDate(startDate) : copy.analytics.methodologyStartPending}
          </dd>
        </div>
      </dl>
      <p className="analytics-methodology-source">
        <a href={copy.analytics.methodologyRepoUrl} target="_blank" rel="noreferrer">
          {copy.analytics.methodologyRepo}
        </a>
      </p>
    </>
  );
}

/**
 * Methodology section — term/definition cards inline on desktop; phones get
 * one nav row into a Dialog bottom sheet instead (CSS gates which shows, so
 * server markup stays viewport-agnostic).
 */
export function AnalyticsMethodology({ locale, startDate }: { locale: Locale; startDate: string | null }) {
  const copy = copyForLocale(locale);
  const [open, setOpen] = useState(false);

  return (
    <section className="calculation-section analytics-methodology" aria-labelledby="analytics-methodology-title">
      <div className="section-heading">
        <h2 id="analytics-methodology-title">{copy.analytics.methodologyTitle}</h2>
      </div>
      <p className="analytics-methodology-intro">{copy.analytics.methodologyIntro}</p>

      <button
        type="button"
        className="analytics-methodology-trigger"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span>{copy.analytics.methodologyTitle}</span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      <div className="analytics-methodology-inline">
        <MethodologyDefinitions locale={locale} startDate={startDate} />
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel={copy.analytics.methodologyTitle}
        closeLabel={copy.common.close}
        className="analytics-methodology-sheet"
      >
        <header className="analytics-methodology-sheet-head">
          <h2>{copy.analytics.methodologyTitle}</h2>
        </header>
        <MethodologyDefinitions locale={locale} startDate={startDate} />
      </Dialog>
    </section>
  );
}
