import { describe, expect, it } from 'vitest';
import type { AnkerProductNoteRecord } from './ankerPortfolio';
import { claimStateForDualInvestmentNote, type PredictManagerState } from './predictManagerState';

const MANAGER_ID = `0x${'b'.repeat(64)}`;
const ORACLE_ID = `0x${'5'.repeat(64)}`;

function noteFixture(overrides: Partial<AnkerProductNoteRecord> = {}): AnkerProductNoteRecord {
  return {
    noteId: `0x${'c'.repeat(64)}`,
    productType: 'dual-investment',
    productId: 'target-buy-5',
    owner: `0x${'a'.repeat(64)}`,
    managerId: MANAGER_ID,
    oracleId: ORACLE_ID,
    expiryMs: 1_781_683_200_000,
    principal: 5,
    reserve: 4.936412,
    coupon: 0.007453,
    targetPrice: 65_500,
    floorPrice: 64_667,
    lowerBound: 0,
    upperBound: 0,
    isBullish: false,
    usesMockCurrentDeposit: false,
    apr: 0.916,
    feeBps: 1_000,
    legs: [
      { strike: 64_667, quantity: 0.063588, cost: 0.056135 },
      { strike: 65_000, quantity: 0.012345, cost: 0.01 },
    ],
    status: 'open',
    redeemedPayout: 0,
    redeemedFee: 0,
    ...overrides,
  };
}

function managerState(quantities: number[]): PredictManagerState {
  return {
    managerId: MANAGER_ID,
    dusdcBalance: 9.664158,
    positions: quantities.map((quantity, index) => ({
      oracleId: ORACLE_ID,
      expiryMs: 1_781_683_200_000,
      strike: index === 0 ? 64_667 : 65_000,
      isUp: true,
      quantity,
    })),
    generatedAt: 1,
  };
}

describe('claimStateForDualInvestmentNote', () => {
  it('uses redeem-and-withdraw when every note leg is still held by the Predict manager', () => {
    expect(claimStateForDualInvestmentNote(noteFixture(), managerState([0.063588, 0.012345]))).toMatchObject({
      path: 'redeem-and-withdraw',
      availableLegCount: 2,
      missingLegCount: 0,
    });
  });

  it('uses withdraw-only when every note leg was already redeemed permissionlessly', () => {
    expect(claimStateForDualInvestmentNote(noteFixture(), managerState([0, 0]))).toMatchObject({
      path: 'withdraw-only',
      availableLegCount: 0,
      missingLegCount: 2,
    });
  });

  it('blocks claim when some legs are present and some are missing', () => {
    expect(claimStateForDualInvestmentNote(noteFixture(), managerState([0.063588, 0]))).toMatchObject({
      path: 'partial-unavailable',
      availableLegCount: 1,
      missingLegCount: 1,
    });
  });

  it('reports unknown until manager positions are loaded', () => {
    expect(claimStateForDualInvestmentNote(noteFixture(), undefined)).toMatchObject({
      path: 'unknown',
    });
  });
});
