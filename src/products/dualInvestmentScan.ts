import type { DualInvestmentInput, OracleMarket, StructuredProductQuote } from './types';
import { alignToGrid } from './strikeGrid';
import { estimateTargetBuyFloorPrice } from './predictPricing';

export interface DualInvestmentScanRow {
  input: DualInvestmentInput;
  quote: StructuredProductQuote | null;
  error?: string;
}

export function buildAutoFloorDualInvestmentInput(input: {
  market: OracleMarket;
  principal: number;
  targetPrice: number;
  targetLegCount?: number;
  floorDistance?: number;
}): DualInvestmentInput {
  const floorDistance = input.floorDistance ?? 5_000;
  const floorPrice = alignToGrid(
    estimateTargetBuyFloorPrice({
      market: input.market,
      targetPrice: input.targetPrice,
      fallbackFloorDistance: floorDistance,
    }),
    input.market.minStrike,
    input.market.tickSize,
  ).aligned;

  return {
    principal: input.principal,
    targetPrice: input.targetPrice,
    floorPrice,
    targetLegCount: input.targetLegCount ?? 6,
  };
}

export function buildDualInvestmentScanInputs(input: {
  market: OracleMarket;
  principal: number;
  targetLegCount?: number;
  targetRows?: number;
  targetStep?: number;
  floorDistance?: number;
}): DualInvestmentInput[] {
  const targetRows = input.targetRows ?? 8;
  const targetStep = input.targetStep ?? 500;
  const floorDistance = input.floorDistance ?? 5_000;
  const targetLegCount = input.targetLegCount ?? 6;
  const roundedDownTarget = Math.floor(input.market.spot / targetStep) * targetStep;
  const startTarget =
    roundedDownTarget >= input.market.spot ? roundedDownTarget - targetStep : roundedDownTarget;

  return Array.from({ length: targetRows }, (_, index) => startTarget - targetStep * index)
    .filter((targetPrice) => targetPrice > input.market.minStrike && targetPrice < input.market.spot)
    .map((targetPrice) =>
      buildAutoFloorDualInvestmentInput({
        market: input.market,
        principal: input.principal,
        targetPrice,
        targetLegCount,
        floorDistance,
      }),
    );
}

export function scanQuoteDisplayMetrics(input: {
  quote: Pick<StructuredProductQuote, 'coupon' | 'apr' | 'totalLegCost'> | null;
}) {
  if (!input.quote || input.quote.coupon <= 0) {
    return {
      coupon: 0,
      apr: null,
      totalLegCost: null,
    };
  }

  return {
    coupon: input.quote.coupon,
    apr: input.quote.apr,
    totalLegCost: input.quote.totalLegCost,
  };
}
