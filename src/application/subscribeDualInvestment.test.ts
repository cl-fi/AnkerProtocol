import { describe, expect, it } from 'vitest';
import type { CustodyAccountRef } from './subscribeDualInvestment';
import type { QuoteProvider } from '../deepbook/quoteProvider';
import { buildDualInvestmentLegIntents, compileDualInvestment } from '../products/dualInvestment';
import type { AnkerProductNoteRecord } from '../sui/ankerPortfolio';
import type { AnkerProtocolConfig } from '../sui/ankerTransactions';
import type { DualInvestmentInput, StructuredProductQuote } from '../products/types';
import {
  buildSubscribeDualInvestmentApplicationPlan,
  createSubscribeQuoteEnvelope,
  refreshDualInvestmentQuoteForSigning,
  selectUnallocatedPredictManager,
} from './subscribeDualInvestment';

const OWNER = `0x${'a'.repeat(64)}`;
const MANAGER_ID = `0x${'b'.repeat(64)}`;
const USED_MANAGER_ID = `0x${'c'.repeat(64)}`;
const ANKER_PACKAGE_ID = `0x${'1'.repeat(64)}`;
const ANKER_REGISTRY_ID = `0x${'2'.repeat(64)}`;
const PREDICT_PACKAGE_ID = `0x${'3'.repeat(64)}`;
const PREDICT_OBJECT_ID = `0x${'4'.repeat(64)}`;
const ORACLE_ID = `0x${'5'.repeat(64)}`;
const DUSDC = `${`0x${'6'.repeat(64)}`}::dusdc::DUSDC`;

const config: AnkerProtocolConfig = {
  network: 'testnet',
  packageId: ANKER_PACKAGE_ID,
  registryId: ANKER_REGISTRY_ID,
  predictPackageId: PREDICT_PACKAGE_ID,
  poolVaultId: PREDICT_OBJECT_ID,
  quoteAssetType: DUSDC,
  quoteAssetDecimals: 6,
};

function noteFixture(wrapperId = USED_MANAGER_ID): Pick<AnkerProductNoteRecord, 'wrapperId'> {
  return { wrapperId };
}

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
    ],
    totalLegCost: 2.1,
    reserve: 610,
    coupon: 20,
    apr: 1.9264,
    executable: true,
    scenarios: [],
  };
}

function compiledQuoteFixture(input = productInput): StructuredProductQuote {
  const oracle = quoteFixture().oracle;
  const quotedLegs = buildDualInvestmentLegIntents(input, oracle, { nowMs: 1 }).map((leg) => ({
    ...leg,
    askPrice: 0.03,
    askCost: 2.1,
    redeemPreview: 0,
    quoteTimestampMs: 1,
    executable: true,
  }));
  return compileDualInvestment({ input, oracle, quotedLegs, nowMs: 1 });
}

const productInput: DualInvestmentInput = {
  principal: 1_000,
  targetPrice: 66_000,
  floorPrice: 61_000,
  targetLegCount: 1,
};

describe('selectUnallocatedPredictManager', () => {
  it('selects the owner AccountWrapper even when notes already reference it', () => {
    const managers: CustodyAccountRef[] = [{ managerId: USED_MANAGER_ID, owner: OWNER }];

    expect(selectUnallocatedPredictManager(managers, [noteFixture()], OWNER)).toEqual({
      managerId: USED_MANAGER_ID,
      owner: OWNER,
    });
  });

  it('ignores wrappers that belong to another owner', () => {
    const managers: CustodyAccountRef[] = [{ managerId: MANAGER_ID, owner: `0x${'9'.repeat(64)}` }];

    expect(selectUnallocatedPredictManager(managers, [noteFixture()], OWNER)).toBeUndefined();
  });

  it('fails closed when wrapper ownership is missing for an owner-scoped lookup', () => {
    expect(selectUnallocatedPredictManager([{ managerId: MANAGER_ID }], [], OWNER)).toBeUndefined();
  });

  it('returns the first wrapper when no owner scope is provided', () => {
    expect(selectUnallocatedPredictManager([{ managerId: MANAGER_ID }], undefined)).toEqual({
      managerId: MANAGER_ID,
    });
  });

  it('returns undefined when no wrappers are available', () => {
    expect(selectUnallocatedPredictManager([], [noteFixture()], OWNER)).toBeUndefined();
  });
});

