import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import { DEEPBOOK_PREDICT, SUI_NETWORK } from '../config/deepbook';
import { isDeterministicE2E } from '../config/runtimeModes';
import type { LegIntent, LegQuote } from '../products/types';
import { toChainPrice } from '../products/units';

const DEV_INSPECT_SENDER =
  '0x0000000000000000000000000000000000000000000000000000000000000001';
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

function fromQuoteBaseUnits(value: bigint): number {
  return Number(value) / QUOTE_ASSET_SCALE;
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

function parseDevInspectAmounts(result: unknown): { mintCost: bigint; redeemPayout: bigint } {
  return parseDevInspectLegAmounts(result, 1)[0];
}

function buildKey(tx: Transaction, leg: LegIntent) {
  if (leg.instrumentType === 'range') {
    if (leg.lowerStrike === undefined || leg.higherStrike === undefined) {
      throw new Error('Range leg requires lower and higher strikes.');
    }
    return tx.moveCall({
      target: `${DEEPBOOK_PREDICT.packageId}::range_key::new`,
      arguments: [
        tx.pure.id(leg.oracleId),
        tx.pure.u64(leg.expiryMs),
        tx.pure.u64(toChainPrice(leg.lowerStrike)),
        tx.pure.u64(toChainPrice(leg.higherStrike)),
      ],
    });
  }
  if (leg.strike === undefined) {
    throw new Error('Binary leg requires strike.');
  }
  return tx.moveCall({
    target: `${DEEPBOOK_PREDICT.packageId}::market_key::new`,
    arguments: [
      tx.pure.id(leg.oracleId),
      tx.pure.u64(leg.expiryMs),
      tx.pure.u64(toChainPrice(leg.strike)),
      tx.pure.bool(leg.isUp ?? true),
    ],
  });
}

function addPreviewCall(tx: Transaction, leg: LegIntent) {
  const key = buildKey(tx, leg);
  tx.moveCall({
    target:
      leg.instrumentType === 'range'
        ? `${DEEPBOOK_PREDICT.packageId}::predict::get_range_trade_amounts`
        : `${DEEPBOOK_PREDICT.packageId}::predict::get_trade_amounts`,
    arguments: [
      tx.object(DEEPBOOK_PREDICT.predictObjectId),
      tx.object(leg.oracleId),
      key,
      tx.pure.u64(toPreviewQuantityBaseUnits(leg.quantity)),
      tx.object.clock(),
    ],
  });
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

export class LivePreviewQuoteProvider implements QuoteProvider {
  private readonly client = new SuiJsonRpcClient({
    network: SUI_NETWORK,
    url: getJsonRpcFullnodeUrl(SUI_NETWORK),
  });

  constructor(private readonly fallback: QuoteProvider = new SnapshotQuoteProvider()) {}

  async quoteLegs(legs: LegIntent[]): Promise<LegQuote[]> {
    return Promise.all(
      legs.map(async (leg) => {
        try {
          return await this.previewLeg(leg);
        } catch (error) {
          const [fallback] = await this.fallback.quoteLegs([leg]);
          return {
            ...fallback,
            error: error instanceof Error ? error.message : fallback.error,
          };
        }
      }),
    );
  }

  private async previewLeg(leg: LegIntent): Promise<LegQuote> {
    const tx = new Transaction();
    addPreviewCall(tx, leg);

    const result = await this.client.devInspectTransactionBlock({
      sender: DEV_INSPECT_SENDER,
      transactionBlock: tx,
    });
    const rawAmounts = parseDevInspectAmounts(result);
    const amounts = normalizePreviewResult({
      mintCost: fromQuoteBaseUnits(rawAmounts.mintCost),
      redeemPayout: fromQuoteBaseUnits(rawAmounts.redeemPayout),
    });
    return applyPredictMintBounds(leg, amounts);
  }
}

export class BatchedLivePreviewQuoteProvider implements QuoteProvider {
  private readonly client = new SuiJsonRpcClient({
    network: SUI_NETWORK,
    url: getJsonRpcFullnodeUrl(SUI_NETWORK),
  });

  async quoteLegs(legs: LegIntent[]): Promise<LegQuote[]> {
    if (legs.length === 0) return [];
    const tx = new Transaction();
    legs.forEach((leg) => addPreviewCall(tx, leg));

    const result = await this.client.devInspectTransactionBlock({
      sender: DEV_INSPECT_SENDER,
      transactionBlock: tx,
    });
    const amounts = parseDevInspectLegAmounts(result, legs.length);
    return legs.map((leg, index) => {
      const normalized = normalizePreviewResult({
        mintCost: fromQuoteBaseUnits(amounts[index].mintCost),
        redeemPayout: fromQuoteBaseUnits(amounts[index].redeemPayout),
      });
      return applyPredictMintBounds(leg, normalized);
    });
  }
}

export function createDefaultQuoteProvider(): QuoteProvider {
  return isDeterministicE2E() ? new SnapshotQuoteProvider() : new BatchedLivePreviewQuoteProvider();
}
