import {
  CURRENT_MAIN_MARKET_NAME,
  CURRENT_USDSUI_COIN_TYPE,
  type CurrentUsdsuiAprSnapshot,
  fetchCurrentUsdsuiAprFromCurrentApi,
} from '../current/currentUsdsuiApr';

const FALLBACK_CURRENT_APR = 0.08;

export async function buildCurrentAprResponse(input: {
  fetchSnapshot?: () => Promise<CurrentUsdsuiAprSnapshot>;
  nowMs?: number;
} = {}) {
  const fetchSnapshot = input.fetchSnapshot ?? (() => fetchCurrentUsdsuiAprFromCurrentApi(input.nowMs));

  try {
    return Response.json(await fetchSnapshot());
  } catch {
    const nowMs = input.nowMs ?? Date.now();
    return Response.json({
      baseSupplyApr: FALLBACK_CURRENT_APR,
      rewardApr: 0,
      totalApr: FALLBACK_CURRENT_APR,
      marketName: CURRENT_MAIN_MARKET_NAME,
      coinType: CURRENT_USDSUI_COIN_TYPE,
      updatedAt: nowMs,
      supplyPaused: false,
      source: 'current-api-fallback',
    } satisfies CurrentUsdsuiAprSnapshot);
  }
}
