import type { PredictManagerSummary } from '../deepbook/predictManagers';
import type { QuoteProvider } from '../deepbook/quoteProvider';
import {
  DEFAULT_QUOTE_ENVELOPE_SLIPPAGE_BPS,
  DEFAULT_QUOTE_ENVELOPE_TTL_MS,
  assertQuoteEnvelope,
  createQuoteEnvelope,
  type QuoteEnvelope,
} from '../products/quoteEnvelope';
import { buildDualInvestmentLegIntents, compileDualInvestment } from '../products/dualInvestment';
import type { DualInvestmentInput, StructuredProductQuote } from '../products/types';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import {
  buildSubscribeDualInvestmentTransaction,
  DEFAULT_ANKER_CONFIG,
  type AnkerProtocolConfig,
  type SubscribeDualInvestmentTransactionPlan,
} from '../sui/ankerTransactions';

export const SUBSCRIBE_QUOTE_TTL_MS = DEFAULT_QUOTE_ENVELOPE_TTL_MS;
export const SUBSCRIBE_QUOTE_SLIPPAGE_BPS = DEFAULT_QUOTE_ENVELOPE_SLIPPAGE_BPS;

export interface SubscribeDualInvestmentApplicationPlan {
  managerId: string;
  quoteEnvelope: QuoteEnvelope;
  transactionPlan: SubscribeDualInvestmentTransactionPlan;
}

export function selectUnallocatedPredictManager(
  managers: readonly PredictManagerSummary[] | undefined,
  notes: readonly Pick<AnkerProductNoteRecord, 'managerId'>[] | undefined,
  ownerAddress?: string,
) {
  if (!managers || !notes) return undefined;

  const allocatedManagerIds = new Set(notes.map((note) => note.managerId.toLowerCase()));
  return managers.find((manager) => {
    const isAllocated = allocatedManagerIds.has(manager.managerId.toLowerCase());
    const belongsToOwner =
      !ownerAddress || (Boolean(manager.owner) && manager.owner?.toLowerCase() === ownerAddress.toLowerCase());
    return !isAllocated && belongsToOwner;
  });
}

export function createSubscribeQuoteEnvelope(quote: StructuredProductQuote, config: AnkerProtocolConfig = DEFAULT_ANKER_CONFIG) {
  return createQuoteEnvelope({
    quote,
    network: config.network ?? 'testnet',
    quoteAssetDecimals: config.quoteAssetDecimals,
    ttlMs: SUBSCRIBE_QUOTE_TTL_MS,
    slippageBps: SUBSCRIBE_QUOTE_SLIPPAGE_BPS,
  });
}

export async function refreshDualInvestmentQuoteForSigning(input: {
  productInput: DualInvestmentInput;
  quote: StructuredProductQuote;
  quoteEnvelope: QuoteEnvelope;
  quoteProvider: QuoteProvider;
  config?: AnkerProtocolConfig;
  nowMs?: number;
}) {
  const config = input.config ?? DEFAULT_ANKER_CONFIG;
  const legIntents = buildDualInvestmentLegIntents(input.productInput, input.quote.oracle, { nowMs: input.nowMs });
  const quotedLegs = await input.quoteProvider.quoteLegs(legIntents);
  const refreshedQuote = compileDualInvestment({
    input: input.productInput,
    oracle: input.quote.oracle,
    quotedLegs,
    nowMs: input.nowMs,
  });
  if (!refreshedQuote.executable) {
    throw new Error(refreshedQuote.warning ?? 'Refreshed quote is not executable.');
  }

  assertQuoteEnvelope({
    quote: refreshedQuote,
    envelope: input.quoteEnvelope,
    network: config.network ?? 'testnet',
    quoteAssetDecimals: config.quoteAssetDecimals,
    nowMs: input.nowMs ?? Date.now(),
  });

  return refreshedQuote;
}

export function buildSubscribeDualInvestmentApplicationPlan(input: {
  accountAddress: string;
  managers: readonly PredictManagerSummary[] | undefined;
  notes: readonly Pick<AnkerProductNoteRecord, 'managerId'>[] | undefined;
  productInput: DualInvestmentInput;
  quote: StructuredProductQuote;
  quoteEnvelope?: QuoteEnvelope;
  config?: AnkerProtocolConfig;
  nowMs?: number;
}): SubscribeDualInvestmentApplicationPlan {
  const config = input.config ?? DEFAULT_ANKER_CONFIG;
  const manager = selectUnallocatedPredictManager(input.managers, input.notes, input.accountAddress);
  if (!manager) {
    throw new Error('Create a product container before subscribing.');
  }

  const quoteEnvelope = input.quoteEnvelope ?? createSubscribeQuoteEnvelope(input.quote, config);
  const transactionPlan = buildSubscribeDualInvestmentTransaction({
    accountAddress: input.accountAddress,
    managerId: manager.managerId,
    productInput: input.productInput,
    quote: input.quote,
    quoteEnvelope,
    nowMs: input.nowMs,
    config,
  });

  return {
    managerId: manager.managerId,
    quoteEnvelope,
    transactionPlan,
  };
}
