import type { LegIntent, LegQuote } from '../products/types';

export interface QuoteProvider {
  quoteLegs(legs: LegIntent[]): Promise<LegQuote[]>;
}

export class SnapshotQuoteProvider implements QuoteProvider {
  async quoteLegs(legs: LegIntent[]): Promise<LegQuote[]> {
    const now = Date.now();
    return legs.map((leg) => {
      const moneyness =
        leg.strike === undefined ? 0.35 : Math.max(0.04, Math.min(0.92, 1 - leg.strike / 100_000));
      const askPrice = leg.instrumentType === 'range' ? 0.18 : moneyness;
      const askCost = askPrice * leg.quantity;
      return {
        ...leg,
        askPrice,
        askCost,
        redeemPreview: Math.max(0, askPrice - 0.02) * leg.quantity,
        quoteTimestampMs: now,
        executable: false,
        error: 'Using stale snapshot pricing until live preview is connected.',
      };
    });
  }
}

export class LivePreviewQuoteProvider implements QuoteProvider {
  constructor(private readonly fallback: QuoteProvider = new SnapshotQuoteProvider()) {}

  async quoteLegs(legs: LegIntent[]): Promise<LegQuote[]> {
    try {
      return await this.previewLegs(legs);
    } catch {
      return this.fallback.quoteLegs(legs);
    }
  }

  private async previewLegs(_legs: LegIntent[]): Promise<LegQuote[]> {
    throw new Error('Live preview adapter is not connected in this task.');
  }
}
