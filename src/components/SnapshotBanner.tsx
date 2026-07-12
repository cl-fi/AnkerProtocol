'use client';

import { Camera } from 'lucide-react';
import { copyForLocale, DEFAULT_LOCALE, type Locale } from '../i18n';

/**
 * Snapshot-tier banner (CONTEXT: Snapshot — photograph model). Shown only when
 * day rows come from the committed capture; Legacy Oracle rows are live data
 * and deliberately show no banner.
 */
export function SnapshotBanner({
  locale = DEFAULT_LOCALE,
  capturedAtLabel,
  visible,
}: {
  locale?: Locale;
  capturedAtLabel: string;
  visible: boolean;
}) {
  if (!visible) return null;
  const copy = copyForLocale(locale);
  return (
    <aside className="demo-banner degradation-banner" role="status">
      <Camera size={16} aria-hidden="true" />
      <p>
        <strong>{copy.migration.snapshotBannerTitle}</strong>
        <span>{copy.migration.snapshotBannerBody(capturedAtLabel)}</span>
      </p>
    </aside>
  );
}
