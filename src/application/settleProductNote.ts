import {
  calculateSettlement,
  settledLegsFromPrice,
  type DualInvestmentSettlementNote,
  type SettledLeg,
} from '../products/settlement';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';

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

export function settlementForProductNote(note: AnkerProductNoteRecord, settlementPrice: number) {
  const settlementNote = settlementNoteForProductNote(note);
  return calculateSettlement(settlementNote, settledLegsFromPrice(settlementNote, settlementPrice));
}
