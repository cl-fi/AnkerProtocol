import { coinWithBalance, Transaction } from '@mysten/sui/transactions';
import { ANKER_PROTOCOL } from '../config/anker';
import { DEEPBOOK_PREDICT, SUI_NETWORK } from '../config/deepbook';
import { isDemoMode } from '../config/runtimeModes';
import { assertQuoteEnvelope, type QuoteEnvelope } from '../products/quoteEnvelope';
import type { SettlementResult } from '../products/settlement';
import type { DualInvestmentInput, StructuredProductQuote } from '../products/types';
import type { AnkerProductNoteRecord } from './ankerPortfolio';
import {
  addMarketKey,
  addRedeemDualInvestmentPositionCommands,
  addWithdrawAndRecordClaimCommands,
  assertDualInvestmentQuote,
  assertQuoteMatchesConfig,
  dualInvestmentNoteLegs,
  legCostToBaseUnits,
  legQuantityToBaseUnits,
  predictTarget,
  productIdBytes,
  target,
  toBpsU64,
  toChainPriceU64,
  toQuoteBaseUnits,
} from './ankerTransactionPrimitives';

export interface AnkerProtocolConfig {
  network?: string;
  packageId: string;
  registryId: string;
  predictPackageId: string;
  /** 6-24 PoolVault shared object (replaces the 4-16 Predict object id). */
  poolVaultId: string;
  quoteAssetType: string;
  quoteAssetDecimals: number;
}

export interface CreateManagerTransactionPlan {
  tx: Transaction;
  calls: string[];
}

export interface SubscribeDualInvestmentTransactionPlan {
  tx: Transaction;
  calls: string[];
  depositAmount: bigint;
  legStrikes: bigint[];
  legQuantities: bigint[];
  legCosts: bigint[];
  targetPrice: bigint;
  floorPrice: bigint;
  productIdBytes: number[];
}

export interface RedeemDualInvestmentTransactionPlan {
  tx: Transaction;
  calls: string[];
  feeAmount: bigint;
  payoutAmount: bigint;
  netPayoutAmount: bigint;
  claimMode?: DualInvestmentClaimMode;
}

export type DualInvestmentClaimMode = 'redeem-and-withdraw' | 'redeem-positions' | 'withdraw-only';

export const DEFAULT_ANKER_CONFIG: AnkerProtocolConfig = {
  network: SUI_NETWORK,
  packageId: ANKER_PROTOCOL.packageId,
  registryId: ANKER_PROTOCOL.registryId,
  predictPackageId: DEEPBOOK_PREDICT.packageId,
  poolVaultId: DEEPBOOK_PREDICT.poolVaultId,
  quoteAssetType: DEEPBOOK_PREDICT.quoteAssetType,
  quoteAssetDecimals: DEEPBOOK_PREDICT.quoteAssetDecimals,
};

// Backstop for demo mode: the UI disables every transaction entry point, but no
// transaction plan may be built even if a path is missed.
function assertTransactionsEnabled() {
  if (isDemoMode()) {
    throw new Error('Demo mode: on-chain transactions are temporarily disabled.');
  }
}

export function buildCreatePredictManagerTransaction(input: {
  config?: AnkerProtocolConfig;
} = {}): CreateManagerTransactionPlan {
  assertTransactionsEnabled();
  const config = input.config ?? DEFAULT_ANKER_CONFIG;
  const tx = new Transaction();
  const calls: string[] = [];
  const callTarget = predictTarget(config, 'predict', 'create_manager');
  calls.push(callTarget);
  tx.moveCall({ target: callTarget, arguments: [] });
  return { tx, calls };
}

