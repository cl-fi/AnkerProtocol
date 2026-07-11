import { SharkFinPage } from '../../../../src/components/SharkFinPage';
import { normalizeLocale } from '../../../../src/i18n';

export default function Page({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  return <SharkFinPage locale={locale} />;
}
