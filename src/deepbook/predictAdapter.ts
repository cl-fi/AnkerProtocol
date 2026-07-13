import { DEEPBOOK_PREDICT, PREDICT_SERVER_URL } from '../config/deepbook';
import type { Transaction } from '@mysten/sui/transactions';
import type { PredictCadenceConfig } from '../config/predictDeployment';
import { filterMarketsForTenorGroup, type TenorGroup } from '../products/tenorMarkets';
import { fromChainPrice } from '../products/units';

const FLOAT_SCALE = 1_000_000_000;

export interface ExpiryMarketSummary {
  expiryMarketId: string;
  expiryMs: number;
  /**
   * Market-created checkpoint timestamp from the indexer (`checkpoint_timestamp_ms`).
   * Used for immutable birth-tenor classification (ADR-0007); omit when unknown.
   */
  createdAtMs?: number;
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

/**
 * `/markets` without filters returns recent `market_created` events; 1m/5m/1h
 * churn fills that window and ages day-scale creations out within hours.
 * `active=true` returns the current unexpired market set instead. limit=500 is
 * only a safety cap on that filtered list.
 */
const MARKETS_PAGE_LIMIT = 500;
const MARKETS_DISCOVERY_PATH = `/markets?limit=${MARKETS_PAGE_LIMIT}&active=true`;

export interface PredictAdapter {
  discoverMarkets(input?: { nowMs?: number }): Promise<ExpiryMarketSummary[]>;
  /** D6 layer-1 browse quotes — SVI + fee stack via SviBrowseQuoteProvider / useDualInvestmentScan. */
  quoteLegs?(legs: unknown[]): Promise<unknown[]>;
  /** Mint legs in a PTB — implemented in #5. */
  mintLegs?(input: unknown): Promise<unknown>;
  /** Add one permissionless 6-24 settled redemption per Note leg. */
  redeemLegs(input: PredictRedeemLegsInput): string[];
  /** List custody positions / notes — implemented in #4/#6. */
  listPositions?(owner: string): Promise<unknown[]>;
}

export interface PredictRedeemLegsInput {
  tx: Transaction;
  expiryMarketId: string;
  wrapperId: string;
  legs: readonly { orderId: bigint; quantityBaseUnits: bigint }[];
  config: {
    predictPackageId: string;
    accountRegistryId: string;
    protocolConfigId: string;
    oracleRegistryId: string;
    pythFeedId: string;
    accumulatorRoot: string;
  };
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
    // Reject null/'' → 0 from Number(); only positive checkpoints are birth timestamps.
    const createdAtRaw = asNumber(item.checkpoint_timestamp_ms);
    const createdAtMs =
      createdAtRaw !== null && createdAtRaw > 0 ? createdAtRaw : undefined;
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
        ...(createdAtMs !== undefined ? { createdAtMs } : {}),
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
  /** @deprecated Prefer group — kept for hourly cadence overrides in tests. */
  cadence?: Pick<PredictCadenceConfig, 'maxExpiryAllocation' | 'initialExpiryCash'>;
  group?: TenorGroup;
}): PredictAdapter {
  const group = input?.group ?? 'hourly';
  const fetchMarkets =
    input?.fetchMarkets ?? (() => fetchPredictJson<unknown>(MARKETS_DISCOVERY_PATH));

  return {
    async discoverMarkets({ nowMs = Date.now() } = {}) {
      const rows = parseExpiryMarketRows(await fetchMarkets());
      return filterMarketsForTenorGroup(rows, group, {
        nowMs,
        turboCadence: input?.cadence ?? DEEPBOOK_PREDICT.turboCadence,
      });
    },
    redeemLegs(redeemInput) {
      const market = redeemInput.tx.object(redeemInput.expiryMarketId);
      const wrapper = redeemInput.tx.object(redeemInput.wrapperId);
      const accountRegistry = redeemInput.tx.object(redeemInput.config.accountRegistryId);
      const protocolConfig = redeemInput.tx.object(redeemInput.config.protocolConfigId);
      const oracleRegistry = redeemInput.tx.object(redeemInput.config.oracleRegistryId);
      const pyth = redeemInput.tx.object(redeemInput.config.pythFeedId);
      const accumulatorRoot = redeemInput.tx.object(redeemInput.config.accumulatorRoot);
      const clock = redeemInput.tx.object.clock();
      const redeemTarget = `${redeemInput.config.predictPackageId}::expiry_market::redeem_settled`;

      redeemInput.legs.forEach((leg) => {
        redeemInput.tx.moveCall({
          target: redeemTarget,
          arguments: [
            market,
            accountRegistry,
            wrapper,
            protocolConfig,
            oracleRegistry,
            pyth,
            redeemInput.tx.pure.u256(leg.orderId),
            redeemInput.tx.pure.u64(leg.quantityBaseUnits),
            accumulatorRoot,
            clock,
          ],
        });
      });

      return redeemInput.legs.map(() => redeemTarget);
    },
  };
}

/** Unfiltered `/markets` parse — callers apply tenor-group filters. */
export async function fetchAllExpiryMarketSummaries(
  fetchMarkets: () => Promise<unknown> = () =>
    fetchPredictJson<unknown>(MARKETS_DISCOVERY_PATH),
): Promise<ExpiryMarketSummary[]> {
  return parseExpiryMarketRows(await fetchMarkets());
}

export const predictAdapter = createPredictAdapter();
