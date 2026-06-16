import type {
  LegIntent,
  LegQuote,
  OracleMarket,
  ScenarioOutcome,
  SharkFinInput,
  StructuredProductQuote,
} from './types';
import { alignToGrid } from './strikeGrid';
import { daysBetween } from './units';

const DEFAULT_LEG_COUNT = 6;
const EPSILON = 0.000001;

export interface SharkFinBudget {
  termDays: number;
  projectedCurrentYield: number;
  baseCoupon: number;
  optionBudget: number;
}

export function calculateSharkFinBudget(
  input: SharkFinInput,
  oracle: OracleMarket,
  nowMs = Date.now(),
): SharkFinBudget {
  const termDays = daysBetween(nowMs, oracle.expiryMs);
  const projectedCurrentYield = input.principal * input.currentApr * (termDays / 365);
  const baseCoupon = input.principal * input.baseApr * (termDays / 365);

  return {
    termDays,
    projectedCurrentYield,
    baseCoupon,
    optionBudget: projectedCurrentYield - baseCoupon,
  };
}

function normalizeLegCount(input: SharkFinInput): number {
  return Math.max(1, Math.floor(input.targetLegCount ?? DEFAULT_LEG_COUNT));
}

function buildRawStrikes(input: SharkFinInput): number[] {
  if (input.upperBound <= input.lowerBound) return [];

  const legCount = normalizeLegCount(input);
  const interval = (input.upperBound - input.lowerBound) / legCount;

  return Array.from({ length: legCount }, (_, index) => {
    if (input.direction === 'bearish') {
      return input.upperBound - interval * index;
    }
    return input.lowerBound + interval * index;
  });
}

function buildAlignedStrikes(input: SharkFinInput, oracle: OracleMarket): number[] {
  const strikes: number[] = [];

  buildRawStrikes(input).forEach((rawStrike) => {
    const strike = alignToGrid(rawStrike, oracle.minStrike, oracle.tickSize).aligned;
    const insideRange =
      input.direction === 'bearish'
        ? strike <= input.upperBound && strike > input.lowerBound
        : strike >= input.lowerBound && strike < input.upperBound;

    if (insideRange && !strikes.includes(strike)) {
      strikes.push(strike);
    }
  });

  return strikes;
}

