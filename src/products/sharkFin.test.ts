import { describe, expect, it } from 'vitest';
import { lastKnownMarketSnapshot } from '../deepbook/fixtures';
import {
  buildSharkFinLegIntents,
  calculateSharkFinBudget,
  compileSharkFin,
  getSharkFinAprAtSettlement,
} from './sharkFin';
import type { SharkFinInput } from './types';

const sevenDaysMs = 7 * 86_400_000;
const nowMs = lastKnownMarketSnapshot.expiryMs - sevenDaysMs;

function baseInput(overrides: Partial<SharkFinInput> = {}): SharkFinInput {
  return {
    principal: 1_000,
    direction: 'bullish',
    currentApr: 0.08,
    baseApr: 0.02,
    lowerBound: 70_000,
    upperBound: 80_000,
    targetLegCount: 4,
    ...overrides,
  };
}

describe('Shark Fin product math', () => {
  it('keeps bullish APR flat below lower, linear inside range, and capped above upper', () => {
    const input = baseInput({ direction: 'bullish' });
    const maxApr = 0.14;

    expect(getSharkFinAprAtSettlement(input, maxApr, 69_000)).toBeCloseTo(0.02);
    expect(getSharkFinAprAtSettlement(input, maxApr, 75_000)).toBeCloseTo(0.08);
    expect(getSharkFinAprAtSettlement(input, maxApr, 81_000)).toBeCloseTo(0.14);
  });

  it('keeps bearish APR flat above upper, linear inside range, and capped below lower', () => {
    const input = baseInput({ direction: 'bearish' });
    const maxApr = 0.14;

    expect(getSharkFinAprAtSettlement(input, maxApr, 81_000)).toBeCloseTo(0.02);
    expect(getSharkFinAprAtSettlement(input, maxApr, 75_000)).toBeCloseTo(0.08);
    expect(getSharkFinAprAtSettlement(input, maxApr, 69_000)).toBeCloseTo(0.14);
  });

  it('builds bullish Shark Fin only from UP legs', () => {
    const legs = buildSharkFinLegIntents(baseInput({ direction: 'bullish' }), lastKnownMarketSnapshot);

    expect(legs).toHaveLength(4);
    expect(legs.map((leg) => leg.instrumentType)).toEqual([
      'binary-up',
      'binary-up',
      'binary-up',
      'binary-up',
    ]);
    expect(legs.every((leg) => leg.isUp === true)).toBe(true);
    expect(legs.map((leg) => leg.strike)).toEqual([70_000, 72_500, 75_000, 77_500]);
  });

  it('builds bearish Shark Fin only from DOWN legs', () => {
    const legs = buildSharkFinLegIntents(baseInput({ direction: 'bearish' }), lastKnownMarketSnapshot);

    expect(legs).toHaveLength(4);
    expect(legs.map((leg) => leg.instrumentType)).toEqual([
      'binary-down',
      'binary-down',
      'binary-down',
      'binary-down',
    ]);
    expect(legs.every((leg) => leg.isUp === false)).toBe(true);
    expect(legs.map((leg) => leg.strike)).toEqual([80_000, 77_500, 75_000, 72_500]);
  });

  it('funds option budget from Current yield after reserving the base coupon', () => {
    const budget = calculateSharkFinBudget(baseInput(), lastKnownMarketSnapshot, nowMs);

    expect(budget.termDays).toBeCloseTo(7);
    expect(budget.projectedCurrentYield).toBeCloseTo(1_000 * 0.08 * (7 / 365));
    expect(budget.baseCoupon).toBeCloseTo(1_000 * 0.02 * (7 / 365));
    expect(budget.optionBudget).toBeCloseTo(1_000 * (0.08 - 0.02) * (7 / 365));
  });

  it('is not executable when Current yield cannot fund options and keeps max APR at base APR', () => {
    const quote = compileSharkFin({
      input: baseInput({ currentApr: 0.01, baseApr: 0.02 }),
      oracle: lastKnownMarketSnapshot,
      quotedLegs: [{ askCost: 0, askPrice: 0, redeemPreview: 0, executable: true, quoteTimestampMs: nowMs }],
      nowMs,
    });

    expect(quote.executable).toBe(false);
    expect(quote.sharkFin?.optionBudget).toBeLessThanOrEqual(0);
    expect(quote.sharkFin?.maxApr).toBeCloseTo(0.02);
  });
});
