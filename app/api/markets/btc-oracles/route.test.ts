import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

describe('/api/markets/btc-oracles', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('serves deterministic product-ready BTC oracle fixtures for e2e runs', async () => {
    vi.stubEnv('ANKER_DETERMINISTIC_E2E', 'true');

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('s-maxage=15, stale-while-revalidate=30');
    const payload = await response.json();
    expect(payload.oracles).toHaveLength(3);
    expect(payload.oracles).toEqual([
      expect.objectContaining({
        underlying_asset: 'BTC',
        status: 'active',
        productReady: true,
        quoteReady: true,
        stateReady: true,
        cadence: '1h',
      }),
      expect.objectContaining({
        underlying_asset: 'BTC',
        status: 'active',
        productReady: true,
        quoteReady: true,
        stateReady: true,
        cadence: '1h',
      }),
      expect.objectContaining({
        underlying_asset: 'BTC',
        status: 'active',
        productReady: true,
        quoteReady: true,
        stateReady: true,
        cadence: '1h',
      }),
    ]);
  });
});
