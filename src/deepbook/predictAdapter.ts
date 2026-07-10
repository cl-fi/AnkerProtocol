import { DEEPBOOK_PREDICT, PREDICT_SERVER_URL } from '../config/deepbook';
import type { PredictCadenceConfig } from '../config/predictDeployment';
import { fromChainPrice } from '../products/units';

const FLOAT_SCALE = 1_000_000_000;

export interface ExpiryMarketSummary {
  expiryMarketId: string;
  expiryMs: number;
  tickSize: number;
  admissionTickSize: number;
  maxExpiryAllocation: string;
  initialExpiryCash: string;
  packageId: string;
  poolVaultId: string;
  propbookUnderlyingId: number;
  baseFee: number;
  minFee: number;
  minEntryProbability: number;
  maxEntryProbability: number;
}

export interface PredictAdapter {
  discoverMarkets(input?: { nowMs?: number }): Promise<ExpiryMarketSummary[]>;
  /** D6 layer-1 browse quotes — SVI + fee stack via SviBrowseQuoteProvider / useDualInvestmentScan. */
  quoteLegs?(legs: unknown[]): Promise<unknown[]>;
  /** Mint legs in a PTB — implemented in #5. */
  mintLegs?(input: unknown): Promise<unknown>;
  /** Redeem settled legs — implemented in #6. */
  redeemLegs?(input: unknown): Promise<unknown>;
  /** List custody positions / notes — implemented in #4/#6. */
  listPositions?(owner: string): Promise<unknown[]>;
}


type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function scaledProbability(value: unknown): number | null {
  const raw = asNumber(value);
  if (raw === null) return null;
  return raw / FLOAT_SCALE;
}

export function parseExpiryMarketRows(payload: unknown): ExpiryMarketSummary[] {
  if (!Array.isArray(payload)) return [];

  return payload.flatMap((item) => {
    if (!isRecord(item)) return [];
    const expiryMarketId = asString(item.expiry_market_id);
    const expiryMs = asNumber(item.expiry);
    const tickSizeRaw = asNumber(item.tick_size);
    const admissionTickSizeRaw = asNumber(item.admission_tick_size);
    const maxExpiryAllocation = asString(item.max_expiry_allocation);
    const initialExpiryCash = asString(item.initial_expiry_cash);
    const packageId = asString(item.package) ?? DEEPBOOK_PREDICT.packageId;
    const poolVaultId = asString(item.pool_vault_id) ?? DEEPBOOK_PREDICT.poolVaultId;
    const propbookUnderlyingId = asNumber(item.propbook_underlying_id);
    const baseFee = scaledProbability(item.base_fee);
    const minFee = scaledProbability(item.min_fee);
    const minEntryProbability = scaledProbability(item.min_entry_probability);
    const maxEntryProbability = scaledProbability(item.max_entry_probability);

    if (
      !expiryMarketId ||
      expiryMs === null ||
      tickSizeRaw === null ||
      admissionTickSizeRaw === null ||
      !maxExpiryAllocation ||
      !initialExpiryCash ||
      propbookUnderlyingId === null ||
      baseFee === null ||
      minFee === null ||
      minEntryProbability === null ||
      maxEntryProbability === null
    ) {
      return [];
    }

    return [
      {
        expiryMarketId,
        expiryMs,
        tickSize: fromChainPrice(tickSizeRaw),
        admissionTickSize: fromChainPrice(admissionTickSizeRaw),
        maxExpiryAllocation,
        initialExpiryCash,
        packageId,
        poolVaultId,
        propbookUnderlyingId,
        baseFee,
        minFee,
        minEntryProbability,
        maxEntryProbability,
      },
    ];
  });
}

export function filterExpiryMarketsByCadence(
  markets: readonly ExpiryMarketSummary[],
  cadence: Pick<PredictCadenceConfig, 'maxExpiryAllocation' | 'initialExpiryCash'>,
  nowMs = Date.now(),
): ExpiryMarketSummary[] {
  return markets
    .filter(
      (market) =>
        market.expiryMs > nowMs &&
        market.maxExpiryAllocation === cadence.maxExpiryAllocation &&
        market.initialExpiryCash === cadence.initialExpiryCash,
    )
    .sort((a, b) => a.expiryMs - b.expiryMs);
}

async function fetchPredictJson<T>(path: string): Promise<T> {
  const baseUrl = typeof window === 'undefined' ? PREDICT_SERVER_URL : '/api/predict';
  const response = await fetch(`${baseUrl}${path}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Predict server request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function createPredictAdapter(input?: {
  fetchMarkets?: () => Promise<unknown>;
  cadence?: Pick<PredictCadenceConfig, 'maxExpiryAllocation' | 'initialExpiryCash'>;
}): PredictAdapter {
  const cadence = input?.cadence ?? DEEPBOOK_PREDICT.turboCadence;
  const fetchMarkets = input?.fetchMarkets ?? (() => fetchPredictJson<unknown>('/markets'));

  return {
    async discoverMarkets({ nowMs = Date.now() } = {}) {
      const rows = parseExpiryMarketRows(await fetchMarkets());
      return filterExpiryMarketsByCadence(rows, cadence, nowMs);
    },
  };
}

export const predictAdapter = createPredictAdapter();
