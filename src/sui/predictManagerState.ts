import type { AnkerProductNoteRecord } from './ankerPortfolio';

export interface PredictManagerPosition {
  oracleId: string;
  expiryMs: number;
  strike: number;
  isUp: boolean;
  quantity: number;
  quantityBaseUnits?: string;
}

export interface PredictManagerState {
  managerId: string;
  dusdcBalance: number | null;
  dusdcBalanceBaseUnits?: string | null;
  positions: PredictManagerPosition[];
  generatedAt: number;
}

export type DualInvestmentClaimPath =
  | 'redeem-and-withdraw'
  | 'withdraw-only'
  | 'partial-unavailable'
  | 'unknown'
  | 'already-claimed'
  | 'unsupported';

export interface DualInvestmentClaimState {
  path: DualInvestmentClaimPath;
  availableLegCount: number;
  missingLegCount: number;
  totalLegCount: number;
  managerDusdcBalance: number | null;
  missingLegs: DualInvestmentMissingLeg[];
}

export interface DualInvestmentMissingLeg {
  strike: number;
  requiredQuantity: number;
  availableQuantity: number;
}

export type ProductNoteLifecycle =
  | 'active'
  | 'matured'
  | 'positions-redeemable'
  | 'claimable'
  | 'settlement-blocked'
  | 'settled'
  | 'unsupported';

export interface DualInvestmentBackingProof {
  managerId: string;
  managerIsolation: 'isolated' | 'shared' | 'unknown';
  notesUsingManager: number | null;
  requiredLegCount: number;
  availableLegCount: number;
  missingLegCount: number;
  requiredPositionQuantity: number;
  availablePositionQuantity: number;
  collateralizationRatio: number | null;
  managerDusdcBalance: number | null;
}

const DUSDC_EPSILON = 0.0000005;

function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function sameStrike(left: number, right: number) {
  return Math.abs(left - right) < 0.000001;
}

function matchingPosition(note: AnkerProductNoteRecord, strike: number, state: PredictManagerState) {
  return state.positions.find(
    (position) =>
      sameAddress(position.oracleId, note.oracleId) &&
      position.expiryMs === note.expiryMs &&
      position.isUp &&
      sameStrike(position.strike, strike),
  );
}

function availableQuantityForLeg(note: AnkerProductNoteRecord, leg: AnkerProductNoteRecord['legs'][number], state: PredictManagerState) {
  const position = matchingPosition(note, leg.strike, state);
  return Math.min(position?.quantity ?? 0, leg.quantity);
}

function missingLegsForNote(note: AnkerProductNoteRecord, state?: PredictManagerState): DualInvestmentMissingLeg[] {
  return note.legs.flatMap((leg) => {
    const availableQuantity = state ? availableQuantityForLeg(note, leg, state) : 0;
    if (availableQuantity + DUSDC_EPSILON >= leg.quantity) return [];
    return [
      {
        strike: leg.strike,
        requiredQuantity: leg.quantity,
        availableQuantity,
      },
    ];
  });
}

export function claimStateForDualInvestmentNote(
  note: AnkerProductNoteRecord,
  state?: PredictManagerState,
): DualInvestmentClaimState {
  const totalLegCount = note.legs.length;

  if (note.productType !== 'dual-investment') {
    return {
      path: 'unsupported',
      availableLegCount: 0,
      missingLegCount: totalLegCount,
      totalLegCount,
      managerDusdcBalance: state?.dusdcBalance ?? null,
      missingLegs: [],
    };
  }

  if (note.status === 'redeemed') {
    return {
      path: 'already-claimed',
      availableLegCount: 0,
      missingLegCount: 0,
      totalLegCount,
      managerDusdcBalance: state?.dusdcBalance ?? null,
      missingLegs: [],
    };
  }

  if (!state) {
    const missingLegs = missingLegsForNote(note);
    return {
      path: 'unknown',
      availableLegCount: 0,
      missingLegCount: missingLegs.length,
      totalLegCount,
      managerDusdcBalance: null,
      missingLegs,
    };
  }

  const missingLegs = missingLegsForNote(note, state);
  const missingLegCount = missingLegs.length;
  const availableLegCount = totalLegCount - missingLegCount;

  if (availableLegCount === totalLegCount) {
    return {
      path: 'redeem-and-withdraw',
      availableLegCount,
      missingLegCount,
      totalLegCount,
      managerDusdcBalance: state.dusdcBalance,
      missingLegs,
    };
  }

  if (availableLegCount === 0) {
    return {
      path: 'withdraw-only',
      availableLegCount,
      missingLegCount,
      totalLegCount,
      managerDusdcBalance: state.dusdcBalance,
      missingLegs,
    };
  }

  return {
    path: 'partial-unavailable',
    availableLegCount,
    missingLegCount,
    totalLegCount,
    managerDusdcBalance: state.dusdcBalance,
    missingLegs,
  };
}

export function lifecycleForProductNote(
  note: AnkerProductNoteRecord,
  claimState: DualInvestmentClaimState,
  nowMs: number,
): ProductNoteLifecycle {
  if (note.productType !== 'dual-investment') return 'unsupported';
  if (note.status === 'redeemed') return 'settled';
  if (claimState.path === 'partial-unavailable') return 'settlement-blocked';
  if (nowMs < note.expiryMs) return 'active';
  if (claimState.path === 'redeem-and-withdraw') return 'positions-redeemable';
  if (claimState.path === 'withdraw-only') return 'claimable';
  return 'matured';
}

export function backingProofForDualInvestmentNote(
  note: AnkerProductNoteRecord,
  state: PredictManagerState | undefined,
  notes: readonly Pick<AnkerProductNoteRecord, 'managerId'>[] | undefined,
): DualInvestmentBackingProof {
  const requiredPositionQuantity = note.legs.reduce((sum, leg) => sum + leg.quantity, 0);
  const notesUsingManager = notes
    ? notes.filter((candidate) => sameAddress(candidate.managerId, note.managerId)).length
    : null;
  const managerIsolation =
    notesUsingManager === null ? 'unknown' : notesUsingManager <= 1 ? 'isolated' : 'shared';

  if (!state) {
    return {
      managerId: note.managerId,
      managerIsolation,
      notesUsingManager,
      requiredLegCount: note.legs.length,
      availableLegCount: 0,
      missingLegCount: note.legs.length,
      requiredPositionQuantity,
      availablePositionQuantity: 0,
      collateralizationRatio: null,
      managerDusdcBalance: null,
    };
  }

  const availablePositionQuantity = note.legs.reduce(
    (sum, leg) => sum + availableQuantityForLeg(note, leg, state),
    0,
  );
  const claimState = claimStateForDualInvestmentNote(note, state);

  return {
    managerId: note.managerId,
    managerIsolation,
    notesUsingManager,
    requiredLegCount: note.legs.length,
    availableLegCount: claimState.availableLegCount,
    missingLegCount: claimState.missingLegCount,
    requiredPositionQuantity,
    availablePositionQuantity,
    collateralizationRatio:
      requiredPositionQuantity > 0 ? Math.min(1, availablePositionQuantity / requiredPositionQuantity) : 1,
    managerDusdcBalance: state.dusdcBalance,
  };
}
