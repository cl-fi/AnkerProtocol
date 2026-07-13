import { afterEach, describe, expect, it, vi } from 'vitest';
import { Transaction } from '@mysten/sui/transactions';
import { DEEPBOOK_PREDICT } from '../config/deepbook';
import { createPredictAdapter, parseExpiryMarketRows } from './predictAdapter';

const HOUR_ALLOC = DEEPBOOK_PREDICT.turboCadence.maxExpiryAllocation;
const HOUR_CASH = DEEPBOOK_PREDICT.turboCadence.initialExpiryCash;
const MINUTE_ALLOC = '50000000000';
const MINUTE_CASH = '10000000000';
const DAY_ALLOC = '999000000000';
const DAY_CASH = '999000000000';

function marketRow(input: {
  id: string;
  expiry: number;
  maxExpiryAllocation: string;
  initialExpiryCash: string;
}) {
  return {
    expiry_market_id: input.id,
    expiry: input.expiry,
    tick_size: '10000000',
    admission_tick_size: '1000000000',
    max_expiry_allocation: input.maxExpiryAllocation,
    initial_expiry_cash: input.initialExpiryCash,
    package: DEEPBOOK_PREDICT.packageId,
    pool_vault_id: DEEPBOOK_PREDICT.poolVaultId,
    propbook_underlying_id: 1,
    base_fee: '20000000',
    min_fee: '5000000',
    min_entry_probability: '10000000',
    max_entry_probability: '990000000',
    checkpoint_timestamp_ms: input.expiry - 3_600_000,
    kind: 'market_created',
  };
}

describe('PredictAdapter market discovery', () => {
  it('parses indexer /markets rows into Expiry Market summaries', () => {
    const markets = parseExpiryMarketRows([
      marketRow({
        id: '0xaaa',
        expiry: 1_800_000_000_000,
        maxExpiryAllocation: HOUR_ALLOC,
        initialExpiryCash: HOUR_CASH,
      }),
    ]);

    // checkpoint_timestamp_ms stays in the raw payload but is not parsed:
    // shelving follows remaining tenor (ADR-0007), so birth time is unused.
    expect(markets).toEqual([
      {
        expiryMarketId: '0xaaa',
        expiryMs: 1_800_000_000_000,
        tickSize: 0.01,
        admissionTickSize: 1,
        maxExpiryAllocation: HOUR_ALLOC,
        initialExpiryCash: HOUR_CASH,
        packageId: DEEPBOOK_PREDICT.packageId,
        poolVaultId: DEEPBOOK_PREDICT.poolVaultId,
        propbookUnderlyingId: 1,
        baseFee: 0.02,
        minFee: 0.005,
        minEntryProbability: 0.01,
        maxEntryProbability: 0.99,
      },
    ]);
  });

  it('shelves discovery by remaining tenor: hourly keeps decayed day rows, drops minute rows', async () => {
    const nowMs = 1_700_000_000_000;
    const dayMs = 86_400_000;
    const payload = [
      marketRow({
        id: '0x1m',
        expiry: nowMs + 60_000,
        maxExpiryAllocation: MINUTE_ALLOC,
        initialExpiryCash: MINUTE_CASH,
      }),
      marketRow({
        id: '0x1h-past',
        expiry: nowMs - 1,
        maxExpiryAllocation: HOUR_ALLOC,
        initialExpiryCash: HOUR_CASH,
      }),
      marketRow({
        id: '0xdecayed-day',
        expiry: nowMs + 9 * 3_600_000,
        maxExpiryAllocation: DAY_ALLOC,
        initialExpiryCash: DAY_CASH,
      }),
      marketRow({
        id: '0x1h-a',
        expiry: nowMs + 3_600_000,
        maxExpiryAllocation: HOUR_ALLOC,
        initialExpiryCash: HOUR_CASH,
      }),
      marketRow({
        id: '0x3d',
        expiry: nowMs + 3 * dayMs,
        maxExpiryAllocation: DAY_ALLOC,
        initialExpiryCash: DAY_CASH,
      }),
    ];
    const fetchMarkets = async () => payload;

    const hourly = await createPredictAdapter({ fetchMarkets }).discoverMarkets({ nowMs });
    expect(hourly.map((market) => market.expiryMarketId)).toEqual(['0x1h-a', '0xdecayed-day']);

    const day = await createPredictAdapter({ fetchMarkets, group: 'day' }).discoverMarkets({ nowMs });
    expect(day.map((market) => market.expiryMarketId)).toEqual(['0x3d']);
  });

  describe('default /markets request', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('requests active markets so day-scale rows are not paged out by hourly churn', async () => {
      const requestedUrls: string[] = [];
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        requestedUrls.push(String(input));
        return { ok: true, json: async () => [] } as Response;
      });
      vi.stubGlobal('fetch', fetchMock);

      await createPredictAdapter().discoverMarkets();

      expect(requestedUrls).toHaveLength(1);
      expect(requestedUrls[0]).toContain('/markets?limit=500&active=true');
    });
  });
});

describe('PredictAdapter settled leg redemption', () => {
  it('adds one 6-24 redeem_settled command per Note order id', async () => {
    const tx = new Transaction();
    const calls = createPredictAdapter().redeemLegs({
      tx,
      expiryMarketId: `0x${'1'.repeat(64)}`,
      wrapperId: `0x${'2'.repeat(64)}`,
      legs: [
        { orderId: 11n, quantityBaseUnits: 40_000n },
        { orderId: 22n, quantityBaseUnits: 60_000n },
      ],
      config: {
        predictPackageId: `0x${'3'.repeat(64)}`,
        accountRegistryId: `0x${'4'.repeat(64)}`,
        protocolConfigId: `0x${'5'.repeat(64)}`,
        oracleRegistryId: `0x${'6'.repeat(64)}`,
        pythFeedId: `0x${'7'.repeat(64)}`,
        accumulatorRoot: `0x${'8'.repeat(64)}`,
      },
    });

    expect(calls).toEqual([
      `${`0x${'3'.repeat(64)}`}::expiry_market::redeem_settled`,
      `${`0x${'3'.repeat(64)}`}::expiry_market::redeem_settled`,
    ]);
    expect(await tx.toJSON()).toContain('redeem_settled');
  });
});
