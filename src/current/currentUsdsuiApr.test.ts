import { describe, expect, it } from 'vitest';
import { CURRENT_USDSUI_COIN_TYPE, parseCurrentUsdsuiApr } from './currentUsdsuiApr';

describe('parseCurrentUsdsuiApr', () => {
  it('combines Current base supply APY with active USDsui deposit incentives', () => {
    const snapshot = parseCurrentUsdsuiApr({
      nowMs: 1_780_900_000_000,
      marketInfo: {
        supplyAPY: '0.029394800460288',
        supplyPaused: false,
        utilization: '0.76',
      },
      marketConfigs: [
        {
          name: 'MainMarket',
          summaries: [
            {
              rewardType: 0,
              reserveCoinType: CURRENT_USDSUI_COIN_TYPE,
              rewards: [
                {
                  apr: '0.053430940224',
                  startTimeMs: 1_780_000_000_000,
                  endTimeMs: 1_781_000_000_000,
                },
                {
                  apr: '0.1',
                  startTimeMs: 1_779_000_000_000,
                  endTimeMs: 1_779_500_000_000,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(snapshot.baseSupplyApr).toBeCloseTo(0.029394800460288);
    expect(snapshot.rewardApr).toBeCloseTo(0.053430940224);
    expect(snapshot.totalApr).toBeCloseTo(0.082825740684288);
    expect(snapshot.utilization).toBeCloseTo(0.76);
    expect(snapshot.supplyPaused).toBe(false);
  });

  it('uses only base supply APY when there is no active reward', () => {
    const snapshot = parseCurrentUsdsuiApr({
      nowMs: 2_000,
      marketInfo: {
        supplyAPY: 0.03,
        supplyPaused: true,
      },
      marketConfigs: [
        {
          name: 'MainMarket',
          summaries: [
            {
              rewardType: 0,
              reserveCoinType: CURRENT_USDSUI_COIN_TYPE,
              rewards: [{ apr: 0.05, startTimeMs: 0, endTimeMs: 1_000 }],
            },
          ],
        },
      ],
    });

    expect(snapshot.baseSupplyApr).toBe(0.03);
    expect(snapshot.rewardApr).toBe(0);
    expect(snapshot.totalApr).toBe(0.03);
    expect(snapshot.supplyPaused).toBe(true);
  });
});
