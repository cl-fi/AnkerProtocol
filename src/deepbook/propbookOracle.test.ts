import { describe, expect, it } from 'vitest';
import {
  parseBlockScholesForwardObservation,
  parseBlockScholesSpotObservation,
  parseBlockScholesSviObservation,
  parsePythSpotObservation,
  resolveLiveForward,
} from './propbookOracle';

describe('propbookOracle parsers', () => {
  it('parses pyth latest observation into spot + timestamps', () => {
    expect(
      parsePythSpotObservation({
        normalized_spot: '63950827563980',
        source_timestamp_ms: 1783698392600,
        update_timestamp_ms: 1783698392820,
      }),
    ).toEqual({
      spot: 63_950.82756398,
      sourceTimestampMs: 1_783_698_392_600,
      updateTimestampMs: 1_783_698_392_820,
    });
  });

  it('parses block-scholes spot lane latest', () => {
    expect(
      parseBlockScholesSpotObservation({
        lane: {
          latest: {
            source_timestamp_ms: '1783698601000',
            update_timestamp_ms: '1783698601517',
            value: { spot: '63948295664317' },
          },
        },
      }),
    ).toEqual({
      spot: 63_948.295664317,
      sourceTimestampMs: 1_783_698_601_000,
      updateTimestampMs: 1_783_698_601_517,
    });
  });

  it('parses block-scholes forward lane latest for an expiry', () => {
    expect(
      parseBlockScholesForwardObservation({
        latest: {
          source_timestamp_ms: '1783409200000',
          update_timestamp_ms: '1783409200530',
          value: { forward: '64001234567890', expiry_ms: '1783409220000' },
        },
      }),
    ).toEqual({
      forward: 64_001.23456789,
      expiryMs: 1_783_409_220_000,
      sourceTimestampMs: 1_783_409_200_000,
      updateTimestampMs: 1_783_409_200_530,
    });
  });

  it('parses block-scholes SVI lane with signed rho/m', () => {
    expect(
      parseBlockScholesSviObservation({
        latest: {
          source_timestamp_ms: '1783409200000',
          update_timestamp_ms: '1783409200530',
          value: {
            expiry_ms: '1783409220000',
            svi: {
              a: '66',
              b: '55884',
              rho: { is_negative: true, magnitude: '940000000' },
              m: { is_negative: true, magnitude: '252975' },
              sigma: '1000000',
            },
          },
        },
      }),
    ).toEqual({
      expiryMs: 1_783_409_220_000,
      sourceTimestampMs: 1_783_409_200_000,
      updateTimestampMs: 1_783_409_200_530,
      svi: {
        a: 66 / 1_000_000_000,
        b: 55_884 / 1_000_000_000,
        rho: -0.94,
        m: -0.000252975,
        sigma: 0.001,
      },
    });
  });

  it('resolves live forward from pyth×basis when pyth is fresh, else BS forward', () => {
    expect(
      resolveLiveForward({
        pythSpot: 64_000,
        pythFresh: true,
        bsSpot: 63_900,
        bsForward: 64_100,
      }),
    ).toBeCloseTo(64_000 * (64_100 / 63_900));

    expect(
      resolveLiveForward({
        pythSpot: 64_000,
        pythFresh: false,
        bsSpot: 63_900,
        bsForward: 64_100,
      }),
    ).toBe(64_100);
  });
});
