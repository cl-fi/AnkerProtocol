import Link from 'next/link';
import { localeLabel, localizedPath, SUPPORTED_LOCALES, type Locale } from '../i18n';

export function LanguageSwitcher({ locale, currentPath }: { locale: Locale; currentPath: string }) {
  return (
    <nav className="language-switcher" aria-label="Language">
      {SUPPORTED_LOCALES.map((nextLocale) => (
        <Link
          aria-current={nextLocale === locale ? 'true' : undefined}
          className={nextLocale === locale ? 'is-active' : undefined}
          href={localizedPath(nextLocale, currentPath)}
          key={nextLocale}
        >
          {localeLabel(nextLocale)}
        </Link>
      ))}
    </nav>
  );
}
