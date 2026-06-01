import type { LegIntent, LegQuote, OracleMarket, SharkFinInput, StructuredProductQuote } from './types';
import { aprFromCoupon, daysBetween } from './units';
import { simulatePayoff } from './payoff';

export function buildSharkFinLegIntents(input: SharkFinInput, oracle: OracleMarket): LegIntent[] {
  return [
    {
      id: `range-${input.lowerBound}-${input.upperBound}`,
      instrumentType: 'range',
      oracleId: oracle.oracleId,
      expiryMs: oracle.expiryMs,
      lowerStrike: input.lowerBound,
      higherStrike: input.upperBound,
      quantity: input.principal * input.baseApr,
      description: `Range ${input.lowerBound.toLocaleString('en-US')} - ${input.upperBound.toLocaleString('en-US')}`,
    },
  ];
}

export function compileSharkFin(input: {
  input: SharkFinInput;
  oracle: OracleMarket;
  quotedLegs: Partial<LegQuote>[];
  nowMs?: number;
}): StructuredProductQuote {
  const legIntents = buildSharkFinLegIntents(input.input, input.oracle);
  const legs = legIntents.map((intent, index) => ({
    ...intent,
    askPrice: input.quotedLegs[index]?.askPrice ?? 0,
    askCost: input.quotedLegs[index]?.askCost ?? 0,
    redeemPreview: input.quotedLegs[index]?.redeemPreview ?? 0,
    quoteTimestampMs: input.quotedLegs[index]?.quoteTimestampMs ?? Date.now(),
    executable: input.quotedLegs[index]?.executable ?? false,
    error: input.quotedLegs[index]?.error,
  }));
  const nowMs = input.nowMs ?? Date.now();
  const days = daysBetween(nowMs, input.oracle.expiryMs);
  const yieldBudget = input.input.principal * input.input.baseApr * (days / 365);
  const totalLegCost = legs.reduce((sum, leg) => sum + leg.askCost, 0);
  const coupon = yieldBudget - totalLegCost;
  const executable = coupon >= 0 && legs.every((leg) => leg.executable);

  const quote: StructuredProductQuote = {
    id: `shark-${input.oracle.oracleId}-${input.input.lowerBound}-${input.input.upperBound}`,
    productType: 'shark-fin',
    title: `BTC Shark Fin ${input.input.lowerBound.toLocaleString('en-US')} - ${input.input.upperBound.toLocaleString('en-US')}`,
    principal: input.input.principal,
    oracle: input.oracle,
    legs,
    totalLegCost,
    reserve: input.input.principal,
    coupon,
    apr: aprFromCoupon(Math.max(0, coupon), input.input.principal, days),
    executable,
    warning: coupon < 0 ? 'Assumed yield cannot fund the quoted option package.' : undefined,
    scenarios: [],
  };
  return { ...quote, scenarios: simulatePayoff(quote) };
}
