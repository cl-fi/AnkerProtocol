import type { DualInvestmentInput, OracleMarket, StructuredProductQuote } from './types';
import { alignToGrid } from './strikeGrid';
import { estimateTargetBuyFloorPrice } from './predictPricing';
import { netAprAfterCouponFee } from './feePolicy';

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
  // Turbo admission grid (~$1); legacy Dual Investment used $500 steps.
  const targetStep = input.targetStep ?? input.market.admissionTickSize ?? 500;
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

/** ADR-0002: tenor < 1 day shows period return only — never annualized APR. */
export function isSubDayTenor(expiryMs: number, nowMs = Date.now()) {
  return expiryMs - nowMs < 86_400_000;
}

export function scanQuoteDisplayMetrics(input: {
  quote: Pick<StructuredProductQuote, 'coupon' | 'apr' | 'totalLegCost' | 'principal' | 'oracle'> | null;
  nowMs?: number;
}) {
  if (!input.quote || input.quote.coupon <= 0) {
    return {
      coupon: 0,
      apr: null as number | null,
      periodReturn: null as number | null,
      totalLegCost: null as number | null,
      showApr: false,
    };
  }

  const periodReturn = input.quote.principal > 0 ? input.quote.coupon / input.quote.principal : 0;
  const showApr = !isSubDayTenor(input.quote.oracle.expiryMs, input.nowMs);

  return {
    coupon: input.quote.coupon,
    apr: showApr ? netAprAfterCouponFee(input.quote.apr) : null,
    periodReturn,
    totalLegCost: input.quote.totalLegCost,
    showApr,
  };
}
