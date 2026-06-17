import { coinWithBalance, Transaction } from '@mysten/sui/transactions';
import { ANKER_PROTOCOL } from '../config/anker';
import { DEEPBOOK_PREDICT } from '../config/deepbook';
import type { DualInvestmentInput, LegQuote, StructuredProductQuote } from '../products/types';
import { toChainPrice } from '../products/units';
import type { AnkerProductNoteRecord } from './ankerPortfolio';

export interface AnkerProtocolConfig {
  packageId: string;
  registryId: string;
  predictPackageId: string;
  predictObjectId: string;
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

export interface SubscribeSharkFinTransactionPlan {
  tx: Transaction;
  calls: string[];
  depositAmount: bigint;
  principalAmount: bigint;
  baseCouponAmount: bigint;
  currentYieldAmount: bigint;
  legStrikes: bigint[];
  legQuantities: bigint[];
  legCosts: bigint[];
  lowerBound: bigint;
  upperBound: bigint;
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

export type DualInvestmentClaimMode = 'redeem-and-withdraw' | 'withdraw-only';

export const DEFAULT_ANKER_CONFIG: AnkerProtocolConfig = {
  packageId: ANKER_PROTOCOL.packageId,
  registryId: ANKER_PROTOCOL.registryId,
  predictPackageId: DEEPBOOK_PREDICT.packageId,
  predictObjectId: DEEPBOOK_PREDICT.predictObjectId,
  quoteAssetType: DEEPBOOK_PREDICT.quoteAssetType,
  quoteAssetDecimals: DEEPBOOK_PREDICT.quoteAssetDecimals,
};

function scaleForDecimals(decimals: number): bigint {
  return 10n ** BigInt(decimals);
}

function toQuoteBaseUnits(value: number, decimals: number): bigint {
  return BigInt(Math.max(0, Math.round(value * Number(scaleForDecimals(decimals)))));
}

function toChainPriceU64(value: number): bigint {
  return BigInt(toChainPrice(value));
}

function productIdBytes(productId: string): number[] {
  return Array.from(new TextEncoder().encode(productId));
}

function target(config: AnkerProtocolConfig, moduleName: string, functionName: string): string {
  return `${config.packageId}::${moduleName}::${functionName}`;
}

function predictTarget(config: AnkerProtocolConfig, moduleName: string, functionName: string): string {
  return `${config.predictPackageId}::${moduleName}::${functionName}`;
}

function assertDualInvestmentQuote(quote: StructuredProductQuote) {
  if (quote.productType !== 'dual-investment') {
    throw new Error('Expected a Dual Investment quote.');
  }
  if (!quote.executable) {
    throw new Error(quote.warning ?? 'Dual Investment quote is not executable.');
  }
}

function assertSharkFinQuote(quote: StructuredProductQuote) {
  if (quote.productType !== 'shark-fin') {
    throw new Error('Expected a Shark Fin quote.');
  }
  if (!quote.sharkFin) {
    throw new Error('Shark Fin quote is missing product metrics.');
  }
  if (!quote.executable) {
    throw new Error(quote.warning ?? 'Shark Fin quote is not executable.');
  }
}

function legQuantityToBaseUnits(leg: LegQuote, config: AnkerProtocolConfig): bigint {
  return toQuoteBaseUnits(leg.quantity, config.quoteAssetDecimals);
}

function legCostToBaseUnits(leg: LegQuote, config: AnkerProtocolConfig): bigint {
  return toQuoteBaseUnits(leg.askCost, config.quoteAssetDecimals);
}

function addMarketKey(tx: Transaction, leg: LegQuote, config: AnkerProtocolConfig, calls: string[]) {
  const callTarget = predictTarget(config, 'market_key', 'new');
  calls.push(callTarget);
  return tx.moveCall({
    target: callTarget,
    arguments: [
      tx.pure.id(leg.oracleId),
      tx.pure.u64(leg.expiryMs),
      tx.pure.u64(toChainPriceU64(leg.strike ?? 0)),
      tx.pure.bool(leg.isUp ?? leg.instrumentType !== 'binary-down'),
    ],
  });
}

function assertRedeemAmounts(feeAmount: bigint, payoutAmount: bigint) {
  if (feeAmount > payoutAmount) {
    throw new Error('Redeem fee cannot exceed payout amount.');
  }
}

function addWithdrawAndRecordClaimCommands(input: {
  tx: Transaction;
  calls: string[];
  accountAddress: string;
  managerId: string;
  noteId: string;
  feeAmount: bigint;
  payoutAmount: bigint;
  config: AnkerProtocolConfig;
}) {
  assertRedeemAmounts(input.feeAmount, input.payoutAmount);

  const manager = input.tx.object(input.managerId);
  const withdrawTarget = predictTarget(input.config, 'predict_manager', 'withdraw');
  input.calls.push(withdrawTarget);
  const [feeCoin] = input.tx.moveCall({
    target: withdrawTarget,
    typeArguments: [input.config.quoteAssetType],
    arguments: [manager, input.tx.pure.u64(input.feeAmount)],
  });

  const netPayoutAmount = input.payoutAmount - input.feeAmount;
  input.calls.push(withdrawTarget);
  const [payoutCoin] = input.tx.moveCall({
    target: withdrawTarget,
    typeArguments: [input.config.quoteAssetType],
    arguments: [manager, input.tx.pure.u64(netPayoutAmount)],
  });

  const recordTarget = target(input.config, 'product_note', 'record_redeem_with_fee');
  input.calls.push(recordTarget);
  input.tx.moveCall({
    target: recordTarget,
    typeArguments: [input.config.quoteAssetType],
    arguments: [
      input.tx.object(input.config.registryId),
      input.tx.object(input.noteId),
      feeCoin,
      input.tx.pure.u64(input.payoutAmount),
    ],
  });

  input.calls.push('transferObjects');
  input.tx.transferObjects([payoutCoin], input.accountAddress);

  return { netPayoutAmount };
}

function addRedeemDualInvestmentCommands(input: {
  tx: Transaction;
  calls: string[];
  accountAddress: string;
  managerId: string;
  noteId: string;
  oracleId: string;
  legs: LegQuote[];
  feeAmount: bigint;
  payoutAmount: bigint;
  config: AnkerProtocolConfig;
}) {
  assertRedeemAmounts(input.feeAmount, input.payoutAmount);

  const manager = input.tx.object(input.managerId);
  const predict = input.tx.object(input.config.predictObjectId);
  const oracle = input.tx.object(input.oracleId);

  input.legs.forEach((leg) => {
    const key = addMarketKey(input.tx, leg, input.config, input.calls);
    const redeemTarget = predictTarget(input.config, 'predict', 'redeem');
    input.calls.push(redeemTarget);
    input.tx.moveCall({
      target: redeemTarget,
      typeArguments: [input.config.quoteAssetType],
      arguments: [
        predict,
        manager,
        oracle,
        key,
        input.tx.pure.u64(legQuantityToBaseUnits(leg, input.config)),
        input.tx.object.clock(),
      ],
    });
  });

  return addWithdrawAndRecordClaimCommands(input);
}

function dualInvestmentNoteLegs(note: AnkerProductNoteRecord): LegQuote[] {
  return note.legs.map((leg) => ({
    id: `up-${leg.strike}`,
    instrumentType: 'binary-up',
    oracleId: note.oracleId,
    expiryMs: note.expiryMs,
    strike: leg.strike,
    isUp: true,
    quantity: leg.quantity,
    description: `UP ${leg.strike.toLocaleString('en-US')}`,
    askPrice: leg.quantity === 0 ? 0 : leg.cost / leg.quantity,
    askCost: leg.cost,
    redeemPreview: 0,
    quoteTimestampMs: 0,
    executable: true,
  }));
}

export function buildCreatePredictManagerTransaction(input: {
  config?: AnkerProtocolConfig;
} = {}): CreateManagerTransactionPlan {
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
  config?: AnkerProtocolConfig;
}): SubscribeDualInvestmentTransactionPlan {
  const config = input.config ?? DEFAULT_ANKER_CONFIG;
  assertDualInvestmentQuote(input.quote);

  const tx = new Transaction();
  tx.setSender(input.accountAddress);
  const calls: string[] = [];
  const depositAmount = toQuoteBaseUnits(input.quote.principal, config.quoteAssetDecimals);
  const legStrikes = input.quote.legs.map((leg) => toChainPriceU64(leg.strike ?? 0));
  const legQuantities = input.quote.legs.map((leg) => legQuantityToBaseUnits(leg, config));
  const legCosts = input.quote.legs.map((leg) => legCostToBaseUnits(leg, config));
  const targetPrice = toChainPriceU64(input.productInput.targetPrice);
  const floorPrice = toChainPriceU64(input.productInput.floorPrice);
  const idBytes = productIdBytes(input.quote.id);
  const manager = tx.object(input.managerId);
  const predict = tx.object(config.predictObjectId);
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
      tx.pure.u64(toQuoteBaseUnits(input.quote.reserve, config.quoteAssetDecimals)),
      tx.pure.u64(toQuoteBaseUnits(input.quote.coupon, config.quoteAssetDecimals)),
      tx.pure.u64(targetPrice),
      tx.pure.u64(floorPrice),
      tx.pure.u64(Math.max(0, Math.round(input.quote.apr * 10_000))),
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

export function buildSubscribeSharkFinMockCurrentTransaction(input: {
  accountAddress: string;
  managerId: string;
  quote: StructuredProductQuote;
  lowerBound: number;
  upperBound: number;
  config?: AnkerProtocolConfig;
}): SubscribeSharkFinTransactionPlan {
  const config = input.config ?? DEFAULT_ANKER_CONFIG;
  assertSharkFinQuote(input.quote);

  const tx = new Transaction();
  tx.setSender(input.accountAddress);
  const calls: string[] = [];
  const depositAmount = toQuoteBaseUnits(input.quote.totalLegCost, config.quoteAssetDecimals);
  const principalAmount = toQuoteBaseUnits(input.quote.principal, config.quoteAssetDecimals);
  const baseCouponAmount = toQuoteBaseUnits(input.quote.sharkFin!.baseCoupon, config.quoteAssetDecimals);
  const currentYieldAmount = toQuoteBaseUnits(input.quote.sharkFin!.projectedCurrentYield, config.quoteAssetDecimals);
  const legStrikes = input.quote.legs.map((leg) => toChainPriceU64(leg.strike ?? 0));
  const legQuantities = input.quote.legs.map((leg) => legQuantityToBaseUnits(leg, config));
  const legCosts = input.quote.legs.map((leg) => legCostToBaseUnits(leg, config));
  const lowerBound = toChainPriceU64(input.lowerBound);
  const upperBound = toChainPriceU64(input.upperBound);
  const idBytes = productIdBytes(input.quote.id);
  const manager = tx.object(input.managerId);
  const predict = tx.object(config.predictObjectId);
  const oracle = tx.object(input.quote.oracle.oracleId);

  const depositTarget = predictTarget(config, 'predict_manager', 'deposit');
  calls.push(depositTarget);
  const optionBudgetCoin = coinWithBalance({
    balance: depositAmount,
    type: config.quoteAssetType,
  });
  tx.moveCall({
    target: depositTarget,
    typeArguments: [config.quoteAssetType],
    arguments: [manager, optionBudgetCoin],
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

  const noteTarget = target(config, 'product_note', 'new_shark_fin_note_with_mock_current_deposit');
  calls.push(noteTarget);
  const note = tx.moveCall({
    target: noteTarget,
    arguments: [
      tx.object(config.registryId),
      tx.pure.vector('u8', idBytes),
      tx.pure.id(input.managerId),
      tx.pure.id(input.quote.oracle.oracleId),
      tx.pure.u64(input.quote.oracle.expiryMs),
      tx.pure.u64(principalAmount),
      tx.pure.u64(baseCouponAmount),
      tx.pure.u64(currentYieldAmount),
      tx.pure.u64(lowerBound),
      tx.pure.u64(upperBound),
      tx.pure.bool(input.quote.sharkFin!.direction === 'bullish'),
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
    principalAmount,
    baseCouponAmount,
    currentYieldAmount,
    legStrikes,
    legQuantities,
    legCosts,
    lowerBound,
    upperBound,
    productIdBytes: idBytes,
  };
}

export function buildRedeemDualInvestmentTransaction(input: {
  accountAddress: string;
  managerId: string;
  noteId: string;
  quote: StructuredProductQuote;
  feeAmount: number;
  payoutAmount: number;
  config?: AnkerProtocolConfig;
}): RedeemDualInvestmentTransactionPlan {
  const config = input.config ?? DEFAULT_ANKER_CONFIG;
  assertDualInvestmentQuote(input.quote);

  const tx = new Transaction();
  tx.setSender(input.accountAddress);
  const calls: string[] = [];
  const feeAmount = toQuoteBaseUnits(input.feeAmount, config.quoteAssetDecimals);
  const payoutAmount = toQuoteBaseUnits(input.payoutAmount, config.quoteAssetDecimals);

  const { netPayoutAmount } = addRedeemDualInvestmentCommands({
    tx,
    calls,
    accountAddress: input.accountAddress,
    managerId: input.managerId,
    noteId: input.noteId,
    oracleId: input.quote.oracle.oracleId,
    legs: input.quote.legs,
    feeAmount,
    payoutAmount,
    config,
  });

  return { tx, calls, feeAmount, payoutAmount, netPayoutAmount, claimMode: 'redeem-and-withdraw' };
}

export function buildRedeemDualInvestmentNoteTransaction(input: {
  accountAddress: string;
  note: AnkerProductNoteRecord;
  feeAmount: number;
  payoutAmount: number;
  config?: AnkerProtocolConfig;
}): RedeemDualInvestmentTransactionPlan {
  if (input.note.productType !== 'dual-investment') {
    throw new Error('Expected a Dual Investment product note.');
  }
  if (input.note.status !== 'open') {
    throw new Error('Product note is already redeemed.');
  }

  return buildClaimDualInvestmentNoteTransaction({
    accountAddress: input.accountAddress,
    note: input.note,
    feeAmount: input.feeAmount,
    payoutAmount: input.payoutAmount,
    redeemLegs: true,
    config: input.config,
  });
}

export function buildClaimDualInvestmentNoteTransaction(input: {
  accountAddress: string;
  note: AnkerProductNoteRecord;
  feeAmount: number;
  payoutAmount: number;
  redeemLegs: boolean;
  config?: AnkerProtocolConfig;
}): RedeemDualInvestmentTransactionPlan {
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
  const feeAmount = toQuoteBaseUnits(input.feeAmount, config.quoteAssetDecimals);
  const payoutAmount = toQuoteBaseUnits(input.payoutAmount, config.quoteAssetDecimals);

  const commandInput = {
    tx,
    calls,
    accountAddress: input.accountAddress,
    managerId: input.note.managerId,
    noteId: input.note.noteId,
    feeAmount,
    payoutAmount,
    config,
  };

  const { netPayoutAmount } = input.redeemLegs
    ? addRedeemDualInvestmentCommands({
        ...commandInput,
        oracleId: input.note.oracleId,
        legs: dualInvestmentNoteLegs(input.note),
      })
    : addWithdrawAndRecordClaimCommands(commandInput);

  return {
    tx,
    calls,
    feeAmount,
    payoutAmount,
    netPayoutAmount,
    claimMode: input.redeemLegs ? 'redeem-and-withdraw' : 'withdraw-only',
  };
}
