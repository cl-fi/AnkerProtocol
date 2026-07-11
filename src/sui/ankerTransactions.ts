import { Transaction } from '@mysten/sui/transactions';
import { isDemoMode } from '../config/runtimeModes';
import type { SettlementResult } from '../products/settlement';
import type { AnkerProductNoteRecord } from './ankerPortfolio';
import {
  addRedeemDualInvestmentPositionCommands,
  addWithdrawAndRecordClaimCommands,
  dualInvestmentNoteLegs,
} from './ankerTransactionPrimitives';
import { DEFAULT_ANKER_CONFIG, type AnkerProtocolConfig } from './ankerProtocolConfig';

export {
  MINT_SLIPPAGE_BPS,
  U64_MAX,
  LEVERAGE_1X,
  applyMintSlippage,
  subscribeTopUpBaseUnits,
} from './ankerTransactionPrimitives';

export {
  DEFAULT_ANKER_CONFIG,
  type AnkerProtocolConfig,
  type AnkerProtocolFeeds,
} from './ankerProtocolConfig';

export {
  buildSubscribeDualInvestmentTransaction,
  type MintLegSlippage,
  type SubscribeDualInvestmentTransactionPlan,
} from './subscribeTransactions';

export interface RedeemDualInvestmentTransactionPlan {
  tx: Transaction;
  calls: string[];
  feeAmount: bigint;
  payoutAmount: bigint;
  netPayoutAmount: bigint;
  claimMode?: DualInvestmentClaimMode;
}

export type DualInvestmentClaimMode = 'redeem-and-withdraw' | 'redeem-positions' | 'withdraw-only';

function assertTransactionsEnabled() {
  if (isDemoMode()) {
    throw new Error('Demo mode: on-chain transactions are temporarily disabled.');
  }
}

export function buildRedeemDualInvestmentNoteTransaction(input: {
  accountAddress: string;
  note: AnkerProductNoteRecord;
  config?: AnkerProtocolConfig;
}): RedeemDualInvestmentTransactionPlan {
  if (input.note.productType !== 'dual-investment') {
    throw new Error('Expected a Dual Investment product note.');
  }
  if (input.note.status !== 'open') {
    throw new Error('Product note is already redeemed.');
  }

  return buildRedeemDualInvestmentPositionsTransaction({
    accountAddress: input.accountAddress,
    note: input.note,
    config: input.config,
  });
}

export function buildRedeemDualInvestmentPositionsTransaction(input: {
  accountAddress: string;
  note: AnkerProductNoteRecord;
  config?: AnkerProtocolConfig;
}): RedeemDualInvestmentTransactionPlan {
  assertTransactionsEnabled();
  if (input.note.productType !== 'dual-investment') {
    throw new Error('Expected a Dual Investment product note.');
  }
  if (input.note.status !== 'open') {
    throw new Error('Product note is already redeemed.');
  }

  const config = input.config ?? DEFAULT_ANKER_CONFIG;
  const tx = new Transaction();
  tx.setSender(input.accountAddress);
  const calls: string[] = [];

  addRedeemDualInvestmentPositionCommands({
    tx,
    calls,
    managerId: input.note.wrapperId,
    oracleId: input.note.oracleId,
    legs: dualInvestmentNoteLegs(input.note),
    legQuantitiesBaseUnits: input.note.legs.map((leg) => leg.quantityBaseUnits),
    config,
  });

  return {
    tx,
    calls,
    feeAmount: 0n,
    payoutAmount: 0n,
    netPayoutAmount: 0n,
    claimMode: 'redeem-positions',
  };
}

export function buildClaimDualInvestmentNoteTransaction(input: {
  accountAddress: string;
  note: AnkerProductNoteRecord;
  settlement: SettlementResult;
  config?: AnkerProtocolConfig;
}): RedeemDualInvestmentTransactionPlan {
  assertTransactionsEnabled();
  if (input.note.productType !== 'dual-investment') {
    throw new Error('Expected a Dual Investment product note.');
  }
  if (input.note.status !== 'open') {
    throw new Error('Product note is already redeemed.');
  }

  const config = input.config ?? DEFAULT_ANKER_CONFIG;
  const tx = new Transaction();
  tx.setSender(input.accountAddress);
  const calls: string[] = [];
  const feeAmount = input.settlement.performanceFeeBaseUnits;
  const payoutAmount = input.settlement.grossPayoutBaseUnits;

  const { netPayoutAmount } = addWithdrawAndRecordClaimCommands({
    tx,
    calls,
    accountAddress: input.accountAddress,
    managerId: input.note.wrapperId,
    noteId: input.note.noteId,
    feeAmount,
    payoutAmount,
    config,
  });

  return {
    tx,
    calls,
    feeAmount,
    payoutAmount,
    netPayoutAmount,
    claimMode: 'withdraw-only',
  };
}
