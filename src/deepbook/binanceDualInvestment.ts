const BINANCE_DUAL_PROJECT_LIST_URL = 'https://www.binance.com/bapi/earn/v5/friendly/pos/dc/project/list';
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_COUNT = 5;

interface BinanceDualInvestmentApiRow {
  id?: string;
  investmentAsset?: string;
  targetAsset?: string;
  strikePrice?: string;
  settleTime?: string;
  apr?: string;
  duration?: string;
  canPurchase?: boolean;
  type?: string;
}

interface BinanceDualInvestmentApiResponse {
  success?: boolean;
  code?: string;
  message?: string | null;
  data?: {
    total?: string;
    list?: BinanceDualInvestmentApiRow[];
  };
}

export interface BinanceDualInvestmentProduct {
  id: string;
  investmentAsset: 'USDC' | 'USDT' | string;
  targetAsset: 'BTC' | string;
  strikePrice: number;
  settleTimeMs: number;
  apr: number;
  durationDays: number;
  canPurchase: boolean;
}

function toNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseProducts(rows: BinanceDualInvestmentApiRow[]) {
  return rows
    .map((row): BinanceDualInvestmentProduct | null => {
      const strikePrice = toNumber(row.strikePrice);
      const settleTimeMs = toNumber(row.settleTime);
      const apr = toNumber(row.apr);
      const durationDays = toNumber(row.duration);

      if (!row.id || strikePrice <= 0 || settleTimeMs <= 0 || apr <= 0) {
        return null;
      }

      return {
        id: row.id,
        investmentAsset: row.investmentAsset ?? 'USDC',
        targetAsset: row.targetAsset ?? 'BTC',
        strikePrice,
        settleTimeMs,
        apr,
        durationDays,
        canPurchase: Boolean(row.canPurchase),
      };
    })
    .filter((row): row is BinanceDualInvestmentProduct => Boolean(row));
}

export function buildBinanceDualInvestmentUrl(input: {
  pageIndex: number;
  pageSize: number;
}) {
  const url = new URL(BINANCE_DUAL_PROJECT_LIST_URL);
  url.searchParams.set('investmentAsset', 'USDC');
  url.searchParams.set('targetAsset', 'BTC');
  url.searchParams.set('projectType', 'DOWN');
  url.searchParams.set('sortType', 'APY_DESC');
  url.searchParams.set('pageIndex', String(input.pageIndex));
  url.searchParams.set('pageSize', String(input.pageSize));
  return url;
}

async function fetchProductPage(input: {
  pageIndex: number;
  pageSize: number;
}): Promise<{ total: number; products: BinanceDualInvestmentProduct[] }> {
  const url = buildBinanceDualInvestmentUrl(input);

  const response = await fetch(url.toString(), {
    credentials: 'omit',
    headers: {
      accept: 'application/json, text/plain, */*',
    },
  });
  if (!response.ok) {
    throw new Error(`Binance Dual Investment fetch failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as BinanceDualInvestmentApiResponse;
  const isSuccessfulPayload = payload.success === true || payload.code === '000000';
  if (!isSuccessfulPayload || !payload.data?.list) {
    throw new Error(payload.message ?? payload.code ?? 'Binance Dual Investment response was not successful.');
  }

  return {
    total: toNumber(payload.data.total),
    products: parseProducts(payload.data.list),
  };
}

export async function fetchBinanceDualInvestmentProducts(input: {
  pageSize?: number;
  maxPageCount?: number;
} = {}) {
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  const firstPage = await fetchProductPage({ pageIndex: 1, pageSize });
  const pageCount = Math.min(
    input.maxPageCount ?? MAX_PAGE_COUNT,
    Math.max(1, Math.ceil(firstPage.total / pageSize)),
  );

  if (pageCount === 1) {
    return firstPage.products;
  }

  const restPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      fetchProductPage({
        pageIndex: index + 2,
        pageSize,
      }),
    ),
  );

  return [...firstPage.products, ...restPages.flatMap((page) => page.products)];
}

export function findBinanceDualInvestmentMatch(input: {
  products: BinanceDualInvestmentProduct[];
  targetPrice: number;
  settlementTimeMs: number;
}) {
  const targetPrice = Math.round(input.targetPrice);
  const settlementDateKey = utcDateKey(input.settlementTimeMs);
  const candidates = input.products.filter(
    (product) =>
      Math.round(product.strikePrice) === targetPrice &&
      (product.settleTimeMs === input.settlementTimeMs || utcDateKey(product.settleTimeMs) === settlementDateKey),
  );

  return candidates.sort((a, b) => {
    const aExact = a.settleTimeMs === input.settlementTimeMs;
    const bExact = b.settleTimeMs === input.settlementTimeMs;
    if (aExact !== bExact) return aExact ? -1 : 1;
    if (a.canPurchase !== b.canPurchase) return a.canPurchase ? -1 : 1;
    return b.apr - a.apr;
  })[0];
}

function utcDateKey(timestampMs: number) {
  return new Date(timestampMs).toISOString().slice(0, 10);
}
