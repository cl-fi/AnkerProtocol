import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildBinanceDualInvestmentUrl,
  fetchBinanceDualInvestmentProducts,
  findBinanceDualInvestmentMatch,
  type BinanceDualInvestmentProduct,
} from './binanceDualInvestment';

const baseProduct: BinanceDualInvestmentProduct = {
  id: 'binance-1',
  investmentAsset: 'USDC',
  targetAsset: 'BTC',
  strikePrice: 71_000,
  settleTimeMs: Date.UTC(2026, 5, 12, 8),
  apr: 0.42,
  durationDays: 10,
  canPurchase: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('findBinanceDualInvestmentMatch', () => {
  it('matches the same strike and exact settlement time', () => {
    const match = findBinanceDualInvestmentMatch({
      products: [
        { ...baseProduct, id: 'wrong-strike', strikePrice: 70_500, apr: 0.8 },
        baseProduct,
        { ...baseProduct, id: 'wrong-settlement', settleTimeMs: Date.UTC(2026, 5, 13, 8), apr: 0.9 },
      ],
      targetPrice: 71_000,
      settlementTimeMs: Date.UTC(2026, 5, 12, 8),
    });

    expect(match?.id).toBe('binance-1');
  });

  it('prefers purchasable rows, then higher APR', () => {
    const match = findBinanceDualInvestmentMatch({
      products: [
        { ...baseProduct, id: 'higher-but-closed', apr: 0.6, canPurchase: false },
        { ...baseProduct, id: 'lower-open', apr: 0.4, canPurchase: true },
      ],
      targetPrice: 71_000,
      settlementTimeMs: Date.UTC(2026, 5, 12, 8),
    });

    expect(match?.id).toBe('lower-open');
  });

  it('falls back to matching by UTC settlement date when exact timestamps differ', () => {
    const match = findBinanceDualInvestmentMatch({
      products: [
        { ...baseProduct, id: 'wrong-date', settleTimeMs: Date.UTC(2026, 5, 13, 8) },
        { ...baseProduct, id: 'same-date', settleTimeMs: Date.UTC(2026, 5, 12, 8) },
      ],
      targetPrice: 71_000,
      settlementTimeMs: Date.UTC(2026, 5, 12, 0),
    });

    expect(match?.id).toBe('same-date');
  });
});

describe('buildBinanceDualInvestmentUrl', () => {
  it('uses USDC collateral and DOWN projects for target buy comparison', () => {
    const url = buildBinanceDualInvestmentUrl({
      pageIndex: 1,
      pageSize: 100,
    });

    expect(url.searchParams.get('investmentAsset')).toBe('USDC');
    expect(url.searchParams.get('targetAsset')).toBe('BTC');
    expect(url.searchParams.get('projectType')).toBe('DOWN');
  });
});

describe('fetchBinanceDualInvestmentProducts', () => {
  it('accepts the live Binance BAPI success code format', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: '000000',
        message: null,
        data: {
          total: '1',
          list: [
            {
              id: 'binance-live-format',
              investmentAsset: 'USDC',
              targetAsset: 'BTC',
              strikePrice: '64000.00000000',
              settleTime: '1782115200000',
              apr: '1.45480000',
              duration: '1',
              canPurchase: true,
            },
          ],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBinanceDualInvestmentProducts({ pageSize: 1, maxPageCount: 1 })).resolves.toMatchObject([
      {
        id: 'binance-live-format',
        strikePrice: 64_000,
        apr: 1.4548,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/bapi/earn/v5/friendly/pos/dc/project/list'),
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'omit',
        headers: expect.objectContaining({
          accept: 'application/json, text/plain, */*',
        }),
      }),
    );
  });
});
