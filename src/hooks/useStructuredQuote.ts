import { useMemo } from 'react';
import { LivePreviewQuoteProvider, SnapshotQuoteProvider } from '../deepbook/quoteProvider';
import { buildDualInvestmentLegIntents, compileDualInvestment } from '../products/dualInvestment';
import { buildSharkFinLegIntents, compileSharkFin } from '../products/sharkFin';
import type { DualInvestmentInput, OracleMarket, ProductType, SharkFinInput } from '../products/types';

const quoteProvider = new LivePreviewQuoteProvider(new SnapshotQuoteProvider());

export interface StructuredQuoteState {
  productType: ProductType;
  dualInput: DualInvestmentInput;
  sharkInput: SharkFinInput;
}

export async function buildStructuredQuote(input: {
  state: StructuredQuoteState;
  oracle: OracleMarket;
}) {
  if (input.state.productType === 'dual-investment') {
    const intents = buildDualInvestmentLegIntents(input.state.dualInput, input.oracle);
    const quotedLegs = await quoteProvider.quoteLegs(intents);
    return compileDualInvestment({ input: input.state.dualInput, oracle: input.oracle, quotedLegs });
  }

  const intents = buildSharkFinLegIntents(input.state.sharkInput, input.oracle);
  const quotedLegs = await quoteProvider.quoteLegs(intents);
  return compileSharkFin({ input: input.state.sharkInput, oracle: input.oracle, quotedLegs });
}

export function useDefaultStructuredQuoteState(spot: number): StructuredQuoteState {
  return useMemo(
    () => ({
      productType: 'dual-investment',
      dualInput: {
        principal: 1_000,
        targetPrice: Math.round(spot * 1.005),
        floorPrice: Math.round(spot * 0.995),
        stepSize: 500,
      },
      sharkInput: {
        principal: 1_000,
        lowerBound: Math.round(spot),
        upperBound: Math.round(spot * 1.06),
        stepSize: 1_000,
        baseApr: 0.05,
      },
    }),
    [spot],
  );
}
