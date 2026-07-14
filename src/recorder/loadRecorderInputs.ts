import {
  fetchBinanceDualInvestmentProducts,
  type BinanceDualInvestmentProduct,
} from '../deepbook/binanceDualInvestment';
import { fetchOracleMarket, fetchPredictStatus } from '../deepbook/predictServer';
import type { TenorSource } from '../products/tenorMarkets';
import type { OracleMarket } from '../products/types';
import { buildCuratedBtcOracleResponse } from '../server/curatedOracles';

export interface RecorderInputs {
  markets: OracleMarket[];
  binanceProducts: BinanceDualInvestmentProduct[];
  spot: number;
  /** Clock passed into the quote + matcher path (capture time for Snapshot). */
  nowMs: number;
  source: TenorSource;
  upstreamFailed: boolean;
}

/**
 * Load the same day-shelf composition the product page uses
 * (`buildCuratedBtcOracleResponse` day rows), then resolve full OracleMarkets.
 */
export async function loadRecorderInputs(wallClockMs: number): Promise<RecorderInputs> {
  let response;
  try {
    response = await buildCuratedBtcOracleResponse(wallClockMs);
  } catch {
    return {
      markets: [],
      binanceProducts: [],
      spot: 0,
      nowMs: wallClockMs,
      source: 'live',
      upstreamFailed: true,
    };
  }

  const dayRows = response.oracles.filter((oracle) => oracle.group === 'day');
  if (dayRows.length === 0) {
    return {
      markets: [],
      binanceProducts: [],
      spot: 0,
      nowMs: wallClockMs,
      source: response.snapshot ? 'snapshot' : 'live',
      upstreamFailed: true,
    };
  }

  const source: TenorSource = response.snapshot ? 'snapshot' : 'live';
  const quoteNowMs = response.snapshot?.capturedAtMs ?? wallClockMs;

  let markets: OracleMarket[];
  if (source === 'snapshot') {
    markets = dayRows
      .map((row) => row.market)
      .filter((market): market is OracleMarket => market !== undefined);
  } else {
    const status = await fetchPredictStatus();
    markets = (
      await Promise.all(
        dayRows.map(async (row) => {
          try {
            return await fetchOracleMarket(row.oracle_id, {
              serverLagSeconds: status.maxTimeLagSeconds,
            });
          } catch {
            return null;
          }
        }),
      )
    ).filter((market): market is OracleMarket => market !== null);
  }

  if (markets.length === 0) {
    return {
      markets: [],
      binanceProducts: [],
      spot: 0,
      nowMs: quoteNowMs,
      source,
      upstreamFailed: true,
    };
  }

  let binanceProducts: BinanceDualInvestmentProduct[];
  if (response.snapshot) {
    binanceProducts = response.snapshot.binanceProducts;
  } else {
    try {
      binanceProducts = await fetchBinanceDualInvestmentProducts();
    } catch {
      return {
        markets: [],
        binanceProducts: [],
        spot: markets[0]!.spot,
        nowMs: quoteNowMs,
        source: 'live',
        upstreamFailed: true,
      };
    }
  }

  return {
    markets,
    binanceProducts,
    spot: markets[0]!.spot,
    nowMs: quoteNowMs,
    source,
    upstreamFailed: false,
  };
}
