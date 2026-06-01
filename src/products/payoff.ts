import type { ScenarioOutcome, StructuredProductQuote } from './types';

function defaultSettlementPrices(quote: StructuredProductQuote): number[] {
  const spot = quote.oracle.spot;
  return [
    Math.round(spot * 0.8),
    Math.round(spot * 0.9),
    Math.round(spot),
    Math.round(spot * 1.1),
    Math.round(spot * 1.2),
  ];
}

export function simulatePayoff(
  quote: StructuredProductQuote,
  settlementPrices = defaultSettlementPrices(quote),
): ScenarioOutcome[] {
  return settlementPrices.map((settlementPrice) => {
    const realized = quote.legs.filter((leg) => {
      if (leg.instrumentType === 'binary-up') {
        return leg.strike !== undefined && settlementPrice > leg.strike;
      }
      if (leg.instrumentType === 'range') {
        return (
          leg.lowerStrike !== undefined &&
          leg.higherStrike !== undefined &&
          settlementPrice > leg.lowerStrike &&
          settlementPrice <= leg.higherStrike
        );
      }
      return false;
    });

    const payout = realized.reduce((sum, leg) => sum + leg.quantity, 0);
    const finalUsdc =
      quote.productType === 'dual-investment'
        ? quote.reserve + quote.coupon + payout
        : quote.reserve + Math.max(0, quote.coupon) + payout;

    return {
      settlementPrice,
      label: `${settlementPrice.toLocaleString('en-US')} BTC`,
      finalUsdc,
      btcEquivalent: quote.productType === 'dual-investment' ? finalUsdc / settlementPrice : undefined,
      coupon: quote.coupon,
      realizedLegIds: realized.map((leg) => leg.id),
      expiredLegIds: quote.legs.filter((leg) => !realized.includes(leg)).map((leg) => leg.id),
    };
  });
}
