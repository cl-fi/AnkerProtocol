import { DEEPBOOK_PREDICT } from '../config/deepbook';
import type { OracleMarket } from './types';

export const DEFAULT_MIN_PREDICT_ASK = 0.02;
export const DEFAULT_MAX_PREDICT_ASK = DEEPBOOK_PREDICT.maxAskPrice;
export const DEFAULT_PREDICT_BASE_SPREAD = DEEPBOOK_PREDICT.baseSpread;
export const DEFAULT_PREDICT_MIN_SPREAD = DEEPBOOK_PREDICT.minSpread;
export const DEFAULT_PREDICT_UTILIZATION_MULTIPLIER = DEEPBOOK_PREDICT.utilizationMultiplier;
const DEFAULT_BOUND_BUFFER = 0.005;
const MAX_LOCAL_SOLVE_STEPS = 32;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalCdf(value: number) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x));
  return 0.5 * (1 + sign * erf);
}

function alignUpToGrid(input: number, minStrike: number, tickSize: number) {
  return minStrike + Math.ceil((input - minStrike) / tickSize) * tickSize;
}

function alignDownToGrid(input: number, minStrike: number, tickSize: number) {
  return minStrike + Math.floor((input - minStrike) / tickSize) * tickSize;
}

export function estimateBinaryUpFairPrice(input: { market: OracleMarket; strike: number }) {
  const { market, strike } = input;
  if (!market.svi || strike <= 0 || market.forward <= 0) return null;

  const logMoneyness = Math.log(strike / market.forward);
  const x = logMoneyness - market.svi.m;
  const totalVariance =
    market.svi.a + market.svi.b * (market.svi.rho * x + Math.sqrt(x * x + market.svi.sigma * market.svi.sigma));

  if (!Number.isFinite(totalVariance) || totalVariance < 0) return null;
  if (totalVariance === 0) return strike < market.forward ? 1 : 0;

  const totalVolatility = Math.sqrt(totalVariance);
  const d2 = Math.log(market.forward / strike) / totalVolatility - totalVolatility / 2;
  return clamp(normalCdf(d2), 0, 1);
}

export function estimatePredictSpreadFromFairPrice(input: {
  fairPrice: number;
  baseSpread?: number;
  minSpread?: number;
  utilization?: number;
  utilizationMultiplier?: number;
}) {
  const fairPrice = clamp(input.fairPrice, 0, 1);
  if (fairPrice <= 0 || fairPrice >= 1) return 0;

  const baseSpread = input.baseSpread ?? DEFAULT_PREDICT_BASE_SPREAD;
  const minSpread = input.minSpread ?? DEFAULT_PREDICT_MIN_SPREAD;
  const utilization = clamp(input.utilization ?? 0, 0, 1);
  const utilizationMultiplier = input.utilizationMultiplier ?? DEFAULT_PREDICT_UTILIZATION_MULTIPLIER;
  const bernoulliSpread = baseSpread * Math.sqrt(fairPrice * (1 - fairPrice));
  const utilizationSpread = baseSpread * utilizationMultiplier * utilization * utilization;
  return Math.max(bernoulliSpread, minSpread) + utilizationSpread;
}

export function estimateBinaryUpAskPrice(input: { market: OracleMarket; strike: number; utilization?: number }) {
  const fairPrice = estimateBinaryUpFairPrice(input);
  if (fairPrice === null) return null;
  const pricing = input.market.predictPricing;
  const spread = estimatePredictSpreadFromFairPrice({
    fairPrice,
    baseSpread: pricing?.baseSpread,
    minSpread: pricing?.minSpread,
    utilization: input.utilization ?? pricing?.vaultUtilization,
    utilizationMultiplier: pricing?.utilizationMultiplier,
  });
  return clamp(fairPrice + spread, 0, 1);
}

export function estimateTargetBuyFloorPrice(input: {
  market: OracleMarket;
  targetPrice: number;
  fallbackFloorDistance?: number;
  minAskPrice?: number;
  maxAskPrice?: number;
  boundBuffer?: number;
}) {
  const fallbackFloorDistance = input.fallbackFloorDistance ?? 5_000;
  const fallback = alignDownToGrid(
    Math.max(input.market.minStrike, input.targetPrice - fallbackFloorDistance),
    input.market.minStrike,
    input.market.tickSize,
  );
  if (!input.market.svi || input.targetPrice <= input.market.minStrike || input.market.tickSize <= 0) {
    return fallback;
  }

  const minFloor = input.market.minStrike;
  const maxFloor = alignDownToGrid(input.targetPrice - input.market.tickSize, input.market.minStrike, input.market.tickSize);
  if (maxFloor <= minFloor) return fallback;

  const configuredMinAsk = Math.max(
    input.minAskPrice ?? DEFAULT_MIN_PREDICT_ASK,
    input.market.predictPricing?.minAskPrice ?? DEFAULT_MIN_PREDICT_ASK,
  );
  const configuredMaxAsk = input.maxAskPrice ?? input.market.predictPricing?.maxAskPrice ?? DEFAULT_MAX_PREDICT_ASK;
  const lowerAskBound = configuredMinAsk + (input.boundBuffer ?? DEFAULT_BOUND_BUFFER);
  const upperAskBound = configuredMaxAsk - (input.boundBuffer ?? DEFAULT_BOUND_BUFFER);
  const minFloorAsk = estimateBinaryUpAskPrice({ market: input.market, strike: minFloor });
  const maxFloorAsk = estimateBinaryUpAskPrice({ market: input.market, strike: maxFloor });
  if (minFloorAsk === null || maxFloorAsk === null) return fallback;

  if (minFloorAsk >= lowerAskBound && minFloorAsk <= upperAskBound) {
    return minFloor;
  }

  if (minFloorAsk > upperAskBound) {
    if (maxFloorAsk > upperAskBound) return maxFloor;

    let low = minFloor;
    let high = maxFloor;
    for (let index = 0; index < MAX_LOCAL_SOLVE_STEPS; index += 1) {
      const mid = (low + high) / 2;
      const ask = estimateBinaryUpAskPrice({ market: input.market, strike: mid });
      if (ask === null) return fallback;
      if (ask > upperAskBound) {
        low = mid;
      } else {
        high = mid;
      }
    }
    return Math.min(maxFloor, Math.max(minFloor, alignUpToGrid(high, input.market.minStrike, input.market.tickSize)));
  }

  if (minFloorAsk < lowerAskBound) {
    return fallback;
  }

  return fallback;
}
