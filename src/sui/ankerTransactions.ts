import { Transaction } from '@mysten/sui/transactions';
import { isDemoMode } from '../config/runtimeModes';
import { predictAdapter } from '../deepbook/predictAdapter';
import type { SettlementResult } from '../products/settlement';
import type { AnkerProductNoteRecord } from './ankerPortfolio';
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

export interface ClaimDualInvestmentTransactionPlan {
  tx: Transaction;
  calls: string[];
  feeAmount: bigint;
  payoutAmount: bigint;
  netPayoutAmount: bigint;
}

function assertTransactionsEnabled() {
  if (isDemoMode()) {
    throw new Error('Demo mode: on-chain transactions are temporarily disabled.');
  }
}

export function buildClaimDualInvestmentNoteTransaction(input: {
  accountAddress: string;
  note: AnkerProductNoteRecord;
  settlement: SettlementResult;
  config?: AnkerProtocolConfig;
}): ClaimDualInvestmentTransactionPlan {
  assertTransactionsEnabled();
  if (input.note.productType !== 'dual-investment') {
    throw new Error('Expected a Dual Investment product note.');
  }
  if (input.note.status !== 'open') {
    throw new Error('Product note is already redeemed.');
  }
  if (input.note.orderIds.length !== input.note.legs.length) {
    throw new Error('Product note must contain one order id per leg.');
  }

  const config = input.config ?? DEFAULT_ANKER_CONFIG;
  const tx = new Transaction();
  tx.setSender(input.accountAddress);
  const calls: string[] = [];
  const feeAmount = input.settlement.performanceFeeBaseUnits;
  const payoutAmount = input.settlement.grossPayoutBaseUnits;
  if (feeAmount > payoutAmount) {
    throw new Error('Claim fee cannot exceed payout amount.');
  }

  const wrapper = tx.object(input.note.wrapperId);
  const accumulatorRoot = tx.object(config.accumulatorRoot);
  const clock = tx.object.clock();

  calls.push(
    ...predictAdapter.redeemLegs({
      tx,
      expiryMarketId: input.note.oracleId,
      wrapperId: input.note.wrapperId,
      legs: input.note.orderIds.map((orderId, index) => ({
        orderId,
        quantityBaseUnits: input.note.legs[index].quantityBaseUnits,
      })),
      config: {
        predictPackageId: config.predictPackageId,
        accountRegistryId: config.accountRegistryId,
        protocolConfigId: config.protocolConfigId,
        oracleRegistryId: config.oracleRegistryId,
        pythFeedId: config.feeds.pyth,
        accumulatorRoot: config.accumulatorRoot,
      },
    }),
  );

  const authTarget = `${config.accountPackageId}::account::generate_auth`;
  calls.push(authTarget);
  const auth = tx.moveCall({ target: authTarget, arguments: [] });

  const withdrawTarget = `${config.accountPackageId}::account::withdraw_funds`;
  calls.push(withdrawTarget);
  const [payoutCoin] = tx.moveCall({
    target: withdrawTarget,
    typeArguments: [config.quoteAssetType],
    arguments: [wrapper, auth, tx.pure.u64(payoutAmount), accumulatorRoot, clock],
  });

  calls.push('splitCoins');
  const [feeCoin] = tx.splitCoins(payoutCoin, [tx.pure.u64(feeAmount)]);

  const recordTarget = `${config.packageId}::product_note::record_redeem_with_fee`;
  calls.push(recordTarget);
  tx.moveCall({
    target: recordTarget,
    typeArguments: [config.quoteAssetType],
    arguments: [
      tx.object(config.registryId),
      tx.object(input.note.noteId),
      feeCoin,
      tx.pure.u64(payoutAmount),
    ],
  });

  calls.push('transferObjects');
  tx.transferObjects([payoutCoin], input.accountAddress);
  const netPayoutAmount = payoutAmount - feeAmount;

  return {
    tx,
    calls,
    feeAmount,
    payoutAmount,
    netPayoutAmount,
  };
}
