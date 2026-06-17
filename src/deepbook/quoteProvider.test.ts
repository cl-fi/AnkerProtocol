import { describe, expect, it } from 'vitest';
import { applyPredictMintBounds, normalizePreviewResult, parseDevInspectLegAmounts } from './quoteProvider';

describe('normalizePreviewResult', () => {
  it('normalizes mint cost and redeem payout', () => {
    expect(normalizePreviewResult({ mintCost: '12', redeemPayout: '9' })).toEqual({
      askCost: 12,
      redeemPreview: 9,
    });
  });
});

describe('parseDevInspectLegAmounts', () => {
  it('reads every quote-return pair from a batched devInspect result', () => {
    const result = {
      results: [
        { returnValues: [[[1], 'deepbook_predict::market_key::MarketKey']] },
        {
          returnValues: [
            [[1, 0, 0, 0, 0, 0, 0, 0], 'u64'],
            [[2, 0, 0, 0, 0, 0, 0, 0], 'u64'],
          ],
        },
        { returnValues: [[[3], 'deepbook_predict::market_key::MarketKey']] },
        {
          returnValues: [
            [[3, 0, 0, 0, 0, 0, 0, 0], 'u64'],
            [[4, 0, 0, 0, 0, 0, 0, 0], 'u64'],
          ],
        },
      ],
    };

    expect(parseDevInspectLegAmounts(result, 2)).toEqual([
      { mintCost: 1n, redeemPayout: 2n },
      { mintCost: 3n, redeemPayout: 4n },
    ]);
  });
});

describe('applyPredictMintBounds', () => {
  it('marks quoted legs outside the Predict mint ask bounds as not executable', () => {
    const quote = applyPredictMintBounds(
      {
        id: 'up-64667',
        instrumentType: 'binary-up',
        oracleId: '0xoracle',
        expiryMs: 1,
        strike: 64_667,
        isUp: true,
        quantity: 1,
        description: 'UP 64,667',
      },
      { askCost: 1.001, redeemPreview: 0 },
      123,
      { minAskPrice: 0.01, maxAskPrice: 0.99 },
    );

    expect(quote.askPrice).toBeCloseTo(1.001);
    expect(quote.executable).toBe(false);
    expect(quote.error).toContain('outside Predict mint bounds');
  });
});
