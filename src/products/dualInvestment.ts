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
import { assertValidDualInvestmentInput, assertValidDualInvestmentQuote } from './dualInvestmentValidation';
import { legIdentityKey } from './legIdentity';

interface LadderInterval {
  strike: number;
  width: number;
}

function buildLadderIntervals(input: DualInvestmentInput, oracle: OracleMarket): LadderInterval[] {
  if (input.targetPrice <= input.floorPrice) return [];

  // Upstream strike_exposure::assert_admitted_mint_ticks only admits strikes on
  // the absolute admission grid (tick % (admission_tick_size / tick_size) == 0),
  // so leg strikes align to admissionTickSize — not the finer price tick grid.
  const alignStep =
    oracle.admissionTickSize && oracle.admissionTickSize > 0 ? oracle.admissionTickSize : oracle.tickSize;

  let rawStrikes: number[];
  if (input.targetLegCount !== undefined) {
    const targetLegCount = Math.max(1, Math.floor(input.targetLegCount));
    const rawWidth = (input.targetPrice - input.floorPrice) / targetLegCount;
    rawStrikes = Array.from({ length: targetLegCount }, (_, index) => input.floorPrice + rawWidth * index);
  } else {
    rawStrikes = buildStrikeLadder({
      floor: input.floorPrice,
      target: input.targetPrice,
      step: input.stepSize ?? input.targetPrice - input.floorPrice,
    });
  }

  const strikes: number[] = [];
  for (const rawStrike of rawStrikes) {
    const strike = alignToGrid(rawStrike, 0, alignStep).aligned;
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

function hasLegIdentity(leg: Partial<LegQuote>): leg is LegQuote {
  return (
    typeof leg.instrumentType === 'string' &&
    typeof leg.oracleId === 'string' &&
    typeof leg.expiryMs === 'number' &&
    typeof leg.quantity === 'number'
  );
}

export function buildDualInvestmentLegIntents(
  input: DualInvestmentInput,
  oracle: OracleMarket,
  options: { nowMs?: number } = {},
): LegIntent[] {
  const validInput = assertValidDualInvestmentInput(input, { oracle, nowMs: options.nowMs });
  const targetBtcAmount = validInput.principal / validInput.targetPrice;
  return buildLadderIntervals(validInput, oracle).map(({ strike, width }) => ({
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
  const validInput = assertValidDualInvestmentInput(input.input, {
    oracle: input.oracle,
    nowMs: input.nowMs,
  });
  const legIntents = buildDualInvestmentLegIntents(validInput, input.oracle, { nowMs: input.nowMs });
  const quotedByIdentity = new Map(
    input.quotedLegs
      .filter(hasLegIdentity)
      .map((quotedLeg) => [legIdentityKey(quotedLeg), quotedLeg]),
  );
  const quotedById = new Map(
    input.quotedLegs
      .filter((quotedLeg): quotedLeg is Partial<LegQuote> & { id: string } => typeof quotedLeg.id === 'string')
      .map((quotedLeg) => [quotedLeg.id, quotedLeg]),
  );
  const legs = legIntents.map((intent) => {
    const quotedLeg = quotedByIdentity.get(legIdentityKey(intent)) ?? quotedById.get(intent.id);
    return {
      ...intent,
      askPrice: quotedLeg?.askPrice ?? 0,
      askCost: quotedLeg?.askCost ?? 0,
      redeemPreview: quotedLeg?.redeemPreview ?? 0,
      quoteTimestampMs: quotedLeg?.quoteTimestampMs ?? Date.now(),
      executable: quotedLeg?.executable ?? false,
      error: quotedLeg?.error,
    };
  });
  const targetBtcAmount = validInput.principal / validInput.targetPrice;
  const reserve = targetBtcAmount * validInput.floorPrice;
  const totalLegCost = legs.reduce((sum, leg) => sum + leg.askCost, 0);
  const coupon = input.input.principal - reserve - totalLegCost;
  const days = daysBetween(input.nowMs ?? Date.now(), input.oracle.expiryMs);
  const executable = coupon > 0 && legs.every((leg) => leg.executable);
  const legWarning = legs.find((leg) => !leg.executable && leg.error)?.error;

  const quote: StructuredProductQuote = {
    id: `dual-${input.oracle.oracleId}-${validInput.targetPrice}-${validInput.floorPrice}`,
    productType: 'dual-investment',
    title: `Target Buy BTC at ${validInput.targetPrice.toLocaleString('en-US')}`,
    principal: validInput.principal,
    oracle: input.oracle,
    legs,
    totalLegCost,
    reserve,
    coupon,
    targetPrice: validInput.targetPrice,
    floorPrice: validInput.floorPrice,
    apr: aprFromCoupon(coupon, validInput.principal, days),
    executable,
    warning: coupon <= 0 ? 'Current leg costs leave no positive coupon.' : legWarning,
    scenarios: [],
  };
  return assertValidDualInvestmentQuote({ ...quote, scenarios: simulatePayoff(quote) });
}