export function buildSharkFinLegIntents(
  input: SharkFinInput,
  oracle: OracleMarket,
  options: { quantityPerLeg?: number } = {},
): LegIntent[] {
  const quantity = Math.max(0, options.quantityPerLeg ?? 1);
  return buildAlignedStrikes(input, oracle).map((strike) => {
    const isBullish = input.direction === 'bullish';
    return {
      id: `${isBullish ? 'up' : 'down'}-${strike}`,
      instrumentType: isBullish ? 'binary-up' : 'binary-down',
      oracleId: oracle.oracleId,
      expiryMs: oracle.expiryMs,
      strike,
      isUp: isBullish,
      quantity,
      description: `${isBullish ? 'UP' : 'DOWN'} ${strike.toLocaleString('en-US')}`,
    };
  });
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function getSharkFinAprAtSettlement(
  input: SharkFinInput,
  maxApr: number,
  settlementPrice: number,
): number {
  if (input.upperBound <= input.lowerBound) return input.baseApr;

  const width = input.upperBound - input.lowerBound;
  const progress =
    input.direction === 'bearish'
      ? clamp01((input.upperBound - settlementPrice) / width)
      : clamp01((settlementPrice - input.lowerBound) / width);

  return input.baseApr + (Math.max(input.baseApr, maxApr) - input.baseApr) * progress;
}

function realizedBySettlement(leg: LegQuote, settlementPrice: number): boolean {
  if (leg.instrumentType === 'binary-up') {
    return leg.strike !== undefined && settlementPrice > leg.strike;
  }
  if (leg.instrumentType === 'binary-down') {
    return leg.strike !== undefined && settlementPrice <= leg.strike;
  }
  return false;
}

function buildAprCurvePrices(input: SharkFinInput): number[] {
  const width = Math.max(1, input.upperBound - input.lowerBound);
  const min = input.lowerBound - width * 0.2;
  const max = input.upperBound + width * 0.2;
  const samples = Array.from({ length: 25 }, (_, index) => min + ((max - min) * index) / 24);
  return [...samples, input.lowerBound, (input.lowerBound + input.upperBound) / 2, input.upperBound]
    .map((price) => Math.round(price))
    .filter((price, index, prices) => price > 0 && prices.indexOf(price) === index)
    .sort((a, b) => a - b);
}

export function buildSharkFinAprScenarios(
  input: SharkFinInput,
  oracle: OracleMarket,
  legs: LegQuote[],
  maxApr: number,
  nowMs = Date.now(),
): ScenarioOutcome[] {
  const termDays = daysBetween(nowMs, oracle.expiryMs);

  return buildAprCurvePrices(input).map((settlementPrice) => {
    const realized = legs.filter((leg) => realizedBySettlement(leg, settlementPrice));
    const apr = getSharkFinAprAtSettlement(input, maxApr, settlementPrice);
    const coupon = input.principal * apr * (termDays / 365);

    return {
      settlementPrice,
      label: `${settlementPrice.toLocaleString('en-US')} BTC`,
      finalUsdc: input.principal + coupon,
      coupon,
      apr,
      realizedLegCount: realized.length,
      realizedLegIds: realized.map((leg) => leg.id),
      expiredLegIds: legs.filter((leg) => !realized.includes(leg)).map((leg) => leg.id),
    };
  });
}

export function compileSharkFin(input: {
  input: SharkFinInput;
  oracle: OracleMarket;
  quotedLegs: Partial<LegQuote>[];
  quantityPerLeg?: number;
  nowMs?: number;
}): StructuredProductQuote {
  const nowMs = input.nowMs ?? Date.now();
  const budget = calculateSharkFinBudget(input.input, input.oracle, nowMs);
  const legIntents = buildSharkFinLegIntents(input.input, input.oracle, {
    quantityPerLeg: input.quantityPerLeg,
  });
  const legs = legIntents.map((intent, index) => ({
    ...intent,
    askPrice: input.quotedLegs[index]?.askPrice ?? 0,
    askCost: input.quotedLegs[index]?.askCost ?? 0,
    redeemPreview: input.quotedLegs[index]?.redeemPreview ?? 0,
    quoteTimestampMs: input.quotedLegs[index]?.quoteTimestampMs ?? Date.now(),
    executable: input.quotedLegs[index]?.executable ?? false,
    error: input.quotedLegs[index]?.error,
  }));
  const totalLegCost = legs.reduce((sum, leg) => sum + leg.askCost, 0);
  const maxExtraPayout = budget.optionBudget <= 0 ? 0 : legs.reduce((sum, leg) => sum + leg.quantity, 0);
  const maxApr =
    budget.optionBudget <= 0 || input.input.principal <= 0 || budget.termDays <= 0
      ? input.input.baseApr
      : input.input.baseApr + (maxExtraPayout / input.input.principal) * (365 / budget.termDays);
  const executable =
    budget.optionBudget > 0 &&
    legs.length > 0 &&
    totalLegCost <= budget.optionBudget + EPSILON &&
    legs.every((leg) => leg.executable);
  const directionTitle = input.input.direction === 'bearish' ? 'Bearish' : 'Bullish';
  const warning =
    budget.optionBudget <= 0
      ? 'Current USDsui yield is not enough to fund option legs after reserving the base coupon.'
      : totalLegCost > budget.optionBudget + EPSILON
        ? 'Quoted ladder cost is above the option budget from Current yield.'
        : legs.some((leg) => !leg.executable)
          ? 'One or more DeepBook Predict legs could not be quoted.'
          : undefined;

  const quote: StructuredProductQuote = {
    id: `shark-${input.oracle.oracleId}-${input.input.direction}-${input.input.lowerBound}-${input.input.upperBound}`,
    productType: 'shark-fin',
    title: `${directionTitle} BTC Shark Fin ${input.input.lowerBound.toLocaleString('en-US')} - ${input.input.upperBound.toLocaleString('en-US')}`,
    principal: input.input.principal,
    principalAsset: 'USDsui',
    quoteAsset: 'USDsui',
    oracle: input.oracle,
    legs,
    totalLegCost,
    reserve: input.input.principal,
    coupon: budget.baseCoupon,
    apr: maxApr,
    sharkFin: {
      direction: input.input.direction,
      currentApr: input.input.currentApr,
      baseApr: input.input.baseApr,
      maxApr,
      termDays: budget.termDays,
      projectedCurrentYield: budget.projectedCurrentYield,
      baseCoupon: budget.baseCoupon,
      optionBudget: budget.optionBudget,
      optionBudgetUsed: totalLegCost,
      leftoverBudget: Math.max(0, budget.optionBudget - totalLegCost),
      payoutPerLeg: legs[0]?.quantity ?? 0,
      maxExtraPayout,
    },
    executable,
    warning,
    scenarios: [],
  };

  return {
    ...quote,
    scenarios: buildSharkFinAprScenarios(input.input, input.oracle, legs, maxApr, nowMs),
  };
}
