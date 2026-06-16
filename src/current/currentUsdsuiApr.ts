export const CURRENT_API_BASE_URL = 'https://api.current.finance';
export const CURRENT_MAIN_MARKET_NAME = 'MainMarket';
export const CURRENT_USDSUI_COIN_TYPE =
  '44f838219cf67b058f3b37907b655f226153c18e33dfcd0da559a844fea9b1c1::usdsui::USDSUI';

interface CurrentApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface CurrentMarketInfo {
  supplyAPY?: number | string;
  token?: string;
  supplyPaused?: boolean;
  utilization?: number | string;
  tokenInfo?: {
    symbol?: string;
  };
}

interface CurrentReward {
  apr?: number | string;
  startTimeMs?: number;
  endTimeMs?: number;
}

interface CurrentMarketSummary {
  rewardType?: number;
  reserveCoinType?: string;
  rewards?: CurrentReward[];
}

interface CurrentMarketConfig {
  name?: string;
  summaries?: CurrentMarketSummary[];
}

export interface CurrentUsdsuiAprSnapshot {
  baseSupplyApr: number;
  rewardApr: number;
  totalApr: number;
  marketName: string;
  coinType: string;
  updatedAt: number;
  supplyPaused: boolean;
  utilization?: number;
  source: 'current-api' | 'current-api-fallback';
}

function normalizeCoinType(input: string | undefined): string {
  return input?.replace(/^0x/, '') ?? '';
}

function toNumber(input: number | string | undefined): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : 0;
}

export function parseCurrentUsdsuiApr(input: {
  marketInfo: CurrentMarketInfo;
  marketConfigs: CurrentMarketConfig[];
  nowMs?: number;
}): CurrentUsdsuiAprSnapshot {
  const nowMs = input.nowMs ?? Date.now();
  const coinType = CURRENT_USDSUI_COIN_TYPE;
  const marketConfig = input.marketConfigs.find((market) => market.name === CURRENT_MAIN_MARKET_NAME);
  const depositSummary = marketConfig?.summaries?.find(
    (summary) => summary.rewardType === 0 && normalizeCoinType(summary.reserveCoinType) === normalizeCoinType(coinType),
  );
  const activeRewards =
    depositSummary?.rewards?.filter(
      (reward) =>
        (reward.startTimeMs === undefined || reward.startTimeMs <= nowMs) &&
        (reward.endTimeMs === undefined || reward.endTimeMs >= nowMs),
    ) ?? [];
  const rewardApr = activeRewards.reduce((sum, reward) => sum + toNumber(reward.apr), 0);
  const baseSupplyApr = toNumber(input.marketInfo.supplyAPY);

  return {
    baseSupplyApr,
    rewardApr,
    totalApr: baseSupplyApr + rewardApr,
    marketName: CURRENT_MAIN_MARKET_NAME,
    coinType,
    updatedAt: nowMs,
    supplyPaused: Boolean(input.marketInfo.supplyPaused),
    utilization: input.marketInfo.utilization === undefined ? undefined : toNumber(input.marketInfo.utilization),
    source: 'current-api',
  };
}

async function fetchCurrentApi<T>(path: string): Promise<T> {
  const response = await fetch(`${CURRENT_API_BASE_URL}${path}`, {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Current API request failed: ${response.status}`);
  }

  const payload = (await response.json()) as CurrentApiResponse<T>;
  if (payload.code !== 0) {
    throw new Error(payload.message || 'Current API returned an error.');
  }
  return payload.data;
}

export async function fetchCurrentUsdsuiAprFromCurrentApi(nowMs = Date.now()): Promise<CurrentUsdsuiAprSnapshot> {
  const searchParams = new URLSearchParams({
    marketName: CURRENT_MAIN_MARKET_NAME,
    assetToken: CURRENT_USDSUI_COIN_TYPE,
  });
  const [marketInfo, marketConfigs] = await Promise.all([
    fetchCurrentApi<CurrentMarketInfo>(`/market/getMarketInfo?${searchParams.toString()}`),
    fetchCurrentApi<CurrentMarketConfig[]>('/pebbleWeb3Config/getAllMarketConfig'),
  ]);

  return parseCurrentUsdsuiApr({
    marketInfo,
    marketConfigs,
    nowMs,
  });
}

export async function fetchCurrentUsdsuiApr(): Promise<CurrentUsdsuiAprSnapshot> {
  const response = await fetch('/api/current/usdsui-apr', {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Current USDsui APR proxy failed: ${response.status}`);
  }

  return response.json() as Promise<CurrentUsdsuiAprSnapshot>;
}
