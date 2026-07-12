import { describe, expect, it } from 'vitest';
import { loadDaySnapshot } from './daySnapshot';

describe('loadDaySnapshot', () => {
  it('loads the committed photograph: dated capture, day oracles with SVI, Binance benchmark', () => {
    const snapshot = loadDaySnapshot();

    expect(Number.isFinite(snapshot.capturedAtMs)).toBe(true);
    expect(snapshot.capturedAtMs).toBeGreaterThan(0);

    // Photograph model: every row was a live, unsettled day tenor as of the capture clock.
    expect(snapshot.oracles.length).toBeGreaterThan(0);
    for (const oracle of snapshot.oracles) {
      expect(oracle.underlyingAsset).toBe('BTC');
      expect(oracle.expiryMs).toBeGreaterThan(snapshot.capturedAtMs);
      expect(oracle.spot).toBeGreaterThan(0);
      expect(oracle.svi.b).toBeGreaterThan(0);
      expect(oracle.settled).toBe(false);
    }
    // Sorted by expiry so the first row is the default day selection.
    const expiries = snapshot.oracles.map((oracle) => oracle.expiryMs);
    expect([...expiries].sort((a, b) => a - b)).toEqual(expiries);

    // The frozen Binance benchmark captured at the same instant (never live-stitched).
    expect(snapshot.binanceProducts.length).toBeGreaterThan(0);
    expect(snapshot.binanceProducts[0]?.strikePrice).toBeGreaterThan(0);
  });
});
