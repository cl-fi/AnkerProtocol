import { describe, expect, it } from 'vitest';
import type { AnkerProductNoteRecord } from './ankerPortfolio';
import {
  backingProofForDualInvestmentNote,
  claimStateForDualInvestmentNote,
  lifecycleForProductNote,
  type PredictManagerState,
} from './predictManagerState';

const MANAGER_ID = `0x${'b'.repeat(64)}`;
const ORACLE_ID = `0x${'5'.repeat(64)}`;

function noteFixture(overrides: Partial<AnkerProductNoteRecord> = {}): AnkerProductNoteRecord {
  return {
    noteId: `0x${'c'.repeat(64)}`,
    productType: 'dual-investment',
    productId: 'target-buy-5',
    owner: `0x${'a'.repeat(64)}`,
    wrapperId: MANAGER_ID,
    oracleId: ORACLE_ID,
    expiryMs: 1_781_683_200_000,
    principal: 5,
    principalBaseUnits: 5_000_000n,
    reserve: 4.936412,
    reserveBaseUnits: 4_936_412n,
    coupon: 0.007453,
    couponBaseUnits: 7_453n,
    targetPrice: 65_500,
    floorPrice: 64_667,
    lowerBound: 0,
    upperBound: 0,
    isBullish: false,
    usesMockCurrentDeposit: false,
    apr: 0.916,
    feeBps: 1_000,
    legs: [
      { strike: 64_667, quantity: 0.063588, quantityBaseUnits: 63_588n, cost: 0.056135, costBaseUnits: 56_135n },
      { strike: 65_000, quantity: 0.012345, quantityBaseUnits: 12_345n, cost: 0.01, costBaseUnits: 10_000n },
    ],
    orderIds: [11n, 22n],
    status: 'open',
    redeemedPayout: 0,
    redeemedPayoutBaseUnits: 0n,
    redeemedFee: 0,
    redeemedFeeBaseUnits: 0n,
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
      missingLegs: [
        {
          strike: 65_000,
          requiredQuantity: 0.012345,
          availableQuantity: 0,
        },
      ],
    });
  });

  it('reports unknown until manager positions are loaded', () => {
    expect(claimStateForDualInvestmentNote(noteFixture(), undefined)).toMatchObject({
      path: 'unknown',
    });
  });
});

describe('lifecycleForProductNote', () => {
  it('uses explicit lifecycle states for the claim path', () => {
    const note = noteFixture();

    expect(
      lifecycleForProductNote(note, claimStateForDualInvestmentNote(note, managerState([0.063588, 0.012345])), 1),
    ).toBe('active');
    expect(
      lifecycleForProductNote(
        note,
        claimStateForDualInvestmentNote(note, managerState([0.063588, 0.012345])),
        note.expiryMs,
      ),
    ).toBe('positions-redeemable');
    expect(lifecycleForProductNote(note, claimStateForDualInvestmentNote(note, managerState([0, 0])), note.expiryMs)).toBe(
      'claimable',
    );
    expect(
      lifecycleForProductNote(note, claimStateForDualInvestmentNote(note, managerState([0.063588, 0])), note.expiryMs),
    ).toBe('settlement-blocked');
    expect(
      lifecycleForProductNote(
        noteFixture({ status: 'redeemed' }),
        claimStateForDualInvestmentNote(noteFixture({ status: 'redeemed' }), managerState([0, 0])),
        note.expiryMs,
      ),
    ).toBe('settled');
  });
});

describe('backingProofForDualInvestmentNote', () => {
  it('reports position collateralization and isolated manager ownership', () => {
    const note = noteFixture();
    const proof = backingProofForDualInvestmentNote(note, managerState([0.063588, 0]), [note]);

    expect(proof).toMatchObject({
      managerId: MANAGER_ID,
      managerIsolation: 'isolated',
      notesUsingManager: 1,
      requiredLegCount: 2,
      availableLegCount: 1,
      missingLegCount: 1,
      managerDusdcBalance: 9.664158,
    });
    expect(proof.requiredPositionQuantity).toBeCloseTo(0.075933);
    expect(proof.availablePositionQuantity).toBeCloseTo(0.063588);
    expect(proof.collateralizationRatio).toBeCloseTo(0.8374, 4);
  });

  it('flags shared managers across multiple notes', () => {
    const note = noteFixture();
    const secondNote = noteFixture({ noteId: `0x${'d'.repeat(64)}` });

    const proof = backingProofForDualInvestmentNote(note, managerState([0.063588, 0.012345]), [note, secondNote]);

    expect(proof.managerIsolation).toBe('shared');
    expect(proof.notesUsingManager).toBe(2);
    expect(proof.collateralizationRatio).toBe(1);
  });
});
