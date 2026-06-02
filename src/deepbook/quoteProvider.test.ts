import { describe, expect, it } from 'vitest';
import { normalizePreviewResult, parseDevInspectLegAmounts } from './quoteProvider';

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
