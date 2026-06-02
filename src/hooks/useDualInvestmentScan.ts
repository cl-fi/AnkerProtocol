import { useQuery } from '@tanstack/react-query';
import { BatchedLivePreviewQuoteProvider, type QuoteProvider } from '../deepbook/quoteProvider';
import { buildDualInvestmentLegIntents, compileDualInvestment } from '../products/dualInvestment';
import {
  buildDualInvestmentScanInputs,
  classifyScanQuote,
  type DualInvestmentScanRow,
} from '../products/dualInvestmentScan';
import type { DualInvestmentInput, OracleMarket } from '../products/types';

const liveQuoteProvider = new BatchedLivePreviewQuoteProvider();

export async function buildVerifiedDualInvestmentQuote(input: {
  oracle: OracleMarket;
  productInput: DualInvestmentInput;
  quoteProvider?: QuoteProvider;
}) {
  const provider = input.quoteProvider ?? liveQuoteProvider;
  const intents = buildDualInvestmentLegIntents(input.productInput, input.oracle);
  const quotedLegs = await provider.quoteLegs(intents);
  return compileDualInvestment({
    input: input.productInput,
    oracle: input.oracle,
    quotedLegs,
  });
}

export async function buildDualInvestmentScan(input: {
  market: OracleMarket;
  principal: number;
  quoteProvider?: QuoteProvider;
}): Promise<DualInvestmentScanRow[]> {
  const provider = input.quoteProvider ?? liveQuoteProvider;
  const scanInputs = buildDualInvestmentScanInputs({
    market: input.market,
    principal: input.principal,
  });

  return Promise.all(
    scanInputs.map(async (productInput) => {
      try {
        const quote = await buildVerifiedDualInvestmentQuote({
          oracle: input.market,
          productInput,
          quoteProvider: provider,
        });
        return {
          input: productInput,
          quote,
          status: classifyScanQuote(quote),
        };
      } catch (error) {
        return {
          input: productInput,
          quote: null,
          status: 'unavailable' as const,
          error: error instanceof Error ? error.message : 'Quote preview failed.',
        };
      }
    }),
  );
}

export function useDualInvestmentScan(input: { market?: OracleMarket; principal: number; enabled?: boolean }) {
  return useQuery({
    queryKey: ['dual-investment-scan', input.market?.oracleId, input.principal],
    enabled: Boolean(input.market) && (input.enabled ?? true),
    queryFn: () => buildDualInvestmentScan({ market: input.market as OracleMarket, principal: input.principal }),
    refetchInterval: 10_000,
    retry: 0,
    placeholderData: (previous) => previous,
  });
}
