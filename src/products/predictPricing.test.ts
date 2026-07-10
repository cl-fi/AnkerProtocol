import { describe, expect, it } from 'vitest';
import { oracleMarketFromFixture } from '../test/oracleMarketFixture';
import {
  DEFAULT_MIN_PREDICT_ASK,
  estimateBinaryUpAskPrice,
  estimateBinaryUpFairPrice,
  estimatePredictSpreadFromFairPrice,
  estimateTargetBuyFloorPrice,
} from './predictPricing';
import type { OracleMarket } from './types';

function marketFixture(): OracleMarket {
  return oracleMarketFromFixture();
}

describe('estimateBinaryUpFairPrice', () => {
  it('estimates binary UP fair prices locally from oracle SVI parameters', () => {
    const market = marketFixture();

    expect(estimateBinaryUpFairPrice({ market, strike: 66_500 })).toBeGreaterThan(0.99);
    expect(estimateBinaryUpFairPrice({ market, strike: 72_500 })).toBeLessThan(0.99);
  });
});

describe('estimateBinaryUpAskPrice', () => {
  it('adds the Predict post-spread ask markup to the local fair price', () => {
    const market = marketFixture();
    const fairPrice = estimateBinaryUpFairPrice({ market, strike: 72_500 });
    const askPrice = estimateBinaryUpAskPrice({ market, strike: 72_500 });

    expect(fairPrice).not.toBeNull();
    expect(askPrice).not.toBeNull();
    expect(askPrice as number).toBeGreaterThan(fairPrice as number);
  });

  it('uses the chain minimum spread around low fair prices', () => {
    expect(estimatePredictSpreadFromFairPrice({ fairPrice: 0.02 })).toBe(0.005);
  });

  it('adds the vault utilization spread from market pricing state', () => {
    const baseMarket = marketFixture();
    const marketWithUtilization: OracleMarket = {
      ...baseMarket,
      predictPricing: {
        baseSpread: 0.02,
        minSpread: 0.005,
        utilizationMultiplier: 2,
        minAskPrice: 0.01,
        maxAskPrice: 0.99,
        vaultBalance: 1000,
        vaultTotalMtm: 500,
        vaultUtilization: 0.5,
      },
    };

    const withoutUtilization = estimateBinaryUpAskPrice({ market: baseMarket, strike: 72_500 });
    const withUtilization = estimateBinaryUpAskPrice({ market: marketWithUtilization, strike: 72_500 });

    expect(withoutUtilization).not.toBeNull();
    expect(withUtilization).not.toBeNull();
    expect(withUtilization as number).toBeGreaterThan(withoutUtilization as number);
  });
});

describe('estimateTargetBuyFloorPrice', () => {
  it('uses a 0.02 default lower ask boundary for local floor solving', () => {
    expect(DEFAULT_MIN_PREDICT_ASK).toBe(0.02);
  });

  it('raises a too-deep fixed floor toward the Predict ask bounds without network quotes', () => {
    const market = marketFixture();
    const floor = estimateTargetBuyFloorPrice({ market, targetPrice: 73_000 });
    const askPrice = estimateBinaryUpAskPrice({ market, strike: floor });

    expect(floor).toBeGreaterThan(68_000);
    expect(floor).toBeLessThan(73_000);
    expect(askPrice).not.toBeNull();
    expect(askPrice as number).toBeLessThanOrEqual(0.9855);
  });

  it('falls back to the old fixed floor distance when SVI is unavailable', () => {
    const { svi, ...market } = marketFixture();

    expect(estimateTargetBuyFloorPrice({ market, targetPrice: 73_000 })).toBe(68_000);
    expect(svi).toBeDefined();
  });
});