export function buildSubscribeDualInvestmentTransaction(input: {
  accountAddress: string;
  managerId: string;
  productInput: DualInvestmentInput;
  quote: StructuredProductQuote;
  quoteEnvelope: QuoteEnvelope;
  nowMs?: number;
  config?: AnkerProtocolConfig;
}): SubscribeDualInvestmentTransactionPlan {
  assertTransactionsEnabled();
  const config = input.config ?? DEFAULT_ANKER_CONFIG;
  assertDualInvestmentQuote(input.quote);
  assertQuoteMatchesConfig(input.quote, config);
  assertQuoteEnvelope({
    quote: input.quote,
    envelope: input.quoteEnvelope,
    network: config.network ?? 'testnet',
    quoteAssetDecimals: config.quoteAssetDecimals,
    nowMs: input.nowMs ?? Date.now(),
  });

  const tx = new Transaction();
  tx.setSender(input.accountAddress);
  const calls: string[] = [];
  const depositAmount = toQuoteBaseUnits(input.quote.principal, config.quoteAssetDecimals, 'Quote principal');
  const legStrikes = input.quote.legs.map((leg) => toChainPriceU64(leg.strike ?? 0, `Quote leg ${leg.id} strike`));
  const legQuantities = input.quote.legs.map((leg) => legQuantityToBaseUnits(leg, config));
  const legCosts = input.quote.legs.map((leg) => legCostToBaseUnits(leg, config));
  const targetPrice = toChainPriceU64(input.productInput.targetPrice, 'Target price');
  const floorPrice = toChainPriceU64(input.productInput.floorPrice, 'Floor price');
  const idBytes = productIdBytes(input.quoteEnvelope.productHash);
  const manager = tx.object(input.managerId);
  const predict = tx.object(config.poolVaultId);
  const oracle = tx.object(input.quote.oracle.oracleId);

  const depositTarget = predictTarget(config, 'predict_manager', 'deposit');
  calls.push(depositTarget);
  const depositCoin = coinWithBalance({
    balance: depositAmount,
    type: config.quoteAssetType,
  });
  tx.moveCall({
    target: depositTarget,
    typeArguments: [config.quoteAssetType],
    arguments: [manager, depositCoin],
  });

  input.quote.legs.forEach((leg, index) => {
    const key = addMarketKey(tx, leg, config, calls);
    const mintTarget = predictTarget(config, 'predict', 'mint');
    calls.push(mintTarget);
    tx.moveCall({
      target: mintTarget,
      typeArguments: [config.quoteAssetType],
      arguments: [
        predict,
        manager,
        oracle,
        key,
        tx.pure.u64(legQuantities[index]),
        tx.object.clock(),
      ],
    });
  });

  const noteTarget = target(config, 'product_note', 'new_dual_investment_note');
  calls.push(noteTarget);
  const note = tx.moveCall({
    target: noteTarget,
    arguments: [
      tx.object(config.registryId),
      tx.pure.vector('u8', idBytes),
      tx.pure.id(input.managerId),
      tx.pure.id(input.quote.oracle.oracleId),
      tx.pure.u64(input.quote.oracle.expiryMs),
      tx.pure.u64(depositAmount),
      tx.pure.u64(toQuoteBaseUnits(input.quote.reserve, config.quoteAssetDecimals, 'Quote reserve')),
      tx.pure.u64(toQuoteBaseUnits(input.quote.coupon, config.quoteAssetDecimals, 'Quote coupon')),
      tx.pure.u64(targetPrice),
      tx.pure.u64(floorPrice),
      tx.pure.u64(toBpsU64(input.quote.apr, 'Quote APR')),
      tx.pure.vector('u64', legStrikes),
      tx.pure.vector('u64', legQuantities),
      tx.pure.vector('u64', legCosts),
    ],
  });
  calls.push('transferObjects');
  tx.transferObjects([note], input.accountAddress);

  return {
    tx,
    calls,
    depositAmount,
    legStrikes,
    legQuantities,
    legCosts,
    targetPrice,
    floorPrice,
    productIdBytes: idBytes,
  };
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
    managerId: input.note.managerId,
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
    managerId: input.note.managerId,
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
