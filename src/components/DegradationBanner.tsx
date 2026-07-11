'use client';

import { Megaphone } from 'lucide-react';
import { copyForLocale, DEFAULT_LOCALE, type Locale } from '../i18n';

/** D4 product-line degradation banner — distinct from site-wide demo mode. */
export function DegradationBanner({
  locale = DEFAULT_LOCALE,
  visible,
}: {
  locale?: Locale;
  visible: boolean;
}) {
  if (!visible) return null;
  const copy = copyForLocale(locale);
  return (
    <aside className="demo-banner degradation-banner" role="status">
      <Megaphone size={16} aria-hidden="true" />
      <p>
        <strong>{copy.degradation.bannerTitle}</strong>
        <span>{copy.degradation.bannerBody}</span>
      </p>
    </aside>
  );
}
