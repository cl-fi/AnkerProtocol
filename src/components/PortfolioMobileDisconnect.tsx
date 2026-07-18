import { LogOut } from 'lucide-react';
import { copyForLocale, DEFAULT_LOCALE, type Locale } from '../i18n';

/** The mobile-only wallet footer; responsive CSS owns its visibility. */
export function PortfolioMobileDisconnect({
  locale = DEFAULT_LOCALE,
  onDisconnect,
}: {
  locale?: Locale;
  onDisconnect: () => void;
}) {
  const copy = copyForLocale(locale);
  return (
    <div className="pf-wallet-mobile-footer">
      <button type="button" className="pf-wallet-disconnect" onClick={onDisconnect}>
        <LogOut size={16} aria-hidden="true" />
        {copy.wallet.disconnect}
      </button>
    </div>
  );
}
