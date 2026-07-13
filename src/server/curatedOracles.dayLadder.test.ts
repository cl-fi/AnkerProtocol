import { describe, expect, it } from 'vitest';
import { parseLegacyOracleObject } from '../deepbook/legacyOracles';
import { legacyOracleToListItem } from './curatedOracles';
import { deterministicCuratedBtcOracleResponse } from './deterministicPredictFixtures';

const ORACLE_JSON = {
  id: '0x5f96794c95320ff6d779bd7b876659e1e39340df961c3a734d4ecff56ef9c28f',
  underlying_asset: 'BTC',
  expiry: '1784880000000',
  active: true,
  prices: { spot: '64012301959816', forward: '64065694836689' },
  svi: {
    a: '1259407',
    b: '23951355',
    rho: { magnitude: '237790914', is_negative: true },
    m: { magnitude: '29054887', is_negative: false },
    sigma: '70977051',
  },
  timestamp: '1783867071790',
  settlement_price: null,
};

describe('legacyOracleToListItem', () => {
  const state = parseLegacyOracleObject(ORACLE_JSON)!;

  it('tags snapshot rows as day-group rows with an embedded browse market, frozen on the capture clock', () => {
    const capturedAtMs = 1_783_000_000_000;
    const row = legacyOracleToListItem(state, { nowMs: capturedAtMs, source: 'snapshot' });

    expect(row.group).toBe('day');
    expect(row.source).toBe('snapshot');
    expect(row.productReady).toBe(true);
    // Photograph model: the countdown freezes at the capture instant.
    expect(row.timeToExpiryMs).toBe(state.expiryMs - capturedAtMs);
    expect(row.market?.svi).toEqual(state.svi);
    expect(row.market?.spot).toBeCloseTo(64_012.3, 1);
  });
});

describe('deterministicCuratedBtcOracleResponse (demo/E2E)', () => {
  it('serves one merged response: day rows first, then live hourly rows, plus snapshot meta', () => {
    const nowMs = 1_700_000_000_000;
    const response = deterministicCuratedBtcOracleResponse(nowMs);

    const dayRows = response.oracles.filter((oracle) => oracle.group === 'day');
    const hourlyRows = response.oracles.filter((oracle) => oracle.group === 'hourly');
    expect(dayRows.length).toBeGreaterThan(0);
    expect(hourlyRows.length).toBe(3);

    // Day group leads (primary product) and carries embedded browse markets.
    expect(response.oracles.slice(0, dayRows.length).every((oracle) => oracle.group === 'day')).toBe(true);
    expect(dayRows.every((oracle) => oracle.source === 'snapshot' && oracle.market)).toBe(true);
    expect(hourlyRows.every((oracle) => oracle.source === 'live' && oracle.cadence === '1h')).toBe(true);

    expect(response.snapshot?.capturedAtMs).toBe(nowMs);
    expect(response.snapshot?.binanceProducts.length).toBeGreaterThan(0);
  });
});
