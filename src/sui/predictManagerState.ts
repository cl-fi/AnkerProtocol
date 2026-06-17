import type { AnkerProductNoteRecord } from './ankerPortfolio';

export interface PredictManagerPosition {
  oracleId: string;
  expiryMs: number;
  strike: number;
  isUp: boolean;
  quantity: number;
}

export interface PredictManagerState {
  managerId: string;
  dusdcBalance: number | null;
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
    };
  }

  if (note.status === 'redeemed') {
    return {
      path: 'already-claimed',
      availableLegCount: 0,
      missingLegCount: 0,
      totalLegCount,
      managerDusdcBalance: state?.dusdcBalance ?? null,
    };
  }

  if (!state) {
    return {
      path: 'unknown',
      availableLegCount: 0,
      missingLegCount: totalLegCount,
      totalLegCount,
      managerDusdcBalance: null,
    };
  }

  const availableLegCount = note.legs.filter((leg) => {
    const position = matchingPosition(note, leg.strike, state);
    return (position?.quantity ?? 0) + DUSDC_EPSILON >= leg.quantity;
  }).length;
  const missingLegCount = totalLegCount - availableLegCount;

  if (availableLegCount === totalLegCount) {
    return {
      path: 'redeem-and-withdraw',
      availableLegCount,
      missingLegCount,
      totalLegCount,
      managerDusdcBalance: state.dusdcBalance,
    };
  }

  if (availableLegCount === 0) {
    return {
      path: 'withdraw-only',
      availableLegCount,
      missingLegCount,
      totalLegCount,
      managerDusdcBalance: state.dusdcBalance,
    };
  }

  return {
    path: 'partial-unavailable',
    availableLegCount,
    missingLegCount,
    totalLegCount,
    managerDusdcBalance: state.dusdcBalance,
  };
}
