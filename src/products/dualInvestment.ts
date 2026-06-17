import type {
  DualInvestmentInput,
  LegIntent,
  LegQuote,
  OracleMarket,
  StructuredProductQuote,
} from './types';
import { aprFromCoupon, daysBetween } from './units';
import { alignToGrid, buildStrikeLadder } from './strikeGrid';
import { simulatePayoff } from './payoff';

interface LadderInterval {
  strike: number;
  width: number;
}

function buildLadderIntervals(input: DualInvestmentInput, oracle: OracleMarket): LadderInterval[] {
  if (input.targetPrice <= input.floorPrice) return [];

  if (input.targetLegCount !== undefined) {
    const targetLegCount = Math.max(1, Math.floor(input.targetLegCount));
    const rawWidth = (input.targetPrice - input.floorPrice) / targetLegCount;
    const strikes: number[] = [];

    for (let index = 0; index < targetLegCount; index += 1) {
      const rawStrike = input.floorPrice + rawWidth * index;
      const strike = alignToGrid(rawStrike, oracle.minStrike, oracle.tickSize).aligned;
      if (strike >= input.floorPrice && strike < input.targetPrice && !strikes.includes(strike)) {
        strikes.push(strike);
      }
    }

    return strikes.map((strike, index) => {
      const nextStrike = strikes[index + 1] ?? input.targetPrice;
      return {
        strike,
        width: Math.max(0, nextStrike - strike),
      };
    });
  }

  const stepSize = input.stepSize ?? input.targetPrice - input.floorPrice;
  return buildStrikeLadder({
    floor: input.floorPrice,
    target: input.targetPrice,
    step: stepSize,
  }).map((strike) => ({
    strike,
    width: Math.min(stepSize, input.targetPrice - strike),
  }));
}

export function buildDualInvestmentLegIntents(
  input: DualInvestmentInput,
  oracle: OracleMarket,
): LegIntent[] {
  const targetBtcAmount = input.principal / input.targetPrice;
  return buildLadderIntervals(input, oracle).map(({ strike, width }) => ({
    id: `up-${strike}`,
    instrumentType: 'binary-up',
    oracleId: oracle.oracleId,
    expiryMs: oracle.expiryMs,
    strike,
    isUp: true,
    quantity: targetBtcAmount * width,
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
  const legWarning = legs.find((leg) => !leg.executable && leg.error)?.error;

  const quote: StructuredProductQuote = {
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
    warning: coupon <= 0 ? 'Current leg costs leave no positive coupon.' : legWarning,
    scenarios: [],
  };
  return { ...quote, scenarios: simulatePayoff(quote) };
}
