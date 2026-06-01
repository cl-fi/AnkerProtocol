import type {
  DualInvestmentInput,
  LegIntent,
  LegQuote,
  OracleMarket,
  StructuredProductQuote,
} from './types';
import { aprFromCoupon, daysBetween } from './units';
import { buildStrikeLadder } from './strikeGrid';

export function buildDualInvestmentLegIntents(
  input: DualInvestmentInput,
  oracle: OracleMarket,
): LegIntent[] {
  const targetBtcAmount = input.principal / input.targetPrice;
  const quantityPerStep = targetBtcAmount * input.stepSize;
  return buildStrikeLadder({
    floor: input.floorPrice,
    target: input.targetPrice,
    step: input.stepSize,
  }).map((strike) => ({
    id: `up-${strike}`,
    instrumentType: 'binary-up',
    oracleId: oracle.oracleId,
    expiryMs: oracle.expiryMs,
    strike,
    isUp: true,
    quantity: quantityPerStep,
    description: `UP ${strike.toLocaleString('en-US')}`,
  }));
}

export function compileDualInvestment(input: {
  input: DualInvestmentInput;
  oracle: OracleMarket;
  quotedLegs: Partial<LegQuote>[];
  nowMs?: number;
}): StructuredProductQuote {
  const legIntents = buildDualInvestmentLegIntents(input.input, input.oracle);
  const legs = legIntents.map((intent, index) => ({
    ...intent,
    askPrice: input.quotedLegs[index]?.askPrice ?? 0,
    askCost: input.quotedLegs[index]?.askCost ?? 0,
    redeemPreview: input.quotedLegs[index]?.redeemPreview ?? 0,
    quoteTimestampMs: input.quotedLegs[index]?.quoteTimestampMs ?? Date.now(),
    executable: input.quotedLegs[index]?.executable ?? false,
    error: input.quotedLegs[index]?.error,
  }));
  const targetBtcAmount = input.input.principal / input.input.targetPrice;
  const reserve = targetBtcAmount * input.input.floorPrice;
  const totalLegCost = legs.reduce((sum, leg) => sum + leg.askCost, 0);
  const coupon = input.input.principal - reserve - totalLegCost;
  const days = daysBetween(input.nowMs ?? Date.now(), input.oracle.expiryMs);
  const executable = coupon > 0 && legs.every((leg) => leg.executable);

  return {
    id: `dual-${input.oracle.oracleId}-${input.input.targetPrice}-${input.input.floorPrice}`,
    productType: 'dual-investment',
    title: `Target Buy BTC at ${input.input.targetPrice.toLocaleString('en-US')}`,
    principal: input.input.principal,
    oracle: input.oracle,
    legs,
    totalLegCost,
    reserve,
    coupon,
    apr: aprFromCoupon(coupon, input.input.principal, days),
    executable,
    warning: coupon <= 0 ? 'Current leg costs leave no positive coupon.' : undefined,
    scenarios: [],
  };
}
