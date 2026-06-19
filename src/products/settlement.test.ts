import { describe, expect, it } from 'vitest';
import {
  calculateSettlement,
  calculateSettlementFromGrossPayout,
  settlementPayoutRange,
  settledLegsFromPrice,
  type DualInvestmentSettlementNote,
} from './settlement';

function noteFixture(overrides: Partial<DualInvestmentSettlementNote> = {}): DualInvestmentSettlementNote {
  return {
    principalBaseUnits: 1_000_000_000n,
    reserveBaseUnits: 900_000_000n,
    couponBaseUnits: 10_000_000n,
    feeBps: 1_000,
    legs: [
      {
        legId: 'up-60000',
        strike: 60_000,
        isUp: true,
        quantityBaseUnits: 40_000_000n,
      },
      {
        legId: 'up-62000',
        strike: 62_000,
        isUp: true,
        quantityBaseUnits: 60_000_000n,
      },
    ],
    ...overrides,
  };
}

describe('calculateSettlement', () => {
  it('pays reserve plus coupon when settlement is below every strike', () => {
    const note = noteFixture({
      principalBaseUnits: 5_000_000n,
      reserveBaseUnits: 4_936_412n,
      couponBaseUnits: 7_453n,
      legs: [
        {
          legId: 'up-64667',
          strike: 64_667,
          isUp: true,
          quantityBaseUnits: 63_588n,
        },
      ],
    });

    const settlement = calculateSettlement(note, settledLegsFromPrice(note, 64_000));

    expect(settlement.grossPayoutBaseUnits).toBe(4_943_865n);
    expect(settlement.performanceFeeBaseUnits).toBe(0n);
    expect(settlement.netPayoutBaseUnits).toBe(4_943_865n);
    expect(settlement.realizedLegs).toEqual([]);
  });

  it('only includes legs realized below the final settlement price', () => {
    const settlement = calculateSettlement(noteFixture(), settledLegsFromPrice(noteFixture(), 61_000));

    expect(settlement.grossPayoutBaseUnits).toBe(950_000_000n);
    expect(settlement.performanceFeeBaseUnits).toBe(0n);
    expect(settlement.netPayoutBaseUnits).toBe(950_000_000n);
    expect(settlement.realizedLegs.map((leg) => leg.legId)).toEqual(['up-60000']);
  });

  it('caps the all-realized payout at principal plus coupon and charges fee only on yield', () => {
    const settlement = calculateSettlement(noteFixture(), settledLegsFromPrice(noteFixture(), 63_000));

    expect(settlement.grossPayoutBaseUnits).toBe(1_010_000_000n);
    expect(settlement.performanceFeeBaseUnits).toBe(1_000_000n);
    expect(settlement.netPayoutBaseUnits).toBe(1_009_000_000n);
    expect(settlement.realizedLegs.map((leg) => leg.legId)).toEqual(['up-60000', 'up-62000']);
  });

  it('calculates fee from a refreshed manager balance after positions are redeemed', () => {
    const settlement = calculateSettlementFromGrossPayout(noteFixture(), 1_010_000_000n);

    expect(settlement.grossPayoutBaseUnits).toBe(1_010_000_000n);
    expect(settlement.performanceFeeBaseUnits).toBe(1_000_000n);
    expect(settlement.netPayoutBaseUnits).toBe(1_009_000_000n);
    expect(settlement.realizedLegs).toEqual([]);
  });

  it('rejects invalid fee bps instead of silently clamping to zero', () => {
    expect(() => calculateSettlement(noteFixture({ feeBps: -1 }), settledLegsFromPrice(noteFixture(), 63_000))).toThrow(
      'Settlement fee bps must be a non-negative finite number',
    );
    expect(() => calculateSettlementFromGrossPayout(noteFixture({ feeBps: Number.NaN }), 1_010_000_000n)).toThrow(
      'Settlement fee bps must be a non-negative finite number',
    );
  });

  it('summarizes the possible payout range from reserve, coupon, and all note legs', () => {
    expect(settlementPayoutRange(noteFixture())).toEqual({
      minGrossPayoutBaseUnits: 910_000_000n,
      maxGrossPayoutBaseUnits: 1_010_000_000n,
    });
  });
});
