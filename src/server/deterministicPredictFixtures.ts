// Demo dataset calibrated against a real pre-migration market snapshot
// (BTC ≈ $61,297, ~19h expiry) so fixture-mode quotes look like live ones.
import oracleStateFixture from '../test/fixtures/demoOracleState.json';
import statusFixture from '../test/fixtures/status.json';
import { DEEPBOOK_PREDICT } from '../config/deepbook';
import type { CuratedOracleListItem, CuratedOracleMarketResponse } from './curatedOracles';

const FIXTURE_EXPIRY_OFFSET_MS = (19 * 60 + 7) * 60_000;

function fixtureNowMs() {
  return Date.now();
}

function fixtureExpiryMs(nowMs: number) {
  return nowMs + FIXTURE_EXPIRY_OFFSET_MS;
}

function deterministicOracleId(index: number) {
  if (index === 0) return oracleStateFixture.oracle.oracle_id;
  return `0xb46fdd7aee8b5b729358a254a74ec4eb59c2a07ca8878cc77df09b843bae6c${index}`;
}

function deterministicStatus(nowMs = fixtureNowMs()) {
  return {
    ...statusFixture,
    current_time_ms: nowMs,
  };
}

function deterministicOracleState(nowMs = fixtureNowMs(), oracleId = oracleStateFixture.oracle.oracle_id) {
  const expiry = fixtureExpiryMs(nowMs);
  return {
    ...oracleStateFixture,
    oracle: {
      ...oracleStateFixture.oracle,
      oracle_id: oracleId,
      expiry,
      status: 'active',
    },
    latest_price: {
      ...oracleStateFixture.latest_price,
      onchain_timestamp: nowMs - 60_000,
    },
    latest_svi: {
      ...oracleStateFixture.latest_svi,
      onchain_timestamp: nowMs - 60_000,
    },
  };
}

function deterministicOracleList(nowMs = fixtureNowMs()) {
  return [0, 1].map((index) => {
    const oracleState = deterministicOracleState(
      nowMs + index * 24 * 60 * 60_000,
      deterministicOracleId(index),
    ).oracle;
    return {
      predict_id: DEEPBOOK_PREDICT.predictObjectId,
      oracle_id: oracleState.oracle_id,
      underlying_asset: oracleState.underlying_asset,
      expiry: oracleState.expiry,
      min_strike: oracleState.min_strike,
      tick_size: oracleState.tick_size,
      status: oracleState.status,
    };
  });
}

function deterministicVaultSummary() {
  return {
    predict_id: DEEPBOOK_PREDICT.predictObjectId,
    quote_assets: [DEEPBOOK_PREDICT.quoteAssetType.replace(/^0x/, '')],
    vault_balance: 1_000_000_000,
    vault_value: 750_000_000,
    total_mtm: 250_000_000,
    total_max_payout: 300_000_000,
    available_liquidity: 700_000_000,
    available_withdrawal: 700_000_000,
    plp_total_supply: 750_000_000,
    plp_share_price: 1,
    utilization: 0.25,
    max_payout_utilization: 0.3,
  };
}

export function deterministicPredictResponse(path: string, nowMs = fixtureNowMs()): unknown | null {
  if (path === 'status') return deterministicStatus(nowMs);
  // Wallet users resolve to the empty-manager state instead of hitting the dead upstream.
  if (path === 'managers') return [];
  if (/^predicts\/0x[0-9a-fA-F]+\/oracles$/.test(path)) return deterministicOracleList(nowMs);
  if (/^predicts\/0x[0-9a-fA-F]+\/vault\/summary$/.test(path)) return deterministicVaultSummary();
  const oracleStateMatch = path.match(/^oracles\/(0x[0-9a-fA-F]+)\/state$/);
  if (oracleStateMatch) return deterministicOracleState(nowMs, oracleStateMatch[1]);
  return null;
}

// Benchmark column for the demo reference table — strikes on the same $500 grid as
// the scan targets, APRs from the same pre-migration snapshot the SVI fixture mirrors.
const DEMO_BINANCE_APR_BY_STRIKE: Array<[number, number]> = [
  [61_000, 1.8366],
  [60_500, 1.2336],
  [60_000, 0.7866],
  [59_500, 0.5679],
  [59_000, 0.4137],
  [58_500, 0.3216],
  [58_000, 0.2506],
  [57_500, 0.1904],
];
const NEXT_DAY_APR_RATIO = 0.6;

export function deterministicBinanceDualInvestmentProducts(nowMs = fixtureNowMs()) {
  return [0, 1].flatMap((dayIndex) =>
    DEMO_BINANCE_APR_BY_STRIKE.map(([strikePrice, apr]) => ({
      id: `demo-binance-${dayIndex}-${strikePrice}`,
      investmentAsset: 'USDC',
      targetAsset: 'BTC',
      strikePrice,
      settleTimeMs: fixtureExpiryMs(nowMs + dayIndex * 24 * 60 * 60_000),
      apr: dayIndex === 0 ? apr : Number((apr * NEXT_DAY_APR_RATIO).toFixed(4)),
      durationDays: dayIndex + 1,
      canPurchase: true,
    })),
  );
}

export function deterministicCuratedBtcOracleResponse(nowMs = fixtureNowMs()): CuratedOracleMarketResponse {
  return {
    generatedAt: nowMs,
    oracles: deterministicOracleList(nowMs).map((oracle) => ({
        ...oracle,
        stateReady: true,
        quoteReady: true,
        productReady: true,
        timeToExpiryMs: oracle.expiry - nowMs,
      }) as CuratedOracleListItem),
  };
}
