import {
  calculateSettlement,
  calculateSettlementFromGrossPayout,
  type DualInvestmentSettlementNote,
  type SettlementResult,
  type SettledLeg,
} from '../products/settlement';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import {
  buildClaimDualInvestmentNoteTransaction,
  buildRedeemDualInvestmentPositionsTransaction,
  type AnkerProtocolConfig,
  type RedeemDualInvestmentTransactionPlan,
} from '../sui/ankerTransactions';
import type { DualInvestmentClaimState } from '../sui/predictManagerState';

function toBaseUnits(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Manager DUSDC balance must be a non-negative finite number.');
  }
  const rounded = Math.round(value * 1_000_000);
  if (!Number.isSafeInteger(rounded)) {
    throw new Error('Manager DUSDC balance exceeds safe integer range.');
  }
  return BigInt(rounded);
}

export function settlementNoteForProductNote(note: AnkerProductNoteRecord): DualInvestmentSettlementNote {
  return {
    principalBaseUnits: note.principalBaseUnits,
    reserveBaseUnits: note.reserveBaseUnits,
    couponBaseUnits: note.couponBaseUnits,
    feeBps: note.feeBps,
    legs: note.legs.map((leg) => ({
      legId: `up-${leg.strike}`,
      strike: leg.strike,
      isUp: true,
      quantityBaseUnits: leg.quantityBaseUnits,
    })),
  };
}

export function settlementEstimateForNote(note: AnkerProductNoteRecord, settledLegs: readonly SettledLeg[] = []) {
  return calculateSettlement(settlementNoteForProductNote(note), settledLegs);
}

export function settlementFromManagerBalance(
  note: AnkerProductNoteRecord,
  managerDusdcBalance: number,
): SettlementResult {
  return calculateSettlementFromGrossPayout(settlementNoteForProductNote(note), toBaseUnits(managerDusdcBalance));
}

export function buildDualInvestmentClaimApplicationPlan(input: {
  accountAddress: string;
  note: AnkerProductNoteRecord;
  claimState: DualInvestmentClaimState;
  config?: AnkerProtocolConfig;
}): RedeemDualInvestmentTransactionPlan {
  if (input.claimState.path === 'redeem-and-withdraw') {
    return buildRedeemDualInvestmentPositionsTransaction({
      accountAddress: input.accountAddress,
      note: input.note,
      config: input.config,
    });
  }

  if (input.claimState.path === 'withdraw-only') {
    if (input.claimState.managerDusdcBalance === null) {
      throw new Error('Product container DUSDC balance is unavailable.');
    }
    return buildClaimDualInvestmentNoteTransaction({
      accountAddress: input.accountAddress,
      note: input.note,
      settlement: settlementFromManagerBalance(input.note, input.claimState.managerDusdcBalance),
      config: input.config,
    });
  }

  throw new Error('Product note is not ready to claim.');
}
