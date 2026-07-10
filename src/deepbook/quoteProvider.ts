import { DEEPBOOK_PREDICT } from '../config/deepbook';
import { isFixtureDataMode } from '../config/runtimeModes';
import type { LegIntent, LegQuote } from '../products/types';

const QUOTE_ASSET_SCALE = 10 ** DEEPBOOK_PREDICT.quoteAssetDecimals;

export interface QuoteProvider {
  quoteLegs(legs: LegIntent[]): Promise<LegQuote[]>;
}

export interface PredictMintBounds {
  minAskPrice: number;
  maxAskPrice: number;
}

export const DEFAULT_PREDICT_MINT_BOUNDS: PredictMintBounds = {
  minAskPrice: DEEPBOOK_PREDICT.minAskPrice,
  maxAskPrice: DEEPBOOK_PREDICT.maxAskPrice,
};

export function normalizePreviewResult(input: { mintCost: string | number; redeemPayout: string | number }) {
  return {
    askCost: Number(input.mintCost),
    redeemPreview: Number(input.redeemPayout),
  };
}

export function applyPredictMintBounds(
  leg: LegIntent,
  amounts: { askCost: number; redeemPreview: number },
  quoteTimestampMs = Date.now(),
  bounds: PredictMintBounds = DEFAULT_PREDICT_MINT_BOUNDS,
): LegQuote {
  const askPrice = leg.quantity === 0 ? 0 : amounts.askCost / leg.quantity;
  const mintable = leg.quantity > 0 && askPrice >= bounds.minAskPrice && askPrice <= bounds.maxAskPrice;

  return {
    ...leg,
    askPrice,
    askCost: amounts.askCost,
    redeemPreview: amounts.redeemPreview,
    quoteTimestampMs,
    executable: mintable,
    error: mintable
      ? undefined
      : `Ask price ${askPrice.toFixed(4)} is outside Predict mint bounds ${bounds.minAskPrice}-${bounds.maxAskPrice}.`,
  };
}

export function toPreviewQuantityBaseUnits(value: number): bigint {
  if (!Number.isFinite(value)) {
    throw new Error('Preview quantity must be a finite number.');
  }
  if (value <= 0) {
    throw new Error('Preview quantity must be greater than zero.');
  }

  const rounded = Math.round(value * QUOTE_ASSET_SCALE);
  if (rounded <= 0) {
    throw new Error('Preview quantity rounds to zero base units.');
  }
  if (!Number.isSafeInteger(rounded)) {
    throw new Error('Preview quantity exceeds safe integer range.');
  }

  return BigInt(rounded);
}

function readU64Le(bytes: number[]): bigint {
  const view = new DataView(Uint8Array.from(bytes).buffer);
  return view.getBigUint64(0, true);
}

export function parseDevInspectLegAmounts(
  result: unknown,
  expectedLegCount: number,
): Array<{ mintCost: bigint; redeemPayout: bigint }> {
  const data = result as {
    error?: string | null;
    results?: Array<{ returnValues?: [number[], string][] }>;
  };
  if (data.error) {
    throw new Error(data.error);
  }
  const amounts =
    data.results
      ?.map((entry) => entry.returnValues)
      .filter((returnValues): returnValues is [number[], string][] => Boolean(returnValues && returnValues.length >= 2))
      .map((returnValues) => ({
        mintCost: readU64Le(returnValues[0][0]),
        redeemPayout: readU64Le(returnValues[1][0]),
      })) ?? [];

  if (amounts.length !== expectedLegCount) {
    throw new Error(`DevInspect returned ${amounts.length} leg quotes, expected ${expectedLegCount}.`);
  }
  return amounts;
}

export class SnapshotQuoteProvider implements QuoteProvider {
  async quoteLegs(legs: LegIntent[]): Promise<LegQuote[]> {
    const now = Date.now();
    return legs.map((leg) => {
      const rawMoneyness =
        leg.strike === undefined
          ? 0.35
          : leg.instrumentType === 'binary-down'
            ? leg.strike / 100_000
            : 1 - leg.strike / 100_000;
      const moneyness = Math.max(0.04, Math.min(0.92, rawMoneyness));
      const askPrice = leg.instrumentType === 'range' ? 0.18 : moneyness;
      const askCost = askPrice * leg.quantity;
      return {
        ...leg,
        askPrice,
        askCost,
        redeemPreview: Math.max(0, askPrice - 0.02) * leg.quantity,
        quoteTimestampMs: now,
        executable: false,
        error: 'Using stale snapshot pricing until live preview succeeds.',
      };
    });
  }
}

/**
 * 4-16 JSON-RPC /devInspect quote path removed (D7). Live 6-24 quoting lands in #3
 * (SVI display + gRPC simulateTransaction). Until then, fall back to snapshot quotes.
 */
export class LivePreviewQuoteProvider implements QuoteProvider {
  constructor(private readonly fallback: QuoteProvider = new SnapshotQuoteProvider()) {}

  async quoteLegs(legs: LegIntent[]): Promise<LegQuote[]> {
    return this.fallback.quoteLegs(legs);
  }
}

export class BatchedLivePreviewQuoteProvider implements QuoteProvider {
  constructor(private readonly fallback: QuoteProvider = new SnapshotQuoteProvider()) {}

  async quoteLegs(legs: LegIntent[]): Promise<LegQuote[]> {
    return this.fallback.quoteLegs(legs);
  }
}

export function createDefaultQuoteProvider(): QuoteProvider {
  return isFixtureDataMode() ? new SnapshotQuoteProvider() : new BatchedLivePreviewQuoteProvider();
}
