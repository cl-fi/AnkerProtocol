import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAllowedPredictProxyPath } from './allowlist';
import { GET } from './route';

describe('/api/predict proxy allowlist', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('allows only the Predict 6-24 endpoints used by the app', () => {
    expect(isAllowedPredictProxyPath('status')).toBe(true);
    expect(isAllowedPredictProxyPath('markets')).toBe(true);
    expect(
      isAllowedPredictProxyPath(
        'markets/0xd92bc50a867db16486dafb4bec5baeca9770a689dea4df062394cb678a3a3e01/state',
      ),
    ).toBe(true);
    expect(isAllowedPredictProxyPath('managers')).toBe(false);
    expect(isAllowedPredictProxyPath('predicts/0x123/oracles')).toBe(false);
    expect(isAllowedPredictProxyPath('oracles/0x456/state')).toBe(false);
    expect(isAllowedPredictProxyPath('admin/debug')).toBe(false);
  });

  it('rejects disallowed paths before fetching upstream', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(new Request('http://localhost/api/predict/admin/debug'), {
      params: { path: ['admin', 'debug'] },
    });

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects oversized upstream responses instead of proxying them to clients', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: 'x'.repeat(1_100_000) }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const response = await GET(new Request('http://localhost/api/predict/status'), {
      params: { path: ['status'] },
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('too large'),
    });
  });

  it('adds stale-while-revalidate cache headers to allowed proxy responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const response = await GET(new Request('http://localhost/api/predict/status'), {
      params: { path: ['status'] },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('s-maxage=5, stale-while-revalidate=30');
  });

  it('rate limits repeated allowed proxy requests before fetching upstream', async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    let response = new Response();
    for (let index = 0; index < 61; index += 1) {
      response = await GET(
        new Request('http://localhost/api/predict/status', {
          headers: { 'x-forwarded-for': '203.0.113.60' },
        }),
        { params: { path: ['status'] } },
      );
    }

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(fetchMock).toHaveBeenCalledTimes(60);
  });

  it('serves deterministic Predict fixtures without fetching upstream during e2e runs', async () => {
    const fetchMock = vi.fn();
    vi.stubEnv('ANKER_DETERMINISTIC_E2E', 'true');
    vi.stubGlobal('fetch', fetchMock);

    const status = await GET(new Request('http://localhost/api/predict/status'), {
      params: { path: ['status'] },
    });
    const markets = await GET(new Request('http://localhost/api/predict/markets'), {
      params: { path: ['markets'] },
    });

    expect(status.status).toBe(200);
    expect(markets.status).toBe(200);
    await expect(status.json()).resolves.toMatchObject({ status: 'OK' });
    await expect(markets.json()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expiry_market_id: expect.stringMatching(/^0x/),
          tick_size: expect.any(String),
          admission_tick_size: expect.any(String),
        }),
      ]),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serves fixtures in demo mode without fetching upstream', async () => {
    const fetchMock = vi.fn();
    vi.stubEnv('NEXT_PUBLIC_ANKER_DEMO_MODE', 'true');
    vi.stubGlobal('fetch', fetchMock);

    const status = await GET(new Request('http://localhost/api/predict/status'), {
      params: { path: ['status'] },
    });
    const markets = await GET(new Request('http://localhost/api/predict/markets'), {
      params: { path: ['markets'] },
    });

    expect(status.status).toBe(200);
    await expect(status.json()).resolves.toMatchObject({ status: 'OK' });
    expect(markets.status).toBe(200);
    await expect(markets.json()).resolves.toEqual(expect.any(Array));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
