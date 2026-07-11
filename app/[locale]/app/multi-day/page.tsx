import { DualInvestmentPage } from '../../../../src/components/DualInvestmentPage';
import { normalizeLocale } from '../../../../src/i18n';

export default function Page({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  return <DualInvestmentPage locale={locale} productLine="multi-day" />;
}
