import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

describe('/api/binance/dual-investment', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns Binance Dual Investment products without requiring the experimental product flag', async () => {
    vi.stubEnv('ENABLE_EXPERIMENTAL_PRODUCTS', '');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_EXPERIMENTAL_PRODUCTS', '');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            total: '1',
            list: [
              {
                id: 'binance-1',
                investmentAsset: 'USDC',
                targetAsset: 'BTC',
                strikePrice: '64000',
                settleTime: '1782086400000',
                apr: '1.4502',
                duration: '1',
                canPurchase: true,
              },
            ],
          },
        }),
      }),
    );

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject([
      {
        id: 'binance-1',
        strikePrice: 64_000,
        apr: 1.4502,
      },
    ]);
  });
});
