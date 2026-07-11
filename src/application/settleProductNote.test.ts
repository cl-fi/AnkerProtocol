import { describe, expect, it } from 'vitest';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import type { AnkerProtocolConfig } from '../sui/ankerTransactions';
import type { DualInvestmentClaimState } from '../sui/predictManagerState';
import { buildDualInvestmentClaimApplicationPlan } from './settleProductNote';

const OWNER = `0x${'a'.repeat(64)}`;
const MANAGER_ID = `0x${'b'.repeat(64)}`;
const NOTE_ID = `0x${'c'.repeat(64)}`;
const ANKER_PACKAGE_ID = `0x${'1'.repeat(64)}`;
const ANKER_REGISTRY_ID = `0x${'2'.repeat(64)}`;
const PREDICT_PACKAGE_ID = `0x${'3'.repeat(64)}`;
const PREDICT_OBJECT_ID = `0x${'4'.repeat(64)}`;
const ORACLE_ID = `0x${'5'.repeat(64)}`;
const ACCOUNT_PACKAGE_ID = `0x${'7'.repeat(64)}`;
const DUSDC = `${`0x${'6'.repeat(64)}`}::dusdc::DUSDC`;

const config: AnkerProtocolConfig = {
  packageId: ANKER_PACKAGE_ID,
  registryId: ANKER_REGISTRY_ID,
  predictPackageId: PREDICT_PACKAGE_ID,
  poolVaultId: PREDICT_OBJECT_ID,
  accountPackageId: ACCOUNT_PACKAGE_ID,
  accumulatorRoot: `0x${'a'.repeat(64)}`,
  protocolConfigId: `0x${'b'.repeat(64)}`,
  oracleRegistryId: `0x${'c'.repeat(64)}`,
  feeds: {
    pyth: `0x${'d'.repeat(64)}`,
    blockScholesSpot: `0x${'e'.repeat(64)}`,
    blockScholesForward: `0x${'f'.repeat(64)}`,
    blockScholesSvi: `0x${'0'.repeat(63)}1`,
  },
  quoteAssetType: DUSDC,
  quoteAssetDecimals: 6,
};

function noteFixture(): AnkerProductNoteRecord {
  return {
    noteId: NOTE_ID,
    productType: 'dual-investment',
    productId: 'dual-demo',
    owner: OWNER,
    wrapperId: MANAGER_ID,
    oracleId: ORACLE_ID,
    expiryMs: 1_781_683_200_000,
    principal: 1_000,
    principalBaseUnits: 1_000_000_000n,
    reserve: 610,
    reserveBaseUnits: 610_000_000n,
    coupon: 20,
    couponBaseUnits: 20_000_000n,
    targetPrice: 66_000,
    floorPrice: 61_000,
    lowerBound: 0,
    upperBound: 0,
    isBullish: false,
    usesMockCurrentDeposit: false,
    apr: 1.9264,
    feeBps: 1_000,
    legs: [
      { strike: 61_000, quantity: 10, quantityBaseUnits: 10_000_000n, cost: 2.1, costBaseUnits: 2_100_000n },
    ],
    orderIds: [11n],
    status: 'open',
    redeemedPayout: 0,
    redeemedPayoutBaseUnits: 0n,
    redeemedFee: 0,
    redeemedFeeBaseUnits: 0n,
  };
}

const redeemAndWithdraw: DualInvestmentClaimState = {
  path: 'redeem-and-withdraw',
  availableLegCount: 1,
  missingLegCount: 0,
  totalLegCount: 1,
  managerDusdcBalance: 620,
  missingLegs: [],
};

describe('buildDualInvestmentClaimApplicationPlan', () => {
  it('builds redeem-position PTBs for notes whose Predict legs are still held', () => {
    const plan = buildDualInvestmentClaimApplicationPlan({
      accountAddress: OWNER,
      note: noteFixture(),
      claimState: redeemAndWithdraw,
      config,
    });

    expect(plan.claimMode).toBe('redeem-positions');
    expect(plan.calls).toEqual([
      `${PREDICT_PACKAGE_ID}::market_key::new`,
      `${PREDICT_PACKAGE_ID}::predict::redeem`,
    ]);
  });

  it('builds withdraw-only PTBs from refreshed manager DUSDC balance', () => {
    const plan = buildDualInvestmentClaimApplicationPlan({
      accountAddress: OWNER,
      note: noteFixture(),
      claimState: {
        ...redeemAndWithdraw,
        path: 'withdraw-only',
        availableLegCount: 0,
        missingLegCount: 1,
        managerDusdcBalance: 1_020,
      },
      config,
    });

    expect(plan.claimMode).toBe('withdraw-only');
    expect(plan.payoutAmount).toBe(1_020_000_000n);
    expect(plan.feeAmount).toBe(2_000_000n);
    expect(plan.netPayoutAmount).toBe(1_018_000_000n);
  });

  it('fails closed when withdraw-only state does not include a manager balance', () => {
    expect(() =>
      buildDualInvestmentClaimApplicationPlan({
        accountAddress: OWNER,
        note: noteFixture(),
        claimState: {
          ...redeemAndWithdraw,
          path: 'withdraw-only',
          managerDusdcBalance: null,
        },
        config,
      }),
    ).toThrow('Product container DUSDC balance is unavailable.');
  });

  it('fails closed when withdraw-only manager balance is negative or unsafe', () => {
    const withdrawOnlyState: DualInvestmentClaimState = {
      ...redeemAndWithdraw,
      path: 'withdraw-only',
      availableLegCount: 0,
      missingLegCount: 1,
      managerDusdcBalance: -1,
    };

    expect(() =>
      buildDualInvestmentClaimApplicationPlan({
        accountAddress: OWNER,
        note: noteFixture(),
        claimState: withdrawOnlyState,
        config,
      }),
    ).toThrow('Manager DUSDC balance must be a non-negative finite number');

    expect(() =>
      buildDualInvestmentClaimApplicationPlan({
        accountAddress: OWNER,
        note: noteFixture(),
        claimState: {
          ...withdrawOnlyState,
          managerDusdcBalance: Number.MAX_SAFE_INTEGER / 1_000_000 + 1,
        },
        config,
      }),
    ).toThrow('Manager DUSDC balance exceeds safe integer range');
  });
});
