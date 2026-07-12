#!/usr/bin/env node
/**
 * Capture the day-tenor Snapshot (CONTEXT: Snapshot — photograph model).
 *
 * Reads every still-updating Legacy Oracle on the retired 4-16 deployment plus
 * the Binance Dual Investment benchmark at the same instant, and writes the raw
 * payloads to src/server/daySnapshot.data.json. The runtime loader parses them
 * with the same parsers used for live Legacy Oracle reads, so the snapshot is
 * validated by the exact code path that displays it.
 *
 * Re-run any time while the 4-16 oracles are alive to refresh the photograph:
 *   node scripts/capture-day-snapshot.mjs
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GRAPHQL_URL = process.env.NEXT_PUBLIC_SUI_GRAPHQL_URL ?? 'https://graphql.testnet.sui.io/graphql';
const LEGACY_PREDICT_PACKAGE_ID = '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138';
const ORACLE_PRICES_UPDATED_EVENT = `${LEGACY_PREDICT_PACKAGE_ID}::oracle::OraclePricesUpdated`;
const DISCOVERY_EVENT_WINDOW = 50;

const BINANCE_URL = 'https://www.binance.com/bapi/earn/v5/friendly/pos/dc/project/list';
const BINANCE_PAGE_SIZE = 100;
const BINANCE_MAX_PAGES = 5;

const OUTPUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'server',
  'daySnapshot.data.json',
);

async function graphql(query, variables) {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(`GraphQL request failed: HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(`GraphQL errors: ${payload.errors.map((error) => error.message).join('; ')}`);
  }
  return payload.data;
}

async function discoverLegacyOracleIds() {
  const data = await graphql(
    `query LegacyOracleUpdates($eventType: String!, $last: Int!) {
      events(last: $last, filter: { type: $eventType }) {
        nodes { contents { json } }
      }
    }`,
    { eventType: ORACLE_PRICES_UPDATED_EVENT, last: DISCOVERY_EVENT_WINDOW },
  );
  const ids = new Set();
  for (const node of data?.events?.nodes ?? []) {
    const oracleId = node?.contents?.json?.oracle_id;
    if (typeof oracleId === 'string') ids.add(oracleId);
  }
  return [...ids];
}

async function fetchOracleObject(oracleId) {
  const data = await graphql(
    `query LegacyOracleObject($address: SuiAddress!) {
      object(address: $address) {
        asMoveObject { contents { json } }
      }
    }`,
    { address: oracleId },
  );
  return data?.object?.asMoveObject?.contents?.json ?? null;
}

async function fetchBinancePage(pageIndex) {
  const url = new URL(BINANCE_URL);
  url.searchParams.set('investmentAsset', 'USDC');
  url.searchParams.set('targetAsset', 'BTC');
  url.searchParams.set('projectType', 'DOWN');
  url.searchParams.set('sortType', 'APY_DESC');
  url.searchParams.set('pageIndex', String(pageIndex));
  url.searchParams.set('pageSize', String(BINANCE_PAGE_SIZE));
  const response = await fetch(url, { headers: { accept: 'application/json, text/plain, */*' } });
  if (!response.ok) {
    throw new Error(`Binance fetch failed: HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!(payload.success === true || payload.code === '000000') || !payload.data?.list) {
    throw new Error(`Binance response not successful: ${payload.message ?? payload.code}`);
  }
  return { total: Number(payload.data.total ?? 0), rows: payload.data.list };
}

async function fetchBinanceRows() {
  const first = await fetchBinancePage(1);
  const pageCount = Math.min(BINANCE_MAX_PAGES, Math.max(1, Math.ceil(first.total / BINANCE_PAGE_SIZE)));
  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) => fetchBinancePage(index + 2)),
  );
  return [...first.rows, ...rest.flatMap((page) => page.rows)];
}

const capturedAtMs = Date.now();
const oracleIds = await discoverLegacyOracleIds();
if (oracleIds.length === 0) {
  throw new Error('No OraclePricesUpdated events found — the 4-16 legacy oracles look dead. Snapshot not written.');
}
console.log(`Discovered ${oracleIds.length} updating legacy oracle(s).`);

const [oracleObjects, binanceRows] = await Promise.all([
  Promise.all(oracleIds.map(fetchOracleObject)).then((objects) => objects.filter(Boolean)),
  fetchBinanceRows(),
]);

for (const oracle of oracleObjects) {
  console.log(
    `  oracle ${oracle.id} expiry=${new Date(Number(oracle.expiry)).toISOString()} active=${oracle.active} spot=${Number(oracle.prices?.spot) / 1e9}`,
  );
}
console.log(`Captured ${binanceRows.length} Binance Dual Investment row(s).`);

await writeFile(OUTPUT_PATH, `${JSON.stringify({ capturedAtMs, oracleObjects, binanceRows }, null, 2)}\n`);
console.log(`Snapshot written to ${OUTPUT_PATH} (capturedAt ${new Date(capturedAtMs).toISOString()}).`);
