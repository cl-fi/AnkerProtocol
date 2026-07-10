import { describe, expect, it } from 'vitest';
import { DEEPBOOK_PREDICT } from '../config/deepbook';
import { filterExpiryMarketsByCadence, parseExpiryMarketRows } from './predictAdapter';

const HOUR_ALLOC = DEEPBOOK_PREDICT.turboCadence.maxExpiryAllocation;
const HOUR_CASH = DEEPBOOK_PREDICT.turboCadence.initialExpiryCash;
const MINUTE_ALLOC = '50000000000';
const MINUTE_CASH = '10000000000';

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

  it('keeps only the Turbo 1h cadence markets', () => {
    const nowMs = 1_700_000_000_000;
    const rows = parseExpiryMarketRows([
      marketRow({
        id: '0x1m',
        expiry: nowMs + 60_000,
        maxExpiryAllocation: MINUTE_ALLOC,
        initialExpiryCash: MINUTE_CASH,
      }),
      marketRow({
        id: '0x1h-a',
        expiry: nowMs + 3_600_000,
        maxExpiryAllocation: HOUR_ALLOC,
        initialExpiryCash: HOUR_CASH,
      }),
      marketRow({
        id: '0x1h-b',
        expiry: nowMs + 7_200_000,
        maxExpiryAllocation: HOUR_ALLOC,
        initialExpiryCash: HOUR_CASH,
      }),
      marketRow({
        id: '0x1h-past',
        expiry: nowMs - 1,
        maxExpiryAllocation: HOUR_ALLOC,
        initialExpiryCash: HOUR_CASH,
      }),
    ]);

    const turbo = filterExpiryMarketsByCadence(rows, DEEPBOOK_PREDICT.turboCadence, nowMs);
    expect(turbo.map((market) => market.expiryMarketId)).toEqual(['0x1h-a', '0x1h-b']);
  });
});
