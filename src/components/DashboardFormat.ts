export function formatAmount(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatPrice(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function formatApr(value: number) {
  return `${(value * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

export function formatPreciseAmount(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

export function formatBtcAmount(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

export function formatQuoteBaseUnits(value: bigint) {
  const scale = 1_000_000n;
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(6, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function formatPercent(value: number | null) {
  if (value === null) return 'Checking';
  return `${(value * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

export function formatExpiry(value: number) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

export function formatOracleTimestamp(value: number) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(value);
}

export function shortId(value: string) {
  return value ? `${value.slice(0, 8)}...${value.slice(-6)}` : '--';
}

const SUI_EXPLORER_BASE = 'https://suiscan.xyz/testnet';

export function suiExplorerTxUrl(digest: string) {
  return `${SUI_EXPLORER_BASE}/tx/${digest}`;
}

export function suiExplorerObjectUrl(objectId: string) {
  return `${SUI_EXPLORER_BASE}/object/${objectId}`;
}
