export function formatTimeToExpiry(expiryMs: number, nowMs = Date.now()): string {
  const totalMinutes = Math.max(0, Math.floor((expiryMs - nowMs) / 60_000));
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${hours}h ${minutes}m`;
}
