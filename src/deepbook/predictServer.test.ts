import { describe, expect, it } from 'vitest';
import statusFixture from '../test/fixtures/status.json';
import oracleFixture from '../test/fixtures/oracleState.json';
import { parseOracleState, parseStatus } from './predictServer';

describe('predictServer parsers', () => {
  it('parses server status freshness', () => {
    expect(parseStatus(statusFixture).maxCheckpointLag).toBe(5);
    expect(parseStatus(statusFixture).maxTimeLagSeconds).toBe(1);
  });

  it('parses oracle state into normalized market data', () => {
    const parsed = parseOracleState(oracleFixture, { serverLagSeconds: 1 });
    expect(parsed.oracleId).toBe('0xb46fdd7aee8b5b729358a254a74ec4eb59c2a07ca8878cc77df09b843bae6c38');
    expect(parsed.underlyingAsset).toBe('BTC');
    expect(parsed.spot).toBeCloseTo(73264.292161574);
    expect(parsed.forward).toBeCloseTo(73264.782323624);
    expect(parsed.minStrike).toBe(50000);
    expect(parsed.tickSize).toBe(1);
    expect(parsed.status).toBe('active');
  });
});
