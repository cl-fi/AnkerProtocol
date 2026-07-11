import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

describe('/api/markets/btc-oracles', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('serves deterministic product-ready BTC oracle fixtures for e2e runs', async () => {
    vi.stubEnv('ANKER_DETERMINISTIC_E2E', 'true');

    const response = await GET(new Request('http://localhost/api/markets/btc-oracles'));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('s-maxage=15, stale-while-revalidate=30');
    const payload = await response.json();
    expect(payload.dataSource).toBe('live');
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

  it('serves labeled day-scale fixtures for the multi-day product line', async () => {
    vi.stubEnv('ANKER_DETERMINISTIC_E2E', 'true');

    const response = await GET(
      new Request('http://localhost/api/markets/btc-oracles?productLine=multi-day'),
    );
    const payload = await response.json();

    expect(payload.dataSource).toBe('fixture');
    expect(payload.reason).toBe('no-day-scale-markets');
    expect(payload.oracles.length).toBeGreaterThan(0);
    expect(payload.oracles[0]).toMatchObject({
      productLine: 'multi-day',
      productReady: true,
      underlying_asset: 'BTC',
    });
  });
});
