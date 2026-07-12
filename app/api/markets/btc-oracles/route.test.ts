import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

describe('/api/markets/btc-oracles', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('serves one merged deterministic response for e2e runs: day rows first, then hourly', async () => {
    vi.stubEnv('ANKER_DETERMINISTIC_E2E', 'true');

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('s-maxage=15, stale-while-revalidate=30');
    const payload = await response.json();

    const dayRows = payload.oracles.filter((oracle: { group: string }) => oracle.group === 'day');
    const hourlyRows = payload.oracles.filter((oracle: { group: string }) => oracle.group === 'hourly');

    expect(dayRows.length).toBeGreaterThan(0);
    expect(hourlyRows).toHaveLength(3);
    expect(payload.oracles.slice(0, dayRows.length).every((oracle: { group: string }) => oracle.group === 'day')).toBe(
      true,
    );
    expect(
      dayRows.every(
        (oracle: { source: string; market?: unknown; underlying_asset: string }) =>
          oracle.source === 'snapshot' && Boolean(oracle.market) && oracle.underlying_asset === 'BTC',
      ),
    ).toBe(true);
    expect(
      hourlyRows.every(
        (oracle: { source: string; cadence?: string; productReady: boolean }) =>
          oracle.source === 'live' && oracle.cadence === '1h' && oracle.productReady,
      ),
    ).toBe(true);
    expect(payload.snapshot.capturedAtMs).toBeGreaterThan(0);
    expect(payload.snapshot.binanceProducts.length).toBeGreaterThan(0);
  });
});
