import { useMemo } from 'react';
import { createDefaultQuoteProvider } from '../deepbook/quoteProvider';
import { buildDualInvestmentLegIntents, compileDualInvestment } from '../products/dualInvestment';
import type { DualInvestmentInput, OracleMarket, ProductType } from '../products/types';

const quoteProvider = createDefaultQuoteProvider();

export interface StructuredQuoteState {
  productType: ProductType;
  dualInput: DualInvestmentInput;
}

export async function buildStructuredQuote(input: {
  state: StructuredQuoteState;
  oracle: OracleMarket;
}) {
  const intents = buildDualInvestmentLegIntents(input.state.dualInput, input.oracle);
  const quotedLegs = await quoteProvider.quoteLegs(intents);
  return compileDualInvestment({ input: input.state.dualInput, oracle: input.oracle, quotedLegs });
}

export function useDefaultStructuredQuoteState(spot: number): StructuredQuoteState {
  return useMemo(
    () => {
      const targetStep = 500;
      const roundedDownTarget = Math.floor(spot / targetStep) * targetStep;
      const targetPrice =
        roundedDownTarget >= spot ? roundedDownTarget - targetStep : roundedDownTarget;
      const floorPrice = Math.max(targetStep, targetPrice - 5_000);

      return {
        productType: 'dual-investment',
        dualInput: {
          principal: 1_000,
          targetPrice,
          floorPrice,
          stepSize: targetStep,
        },
      };
    },
    [spot],
  );
}
