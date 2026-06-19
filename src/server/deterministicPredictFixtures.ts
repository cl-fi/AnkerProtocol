import oracleStateFixture from '../test/fixtures/oracleState.json';
import statusFixture from '../test/fixtures/status.json';
import { DEEPBOOK_PREDICT } from '../config/deepbook';
import type { CuratedOracleListItem, CuratedOracleMarketResponse } from './curatedOracles';

const FIXTURE_EXPIRY_OFFSET_MS = 7 * 24 * 60 * 60_000;

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
  if (/^predicts\/0x[0-9a-fA-F]+\/oracles$/.test(path)) return deterministicOracleList(nowMs);
  if (/^predicts\/0x[0-9a-fA-F]+\/vault\/summary$/.test(path)) return deterministicVaultSummary();
  const oracleStateMatch = path.match(/^oracles\/(0x[0-9a-fA-F]+)\/state$/);
  if (oracleStateMatch) return deterministicOracleState(nowMs, oracleStateMatch[1]);
  return null;
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
