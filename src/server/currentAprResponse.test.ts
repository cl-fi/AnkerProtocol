import { describe, expect, it } from 'vitest';
import type { CurrentUsdsuiAprSnapshot } from '../current/currentUsdsuiApr';
import { buildCurrentAprResponse } from './currentAprResponse';

const snapshot: CurrentUsdsuiAprSnapshot = {
  baseSupplyApr: 0.03,
  rewardApr: 0.05,
  totalApr: 0.08,
  marketName: 'MainMarket',
  coinType: '0x1::usdsui::USDSUI',
  updatedAt: 1_780_000_000_000,
  supplyPaused: false,
  utilization: 0.7,
  source: 'current-api',
};

describe('buildCurrentAprResponse', () => {
  it('returns a successful JSON response with the Current USDsui APR snapshot', async () => {
    const response = await buildCurrentAprResponse({
      fetchSnapshot: async () => snapshot,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(snapshot);
  });

  it('returns the configured fallback when Current is unavailable', async () => {
    const response = await buildCurrentAprResponse({
      fetchSnapshot: async () => {
        throw new Error('upstream failed');
      },
      nowMs: 1_780_000_000_000,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      totalApr: 0.08,
      source: 'current-api-fallback',
    });
  });
});
