import type { DualInvestmentInput, OracleMarket, StructuredProductQuote } from './types';
import { alignToGrid } from './strikeGrid';

export type ScanQuoteStatus = 'live' | 'no-coupon' | 'unavailable';

export interface DualInvestmentScanRow {
  input: DualInvestmentInput;
  quote: StructuredProductQuote | null;
  status: ScanQuoteStatus;
  error?: string;
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
    .map((targetPrice) => {
      const floorPrice = alignToGrid(
        Math.max(input.market.minStrike, targetPrice - floorDistance),
        input.market.minStrike,
        input.market.tickSize,
      ).aligned;
      return {
        principal: input.principal,
        targetPrice,
        floorPrice,
        targetLegCount,
      };
    });
}

export function classifyScanQuote(input: Pick<StructuredProductQuote, 'coupon' | 'executable'>): ScanQuoteStatus {
  if (input.coupon <= 0) return 'no-coupon';
  return input.executable ? 'live' : 'unavailable';
}

export function scanQuoteDisplayMetrics(input: {
  status: ScanQuoteStatus;
  quote: Pick<StructuredProductQuote, 'coupon' | 'apr' | 'totalLegCost'> | null;
}) {
  if (input.status !== 'live' || !input.quote) {
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
