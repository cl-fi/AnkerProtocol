import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

describe('/api/binance/dual-investment', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is disabled unless experimental products are explicitly enabled', async () => {
    vi.stubEnv('ENABLE_EXPERIMENTAL_PRODUCTS', '');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_EXPERIMENTAL_PRODUCTS', '');

    const response = await GET();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Experimental products are disabled'),
    });
  });
});
