import { DashboardPage } from '../../../../src/components/DashboardPage';
import { normalizeLocale } from '../../../../src/i18n';

export default function Page({ params }: { params: { locale: string } }) {
  return <DashboardPage locale={normalizeLocale(params.locale)} />;
}
