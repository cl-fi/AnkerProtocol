import { describe, expect, it } from 'vitest';
import {
  buildBinanceDualInvestmentUrl,
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
