import { AnalyticsPage } from '../../../src/components/AnalyticsPage';
import { normalizeLocale } from '../../../src/i18n';
import { loadAnalyticsStats } from '../../../src/recorder/loadAnalyticsStats';

export default async function Page({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const load = await loadAnalyticsStats();
  return <AnalyticsPage locale={locale} load={load} />;
}
