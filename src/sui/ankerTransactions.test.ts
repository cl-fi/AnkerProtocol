import { describe, expect, it } from 'vitest';
import {
  buildClaimDualInvestmentNoteTransaction,
  buildCreatePredictManagerTransaction,
  buildRedeemDualInvestmentNoteTransaction,
  buildRedeemDualInvestmentTransaction,
  buildSubscribeDualInvestmentTransaction,
  buildSubscribeSharkFinMockCurrentTransaction,
  type AnkerProtocolConfig,
} from './ankerTransactions';
import type { DualInvestmentInput, StructuredProductQuote } from '../products/types';
import type { AnkerProductNoteRecord } from './ankerPortfolio';

const OWNER = `0x${'a'.repeat(64)}`;
const MANAGER_ID = `0x${'b'.repeat(64)}`;
const NOTE_ID = `0x${'c'.repeat(64)}`;
const ANKER_PACKAGE_ID = `0x${'1'.repeat(64)}`;
const ANKER_REGISTRY_ID = `0x${'2'.repeat(64)}`;
const PREDICT_PACKAGE_ID = `0x${'3'.repeat(64)}`;
const PREDICT_OBJECT_ID = `0x${'4'.repeat(64)}`;
const ORACLE_ID = `0x${'5'.repeat(64)}`;
const DUSDC = `${`0x${'6'.repeat(64)}`}::dusdc::DUSDC`;

const config: AnkerProtocolConfig = {
  packageId: ANKER_PACKAGE_ID,
  registryId: ANKER_REGISTRY_ID,
  predictPackageId: PREDICT_PACKAGE_ID,
  predictObjectId: PREDICT_OBJECT_ID,
  quoteAssetType: DUSDC,
  quoteAssetDecimals: 6,
};

function quoteFixture(): StructuredProductQuote {
  return {
    id: 'dual-demo',
    productType: 'dual-investment',
    title: 'Target Buy BTC at 66,000',
    principal: 1_000,
    oracle: {
      predictId: PREDICT_OBJECT_ID,
      oracleId: ORACLE_ID,
      underlyingAsset: 'BTC',
      expiryMs: 1_781_683_200_000,
      minStrike: 50_000,
      tickSize: 1,
      status: 'active',
      spot: 66_172,
      forward: 66_167,
      spotTimestampMs: 1,
      sviTimestampMs: 1,
      serverLagSeconds: 1,
    },
    legs: [
      {
        id: 'up-61000',
        instrumentType: 'binary-up',
        oracleId: ORACLE_ID,
        expiryMs: 1_781_683_200_000,
        strike: 61_000,
        isUp: true,
        quantity: 10,
        description: 'UP 61,000',
        askPrice: 0.21,
        askCost: 2.1,
        redeemPreview: 0,
        quoteTimestampMs: 1,
        executable: true,
      },
      {
        id: 'up-62000',
        instrumentType: 'binary-up',
        oracleId: ORACLE_ID,
        expiryMs: 1_781_683_200_000,
        strike: 62_000,
        isUp: true,
        quantity: 12.5,
        description: 'UP 62,000',
        askPrice: 0.25,
        askCost: 3.125,
        redeemPreview: 0,
        quoteTimestampMs: 1,
        executable: true,
      },
    ],
    totalLegCost: 5.225,
    reserve: 610,
    coupon: 20,
    apr: 1.9264,
    executable: true,
    scenarios: [],
  };
}

function sharkFinQuoteFixture(): StructuredProductQuote {
  return {
    id: 'shark-demo',
    productType: 'shark-fin',
    title: 'Bullish BTC Shark Fin',
    principal: 1_000,
    principalAsset: 'USDsui',
    quoteAsset: 'USDsui',
    oracle: {
      predictId: PREDICT_OBJECT_ID,
      oracleId: ORACLE_ID,
      underlyingAsset: 'BTC',
      expiryMs: 1_781_683_200_000,
      minStrike: 50_000,
      tickSize: 1,
      status: 'active',
      spot: 66_172,
      forward: 66_167,
      spotTimestampMs: 1,
      sviTimestampMs: 1,
      serverLagSeconds: 1,
    },
    legs: [
      {
        id: 'up-70000',
        instrumentType: 'binary-up',
        oracleId: ORACLE_ID,
        expiryMs: 1_781_683_200_000,
        strike: 70_000,
        isUp: true,
        quantity: 1.5,
        description: 'UP 70,000',
        askPrice: 0.2,
        askCost: 0.3,
        redeemPreview: 0,
        quoteTimestampMs: 1,
        executable: true,
      },
    ],
    totalLegCost: 0.3,
    reserve: 1_000,
    coupon: 0.38,
    apr: 0.14,
    sharkFin: {
      direction: 'bullish',
      currentApr: 0.08,
      baseApr: 0.02,
      maxApr: 0.14,
      termDays: 7,
      projectedCurrentYield: 1.53,
      baseCoupon: 0.38,
      optionBudget: 1.15,
      optionBudgetUsed: 0.3,
      leftoverBudget: 0.85,
      payoutPerLeg: 1.5,
      maxExtraPayout: 1.5,
    },
    executable: true,
    scenarios: [],
  };
}