describe('buildSubscribeDualInvestmentApplicationPlan', () => {
  it('uses the owner AccountWrapper and builds a guarded subscribe PTB', () => {
    const plan = buildSubscribeDualInvestmentApplicationPlan({
      accountAddress: OWNER,
      managers: [{ managerId: MANAGER_ID, owner: OWNER }],
      notes: [noteFixture()],
      productInput,
      quote: quoteFixture(),
      config,
      nowMs: 1,
    });

    expect(plan.managerId).toBe(MANAGER_ID);
    expect(plan.transactionPlan.calls).toContain(`${ANKER_PACKAGE_ID}::product_note::new_dual_investment_note`);
    expect(plan.quoteEnvelope.maxTotalCostBaseUnits).toBe(2_121_000n);
  });

  it('fails before signing when no AccountWrapper is available', () => {
    expect(() =>
      buildSubscribeDualInvestmentApplicationPlan({
        accountAddress: OWNER,
        managers: [],
        notes: [noteFixture()],
        productInput,
        quote: quoteFixture(),
        config,
        nowMs: 1,
      }),
    ).toThrow('Open your Predict account before subscribing.');
  });
});
describe('refreshDualInvestmentQuoteForSigning', () => {
  it('re-quotes the exact Target Buy legs and keeps the original max-cost envelope', async () => {
    const quote = compiledQuoteFixture();
    const quoteEnvelope = createSubscribeQuoteEnvelope(quote, config);
    const quoteLegs: QuoteProvider['quoteLegs'] = async (legs) =>
      legs.map((leg) => ({
        ...leg,
        askPrice: 0.211,
        askCost: 2.11,
        redeemPreview: 0,
        quoteTimestampMs: 10,
        executable: true,
      }));

    const refreshed = await refreshDualInvestmentQuoteForSigning({
      productInput,
      quote,
      quoteEnvelope,
      quoteProvider: { quoteLegs },
      config,
      nowMs: 10,
    });

    expect(refreshed.totalLegCost).toBe(2.11);
    expect(refreshed.coupon).toBeCloseTo(quote.coupon - 0.01);
  });

  it('rejects refreshed quotes whose actual leg cost exceeds the original max cost', async () => {
    const quote = compiledQuoteFixture();
    const quoteEnvelope = createSubscribeQuoteEnvelope(quote, config);
    const quoteLegs: QuoteProvider['quoteLegs'] = async (legs) =>
      legs.map((leg) => ({
        ...leg,
        askPrice: 0.22,
        askCost: 2.2,
        redeemPreview: 0,
        quoteTimestampMs: 10,
        executable: true,
      }));

    await expect(
      refreshDualInvestmentQuoteForSigning({
        productInput,
        quote,
        quoteEnvelope,
        quoteProvider: { quoteLegs },
        config,
        nowMs: 10,
      }),
    ).rejects.toThrow('Quoted cost exceeds max cost.');
  });

  it('rejects refreshed quotes that are no longer executable before wallet signing', async () => {
    const quote = compiledQuoteFixture();
    const quoteEnvelope = createSubscribeQuoteEnvelope(quote, config);
    const quoteLegs: QuoteProvider['quoteLegs'] = async (legs) =>
      legs.map((leg) => ({
        ...leg,
        askPrice: 0.03,
        askCost: 2.1,
        redeemPreview: 0,
        quoteTimestampMs: 10,
        executable: false,
        error: 'No book liquidity',
      }));

    await expect(
      refreshDualInvestmentQuoteForSigning({
        productInput,
        quote,
        quoteEnvelope,
        quoteProvider: { quoteLegs },
        config,
        nowMs: 10,
      }),
    ).rejects.toThrow('No book liquidity');
  });
});
