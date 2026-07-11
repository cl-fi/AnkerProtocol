import type { Transaction } from '@mysten/sui/transactions';
import type { LegQuote, StructuredProductQuote } from '../products/types';
import { toChainPrice } from '../products/units';
import type { AnkerProductNoteRecord } from './ankerPortfolio';
import type { AnkerProtocolConfig } from './ankerProtocolConfig';
import { binaryUpRangeTicks } from './predictTicks';

export const U64_MAX = (1n << 64n) - 1n;
/** 1e9-scaled leverage: 1x (no floor). */
export const LEVERAGE_1X = 1_000_000_000n;
/** D6 layer-3 mint slippage (~1.5%). */
export const MINT_SLIPPAGE_BPS = 150;

function assertSafeU64Number(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number.`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} exceeds safe integer range.`);
  }
}

export function toQuoteBaseUnits(value: number, decimals: number, label: string): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error(`${label} decimals must be an integer between 0 and 18.`);
  }

  const rounded = Math.round(value * 10 ** decimals);
  assertSafeU64Number(rounded, label);
  return BigInt(rounded);
}

export function toChainPriceU64(value: number, label: string): bigint {
  const price = toChainPrice(value);
  assertSafeU64Number(price, label);
  return BigInt(price);
}

export function toBpsU64(value: number, label: string): bigint {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number.`);
  }
  const rounded = Math.round(value * 10_000);
  assertSafeU64Number(rounded, label);
  return BigInt(rounded);
}

export function applyMintSlippage(value: bigint, slippageBps: number = MINT_SLIPPAGE_BPS): bigint {
  if (value < 0n) {
    throw new Error('Slippage base value must be non-negative.');
  }
  if (!Number.isInteger(slippageBps) || slippageBps < 0) {
    throw new Error('Slippage bps must be a non-negative integer.');
  }
  if (value === U64_MAX) return U64_MAX;
  const scaled = value * BigInt(10_000 + slippageBps);
  const withCeil = (scaled + 9_999n) / 10_000n;
  return withCeil > U64_MAX ? U64_MAX : withCeil;
}

export function subscribeTopUpBaseUnits(principalBaseUnits: bigint, wrapperBalanceBaseUnits: bigint): bigint {
  if (principalBaseUnits < 0n || wrapperBalanceBaseUnits < 0n) {
    throw new Error('Principal and wrapper balance must be non-negative.');
  }
  return principalBaseUnits > wrapperBalanceBaseUnits
    ? principalBaseUnits - wrapperBalanceBaseUnits
    : 0n;
}

export function productIdBytes(productId: string): number[] {
  return Array.from(new TextEncoder().encode(productId));
}

export function target(config: AnkerProtocolConfig, moduleName: string, functionName: string): string {
  return `${config.packageId}::${moduleName}::${functionName}`;
}

export function predictTarget(config: AnkerProtocolConfig, moduleName: string, functionName: string): string {
  return `${config.predictPackageId}::${moduleName}::${functionName}`;
}

export function accountTarget(config: AnkerProtocolConfig, moduleName: string, functionName: string): string {
  return `${config.accountPackageId}::${moduleName}::${functionName}`;
}

export function assertDualInvestmentQuote(quote: StructuredProductQuote) {
  if (quote.productType !== 'dual-investment') {
    throw new Error('Expected a Dual Investment quote.');
  }
  if (!quote.executable) {
    throw new Error(quote.warning ?? 'Dual Investment quote is not executable.');
  }
}

export function assertQuoteMatchesConfig(quote: StructuredProductQuote, config: AnkerProtocolConfig) {
  if (quote.oracle.predictId.toLowerCase() !== config.poolVaultId.toLowerCase()) {
    throw new Error('Quote Predict object does not match configured Predict object.');
  }
}

export function legQuantityToBaseUnits(leg: LegQuote, config: AnkerProtocolConfig): bigint {
  return toQuoteBaseUnits(leg.quantity, config.quoteAssetDecimals, `Quote leg ${leg.id} quantity`);
}

export function legCostToBaseUnits(leg: LegQuote, config: AnkerProtocolConfig): bigint {
  return toQuoteBaseUnits(leg.askCost, config.quoteAssetDecimals, `Quote leg ${leg.id} cost`);
}

export function legBinaryUpTicks(leg: LegQuote, tickSizeUsd: number) {
  if (leg.instrumentType !== 'binary-up' && leg.isUp !== true) {
    throw new Error(`Subscribe currently supports binary-up legs only (got ${leg.id}).`);
  }
  const strike = leg.strike;
  if (typeof strike !== 'number') {
    throw new Error(`Quote leg ${leg.id} is missing a strike.`);
  }
  return binaryUpRangeTicks(strike, tickSizeUsd);
}

/** @deprecated 4-16 MarketKey helper — kept for redeem path until claim is migrated. */
export function addMarketKey(tx: Transaction, leg: LegQuote, config: AnkerProtocolConfig, calls: string[]) {
  const callTarget = predictTarget(config, 'market_key', 'new');
  calls.push(callTarget);
  return tx.moveCall({
    target: callTarget,
    arguments: [
      tx.pure.id(leg.oracleId),
      tx.pure.u64(leg.expiryMs),
      tx.pure.u64(toChainPriceU64(leg.strike ?? 0, `Quote leg ${leg.id} strike`)),
      tx.pure.bool(leg.isUp ?? leg.instrumentType !== 'binary-down'),
    ],
  });
}

function assertRedeemAmounts(feeAmount: bigint, payoutAmount: bigint) {
  if (feeAmount > payoutAmount) {
    throw new Error('Redeem fee cannot exceed payout amount.');
  }
}

export function addWithdrawAndRecordClaimCommands(input: {
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

export function addRedeemDualInvestmentPositionCommands(input: {
  tx: Transaction;
  calls: string[];
  managerId: string;
  oracleId: string;
  legs: LegQuote[];
  legQuantitiesBaseUnits?: readonly bigint[];
  config: AnkerProtocolConfig;
}) {
  const manager = input.tx.object(input.managerId);
  const predict = input.tx.object(input.config.poolVaultId);
  const oracle = input.tx.object(input.oracleId);

  input.legs.forEach((leg, index) => {
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
        input.tx.pure.u64(input.legQuantitiesBaseUnits?.[index] ?? legQuantityToBaseUnits(leg, input.config)),
        input.tx.object.clock(),
      ],
    });
  });
}

export function dualInvestmentNoteLegs(note: AnkerProductNoteRecord): LegQuote[] {
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
