import {
  CURRENT_MAIN_MARKET_NAME,
  CURRENT_USDSUI_COIN_TYPE,
  type CurrentUsdsuiAprSnapshot,
  fetchCurrentUsdsuiAprFromCurrentApi,
} from '../current/currentUsdsuiApr';

const FALLBACK_CURRENT_APR = 0.08;
const CURRENT_APR_CACHE_CONTROL = 's-maxage=60, stale-while-revalidate=120';

export async function buildCurrentAprResponse(input: {
  fetchSnapshot?: () => Promise<CurrentUsdsuiAprSnapshot>;
  nowMs?: number;
} = {}) {
  const fetchSnapshot = input.fetchSnapshot ?? (() => fetchCurrentUsdsuiAprFromCurrentApi(input.nowMs));

  try {
    return Response.json(await fetchSnapshot(), {
      headers: {
        'cache-control': CURRENT_APR_CACHE_CONTROL,
      },
    });
  } catch {
    const nowMs = input.nowMs ?? Date.now();
    return Response.json(
      {
        error: 'Current USDsui APR is unavailable; fallback APR is indicative only.',
        baseSupplyApr: FALLBACK_CURRENT_APR,
        rewardApr: 0,
        totalApr: FALLBACK_CURRENT_APR,
        marketName: CURRENT_MAIN_MARKET_NAME,
        coinType: CURRENT_USDSUI_COIN_TYPE,
        updatedAt: nowMs,
        supplyPaused: false,
        source: 'current-api-fallback',
      } satisfies CurrentUsdsuiAprSnapshot & { error: string },
      { status: 503 },
    );
  }
}
