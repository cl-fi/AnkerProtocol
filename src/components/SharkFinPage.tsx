'use client';

import { useMemo, useState } from 'react';
import { isDemoMode } from '../config/runtimeModes';
import { useMarketData } from '../hooks/useMarketData';
import { copyForLocale, DEFAULT_LOCALE, formattersForLocale, type Locale } from '../i18n';
import { isProductLineTradingEnabled } from '../products/productLineMarkets';
import { AppFooter } from './AppFooter';
import { AppHeader } from './AppHeader';
import { DegradationBanner } from './DegradationBanner';
import { Card } from '../ui';

export function SharkFinPage({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const copy = copyForLocale(locale);
  const format = formattersForLocale(locale);
  const [selectedOracleId, setSelectedOracleId] = useState<string | undefined>();
  const marketQuery = useMarketData(selectedOracleId, 'multi-day');
  const market = marketQuery.data?.market;
  const productOracles = marketQuery.data?.productOracles ?? [];
  const dataSourceKind = marketQuery.data?.dataSource ?? 'live';
  const fixtureDegraded = dataSourceKind === 'fixture';
  const tradingEnabled = isProductLineTradingEnabled({
    dataSourceKind,
    demoMode: isDemoMode(),
  });

  const bounds = useMemo(() => {
    if (!market) return null;
    const lower = Math.floor(market.spot * 0.95);
    const upper = Math.ceil(market.spot * 1.05);
    return { lower, upper };
  }, [market]);

  return (
    <main className="dual-page" id="shark-fin">
      <AppHeader activeProduct="shark-fin" locale={locale} />
      <DegradationBanner locale={locale} visible={fixtureDegraded} />

      <section className="dual-hero calculation-hero">
        <div>
          <h1>{copy.sharkFin.title}</h1>
          <p>{copy.sharkFin.subtitle}</p>
        </div>
        <div className="di-hero-ticker">
          <span className="di-hero-label">
            {copy.dualInvestment.btcPrice}
            <span className={fixtureDegraded ? 'di-live-flag is-stale' : 'di-live-flag'}>
              <span className="di-live-dot" aria-hidden="true" />
              {fixtureDegraded ? copy.degradation.sourceFixture : copy.degradation.sourceLive}
            </span>
          </span>
          <strong>{market ? format.usd(market.spot) : '--'}</strong>
        </div>
      </section>

      <Card as="section" className="shark-fin-preview">
        <p>{copy.sharkFin.previewBody}</p>
        <label className="shark-fin-tenor">
          <span>{copy.dualInvestment.tenor}</span>
          <select
            value={selectedOracleId ?? marketQuery.data?.selectedOracleId ?? ''}
            onChange={(event) => setSelectedOracleId(event.target.value || undefined)}
            aria-label={copy.dualInvestment.chooseMarketLabel}
          >
            {productOracles.map((oracle) => (
              <option key={oracle.oracle_id} value={oracle.oracle_id}>
                {format.expiry(oracle.expiry)}
              </option>
            ))}
          </select>
        </label>
        {bounds ? (
          <dl className="shark-fin-bounds" aria-label={copy.sharkFin.boundsLabel}>
            <div>
              <dt>{copy.sharkFin.lowerBound}</dt>
              <dd>{format.usd(bounds.lower)}</dd>
            </div>
            <div>
              <dt>{copy.sharkFin.upperBound}</dt>
              <dd>{format.usd(bounds.upper)}</dd>
            </div>
          </dl>
        ) : null}
        {!tradingEnabled ? (
          <p className="degradation-subscribe-note" role="status">
            {fixtureDegraded ? copy.degradation.subscribeDisabled : copy.sharkFin.tradingClosed}
          </p>
        ) : null}
      </Card>

      <AppFooter locale={locale} />
    </main>
  );
}
