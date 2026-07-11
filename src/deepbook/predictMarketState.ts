import { PREDICT_SERVER_URL } from '../config/deepbook';
import { fromChainPrice } from '../products/units';

export interface PredictMarketState {
  expiryMarketId: string;
  expiryMs: number;
  settlementPrice: number | null;
  settlementPriceBaseUnits: bigint | null;
  settledAtMs: number | null;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Predict market state is missing ${label}.`);
  }
  return value;
}

function requiredSafeNumber(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Predict market state has invalid ${label}.`);
  }
  return parsed;
}

function requiredUnsignedBigint(value: unknown, label: string): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) {
    throw new Error(`Predict market state has invalid ${label}.`);
  }
  return BigInt(value);
}

export function parsePredictMarketState(payload: unknown): PredictMarketState {
  if (!isRecord(payload)) throw new Error('Predict market state response is invalid.');
  const market = isRecord(payload.market) ? payload.market : null;
  const expiryMarketId = requiredString(payload.expiry_market_id ?? market?.expiry_market_id, 'expiry market id');
  const expiryMs = requiredSafeNumber(market?.expiry, 'expiry');
  const settlement = isRecord(payload.settlement) ? payload.settlement : null;

  if (!settlement) {
    return {
      expiryMarketId,
      expiryMs,
      settlementPrice: null,
      settlementPriceBaseUnits: null,
      settledAtMs: null,
    };
  }

  const settlementMarketId = requiredString(settlement.expiry_market_id, 'settlement expiry market id');
  if (settlementMarketId.toLowerCase() !== expiryMarketId.toLowerCase()) {
    throw new Error('Predict settlement market does not match the requested expiry market.');
  }
  const settlementPriceBaseUnits = requiredUnsignedBigint(settlement.settlement_price, 'settlement price');

  return {
    expiryMarketId,
    expiryMs,
    settlementPrice: fromChainPrice(settlementPriceBaseUnits.toString()),
    settlementPriceBaseUnits,
    settledAtMs: requiredSafeNumber(settlement.settled_at_ms, 'settled timestamp'),
  };
}

export async function fetchPredictMarketState(expiryMarketId: string): Promise<PredictMarketState> {
  const baseUrl = typeof window === 'undefined' ? PREDICT_SERVER_URL : '/api/predict';
  const response = await fetch(`${baseUrl}/markets/${expiryMarketId}/state`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Predict market state request failed: ${response.status} ${response.statusText}`);
  }
  return parsePredictMarketState(await response.json());
}
