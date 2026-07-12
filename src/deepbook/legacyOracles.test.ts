import { describe, expect, it } from 'vitest';
import {
  filterDayLegacyOracles,
  legacyOracleToMarket,
  parseLegacyOracleObject,
} from './legacyOracles';
import { LEGACY_PREDICT } from '../config/legacyPredict';

/** Shape observed on the live 4-16 `oracle::OracleSVI` objects (chain values 1e9-scaled). */
function oracleObjectJson(overrides: Record<string, unknown> = {}) {
  return {
    id: '0x5f96794c95320ff6d779bd7b876659e1e39340df961c3a734d4ecff56ef9c28f',
    underlying_asset: 'BTC',
    expiry: '1784880000000',
    active: true,
    prices: {
      spot: '64012301959816',
      forward: '64065694836689',
    },
    svi: {
      a: '1259407',
      b: '23951355',
      rho: { magnitude: '237790914', is_negative: true },
      m: { magnitude: '29054887', is_negative: false },
      sigma: '70977051',
    },
    timestamp: '1783867071790',
    settlement_price: null,
    ...overrides,
  };
}

describe('parseLegacyOracleObject', () => {
  it('parses prices and sign-magnitude SVI at the 1e9 chain scale', () => {
    const state = parseLegacyOracleObject(oracleObjectJson());

    expect(state).not.toBeNull();
    expect(state?.oracleId).toBe('0x5f96794c95320ff6d779bd7b876659e1e39340df961c3a734d4ecff56ef9c28f');
    expect(state?.expiryMs).toBe(1_784_880_000_000);
    expect(state?.spot).toBeCloseTo(64_012.3, 1);
    expect(state?.forward).toBeCloseTo(64_065.69, 1);
    expect(state?.svi.rho).toBeCloseTo(-0.23779, 4);
    expect(state?.svi.m).toBeCloseTo(0.029055, 5);
    expect(state?.active).toBe(true);
    expect(state?.settled).toBe(false);
  });

  it('flags settled oracles and rejects incomplete payloads', () => {
    expect(parseLegacyOracleObject(oracleObjectJson({ settlement_price: '64000000000000' }))?.settled).toBe(true);
    expect(parseLegacyOracleObject(oracleObjectJson({ prices: undefined }))).toBeNull();
    expect(parseLegacyOracleObject(oracleObjectJson({ svi: { a: '1' } }))).toBeNull();
    expect(parseLegacyOracleObject(undefined)).toBeNull();
  });
});

describe('filterDayLegacyOracles', () => {
  it('keeps only active, unsettled, future BTC oracles sorted by expiry', () => {
    const nowMs = 1_783_867_000_000;
    const future = parseLegacyOracleObject(oracleObjectJson());
    const later = parseLegacyOracleObject(oracleObjectJson({ id: '0xlater', expiry: '1785484800000' }));
    const expired = parseLegacyOracleObject(oracleObjectJson({ id: '0xexpired', expiry: '1780000000000' }));
    const settled = parseLegacyOracleObject(oracleObjectJson({ id: '0xsettled', settlement_price: '1' }));
    const inactive = parseLegacyOracleObject(oracleObjectJson({ id: '0xinactive', active: false }));

    const filtered = filterDayLegacyOracles([later, future, expired, settled, inactive, null], nowMs);
    expect(filtered.map((oracle) => oracle.oracleId)).toEqual([future?.oracleId, '0xlater']);
  });
});

describe('legacyOracleToMarket', () => {
  it('builds a browse market on the 4-16 $1 grid with no admission tick (classic $500 ladder)', () => {
    const state = parseLegacyOracleObject(oracleObjectJson());
    const market = legacyOracleToMarket(state!);

    expect(market.predictId).toBe(LEGACY_PREDICT.predictObjectId);
    expect(market.tickSize).toBe(1);
    expect(market.admissionTickSize).toBeUndefined();
    expect(market.svi).toEqual(state?.svi);
    expect(market.spotTimestampMs).toBe(state?.updatedAtMs);
    expect(market.status).toBe('active');
  });
});
