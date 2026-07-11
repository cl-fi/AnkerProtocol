import { describe, expect, it } from 'vitest';
import { dayScaleFixtureMarkets } from '../deepbook/dayScaleFixtures';
import { DAY_MS, resolveProductLineDataSource } from '../products/productLineMarkets';
import { parseProductLineParam } from './curatedOracles';
import { deterministicMultiDayCuratedBtcOracleResponse } from './deterministicPredictFixtures';

describe('multi-day curated product line (D4)', () => {
  it('parses the productLine query param', () => {
    expect(parseProductLineParam(null)).toBe('turbo');
    expect(parseProductLineParam('turbo')).toBe('turbo');
    expect(parseProductLineParam('multi-day')).toBe('multi-day');
    expect(parseProductLineParam('other')).toBe('turbo');
  });

  it('exposes labeled fixture curated rows when discovery has no day-scale markets', () => {
    const nowMs = 1_700_000_000_000;
    const source = resolveProductLineDataSource({
      line: 'multi-day',
      discovered: [],
      fixtures: dayScaleFixtureMarkets(nowMs),
      nowMs,
    });
    expect(source.kind).toBe('fixture');

    const response = deterministicMultiDayCuratedBtcOracleResponse(nowMs);
    expect(response.dataSource).toBe('fixture');
    expect(response.reason).toBe('no-day-scale-markets');
    expect(response.oracles.every((oracle) => oracle.productLine === 'multi-day')).toBe(true);
    expect(response.oracles.every((oracle) => oracle.expiry - nowMs >= DAY_MS)).toBe(true);
  });
});
