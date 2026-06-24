import { HomePage } from '../../src/components/HomePage';
import { normalizeLocale } from '../../src/i18n';

export default function Page({ params }: { params: { locale: string } }) {
  return <HomePage locale={normalizeLocale(params.locale)} />;
}