function dualInputFixture(): DualInvestmentInput {
  return {
    principal: 1_000,
    targetPrice: 66_000,
    floorPrice: 61_000,
    targetLegCount: 2,
  };
}

function noteFixture(): AnkerProductNoteRecord {
  return {
    noteId: NOTE_ID,
    productType: 'dual-investment',
    productId: 'dual-demo',
    owner: OWNER,
    managerId: MANAGER_ID,
    oracleId: ORACLE_ID,
    expiryMs: 1_781_683_200_000,
    principal: 1_000,
    reserve: 610,
    coupon: 20,
    targetPrice: 66_000,
    floorPrice: 61_000,
    lowerBound: 0,
    upperBound: 0,
    isBullish: false,
    usesMockCurrentDeposit: false,
    apr: 1.9264,
    feeBps: 1_000,
    legs: [
      { strike: 61_000, quantity: 10, cost: 2.1 },
      { strike: 62_000, quantity: 12.5, cost: 3.125 },
    ],
    status: 'open',
    redeemedPayout: 0,
    redeemedFee: 0,
  };
}

describe('Anker transaction builders', () => {
  it('builds a Predict manager creation transaction', () => {
    const plan = buildCreatePredictManagerTransaction({ config });

    expect(plan.calls).toEqual([`${PREDICT_PACKAGE_ID}::predict::create_manager`]);
  });

  it('builds a Target Buy subscribe PTB plan with deposit, Predict mints, and Anker note creation', () => {
    const plan = buildSubscribeDualInvestmentTransaction({
      accountAddress: OWNER,
      managerId: MANAGER_ID,
      productInput: dualInputFixture(),
      quote: quoteFixture(),
      config,
    });

    expect(plan.depositAmount).toBe(1_000_000_000n);
    expect(plan.legStrikes).toEqual([61_000_000_000_000n, 62_000_000_000_000n]);
    expect(plan.legQuantities).toEqual([10_000_000n, 12_500_000n]);
    expect(plan.legCosts).toEqual([2_100_000n, 3_125_000n]);
    expect(plan.targetPrice).toBe(66_000_000_000_000n);
    expect(plan.floorPrice).toBe(61_000_000_000_000n);
    expect(plan.calls).toEqual([
      `${PREDICT_PACKAGE_ID}::predict_manager::deposit`,
      `${PREDICT_PACKAGE_ID}::market_key::new`,
      `${PREDICT_PACKAGE_ID}::predict::mint`,
      `${PREDICT_PACKAGE_ID}::market_key::new`,
      `${PREDICT_PACKAGE_ID}::predict::mint`,
      `${ANKER_PACKAGE_ID}::product_note::new_dual_investment_note`,
      'transferObjects',
    ]);
  });

  it('builds a Shark Fin mock-Current subscribe PTB plan', () => {
    const plan = buildSubscribeSharkFinMockCurrentTransaction({
      accountAddress: OWNER,
      managerId: MANAGER_ID,
      quote: sharkFinQuoteFixture(),
      lowerBound: 70_000,
      upperBound: 80_000,
      config,
    });

    expect(plan.depositAmount).toBe(300_000n);
    expect(plan.principalAmount).toBe(1_000_000_000n);
    expect(plan.baseCouponAmount).toBe(380_000n);
    expect(plan.currentYieldAmount).toBe(1_530_000n);
    expect(plan.lowerBound).toBe(70_000_000_000_000n);
    expect(plan.upperBound).toBe(80_000_000_000_000n);
    expect(plan.calls).toEqual([
      `${PREDICT_PACKAGE_ID}::predict_manager::deposit`,
      `${PREDICT_PACKAGE_ID}::market_key::new`,
      `${PREDICT_PACKAGE_ID}::predict::mint`,
      `${ANKER_PACKAGE_ID}::product_note::new_shark_fin_note_with_mock_current_deposit`,
      'transferObjects',
    ]);
  });

  it('builds a redeem PTB plan that redeems Predict legs and records the Anker fee', () => {
    const plan = buildRedeemDualInvestmentTransaction({
      accountAddress: OWNER,
      managerId: MANAGER_ID,
      noteId: NOTE_ID,
      quote: quoteFixture(),
      feeAmount: 1.23,
      payoutAmount: 1_030,
      config,
    });

    expect(plan.feeAmount).toBe(1_230_000n);
    expect(plan.payoutAmount).toBe(1_030_000_000n);
    expect(plan.netPayoutAmount).toBe(1_028_770_000n);
    expect(plan.calls).toEqual([
      `${PREDICT_PACKAGE_ID}::market_key::new`,
      `${PREDICT_PACKAGE_ID}::predict::redeem`,
      `${PREDICT_PACKAGE_ID}::market_key::new`,
      `${PREDICT_PACKAGE_ID}::predict::redeem`,
      `${PREDICT_PACKAGE_ID}::predict_manager::withdraw`,
      `${PREDICT_PACKAGE_ID}::predict_manager::withdraw`,
      `${ANKER_PACKAGE_ID}::product_note::record_redeem_with_fee`,
      'transferObjects',
    ]);
  });

  it('builds a redeem PTB directly from an owned Anker ProductNote record', () => {
    const plan = buildRedeemDualInvestmentNoteTransaction({
      accountAddress: OWNER,
      note: noteFixture(),
      feeAmount: 2,
      payoutAmount: 1_020,
      config,
    });

    expect(plan.feeAmount).toBe(2_000_000n);
    expect(plan.payoutAmount).toBe(1_020_000_000n);
    expect(plan.netPayoutAmount).toBe(1_018_000_000n);
    expect(plan.calls).toEqual([
      `${PREDICT_PACKAGE_ID}::market_key::new`,
      `${PREDICT_PACKAGE_ID}::predict::redeem`,
      `${PREDICT_PACKAGE_ID}::market_key::new`,
      `${PREDICT_PACKAGE_ID}::predict::redeem`,
      `${PREDICT_PACKAGE_ID}::predict_manager::withdraw`,
      `${PREDICT_PACKAGE_ID}::predict_manager::withdraw`,
      `${ANKER_PACKAGE_ID}::product_note::record_redeem_with_fee`,
      'transferObjects',
    ]);
  });

  it('builds a claim PTB that redeems open Predict legs before withdrawing DUSDC', () => {
    const plan = buildClaimDualInvestmentNoteTransaction({
      accountAddress: OWNER,
      note: noteFixture(),
      feeAmount: 2,
      payoutAmount: 1_020,
      redeemLegs: true,
      config,
    });

    expect(plan.claimMode).toBe('redeem-and-withdraw');
    expect(plan.calls).toEqual([
      `${PREDICT_PACKAGE_ID}::market_key::new`,
      `${PREDICT_PACKAGE_ID}::predict::redeem`,
      `${PREDICT_PACKAGE_ID}::market_key::new`,
      `${PREDICT_PACKAGE_ID}::predict::redeem`,
      `${PREDICT_PACKAGE_ID}::predict_manager::withdraw`,
      `${PREDICT_PACKAGE_ID}::predict_manager::withdraw`,
      `${ANKER_PACKAGE_ID}::product_note::record_redeem_with_fee`,
      'transferObjects',
    ]);
  });

  it('builds a claim PTB that only withdraws DUSDC when Predict legs were already redeemed', () => {
    const plan = buildClaimDualInvestmentNoteTransaction({
      accountAddress: OWNER,
      note: noteFixture(),
      feeAmount: 2,
      payoutAmount: 1_020,
      redeemLegs: false,
      config,
    });

    expect(plan.claimMode).toBe('withdraw-only');
    expect(plan.feeAmount).toBe(2_000_000n);
    expect(plan.payoutAmount).toBe(1_020_000_000n);
    expect(plan.netPayoutAmount).toBe(1_018_000_000n);
    expect(plan.calls).toEqual([
      `${PREDICT_PACKAGE_ID}::predict_manager::withdraw`,
      `${PREDICT_PACKAGE_ID}::predict_manager::withdraw`,
      `${ANKER_PACKAGE_ID}::product_note::record_redeem_with_fee`,
      'transferObjects',
    ]);
  });
});
