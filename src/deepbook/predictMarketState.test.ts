import { describe, expect, it } from 'vitest';
import { parsePredictMarketState } from './predictMarketState';

const MARKET_ID = `0x${'5'.repeat(64)}`;

describe('parsePredictMarketState', () => {
  it('parses a settled expiry market and its exact settlement price', () => {
    expect(
      parsePredictMarketState({
        expiry_market_id: MARKET_ID,
        market: { expiry_market_id: MARKET_ID, expiry: 1_000 },
        settlement: {
          expiry_market_id: MARKET_ID,
          expiry: 1_000,
          settlement_price: '64213934107220',
          settled_at_ms: 1_238,
          kind: 'market_settled',
        },
      }),
    ).toEqual({
      expiryMarketId: MARKET_ID,
      expiryMs: 1_000,
      settlementPrice: 64_213.93410722,
      settlementPriceBaseUnits: 64_213_934_107_220n,
      settledAtMs: 1_238,
    });
  });

  it('keeps an expired market without a settlement event awaiting settlement', () => {
    expect(
      parsePredictMarketState({
        expiry_market_id: MARKET_ID,
        market: { expiry_market_id: MARKET_ID, expiry: 1_000 },
        settlement: null,
      }),
    ).toEqual({
      expiryMarketId: MARKET_ID,
      expiryMs: 1_000,
      settlementPrice: null,
      settlementPriceBaseUnits: null,
      settledAtMs: null,
    });
  });

  it('rejects a settlement event for a different expiry market', () => {
    expect(() =>
      parsePredictMarketState({
        expiry_market_id: MARKET_ID,
        market: { expiry_market_id: MARKET_ID, expiry: 1_000 },
        settlement: {
          expiry_market_id: `0x${'6'.repeat(64)}`,
          settlement_price: '64213934107220',
          settled_at_ms: 1_238,
        },
      }),
    ).toThrow('does not match');
  });
});
