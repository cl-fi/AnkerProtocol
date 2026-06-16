import { BatchedLivePreviewQuoteProvider, type QuoteProvider } from '../deepbook/quoteProvider';
import { buildSharkFinLegIntents, calculateSharkFinBudget, compileSharkFin } from '../products/sharkFin';
import type { OracleMarket, SharkFinInput } from '../products/types';

const liveQuoteProvider = new BatchedLivePreviewQuoteProvider();
const QUOTE_SAFETY_BUFFER = 0.995;

export async function buildVerifiedSharkFinQuote(input: {
  oracle: OracleMarket;
  productInput: SharkFinInput;
  quoteProvider?: QuoteProvider;
}) {
  const provider = input.quoteProvider ?? liveQuoteProvider;
  const budget = calculateSharkFinBudget(input.productInput, input.oracle);
  const unitIntents = buildSharkFinLegIntents(input.productInput, input.oracle, { quantityPerLeg: 1 });

  if (budget.optionBudget <= 0 || unitIntents.length === 0) {
    return compileSharkFin({
      input: input.productInput,
      oracle: input.oracle,
      quotedLegs: [],
      quantityPerLeg: 0,
    });
  }

  const unitQuotes = await provider.quoteLegs(unitIntents);
  const totalUnitCost = unitQuotes.reduce((sum, leg) => sum + leg.askCost, 0);

  if (totalUnitCost <= 0) {
    return compileSharkFin({
      input: input.productInput,
      oracle: input.oracle,
      quotedLegs: unitQuotes,
      quantityPerLeg: 0,
    });
  }

  const quantityPerLeg = (budget.optionBudget / totalUnitCost) * QUOTE_SAFETY_BUFFER;
  const finalIntents = buildSharkFinLegIntents(input.productInput, input.oracle, { quantityPerLeg });
  const finalQuotes = await provider.quoteLegs(finalIntents);

  return compileSharkFin({
    input: input.productInput,
    oracle: input.oracle,
    quotedLegs: finalQuotes,
    quantityPerLeg,
  });
}
