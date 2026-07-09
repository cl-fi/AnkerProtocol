#!/usr/bin/env node
/**
 * List live DeepBook Predict testnet markets and their remaining tenor.
 *
 * Usage:
 *   node scripts/check-predict-markets.mjs
 *   PREDICT_INDEXER_URL=https://predict-server-beta.testnet.mystenlabs.com node scripts/check-predict-markets.mjs
 */

const INDEXER_URL = (
  process.env.PREDICT_INDEXER_URL ?? 'https://predict-server-beta.testnet.mystenlabs.com'
).replace(/\/$/, '');

async function fetchJson(path) {
  const response = await fetch(`${INDEXER_URL}${path}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function formatHours(hours) {
  if (hours >= 24) return `${(hours / 24).toFixed(2)}d`;
  if (hours >= 1) return `${hours.toFixed(2)}h`;
  return `${(hours * 60).toFixed(1)}m`;
}

function bucketLabel(hours) {
  if (hours < 0.25) return '<15m';
  if (hours < 1) return '15m-1h';
  if (hours < 3) return '1-3h';
  if (hours < 6) return '3-6h';
  if (hours < 12) return '6-12h';
  if (hours < 24) return '12-24h';
  if (hours < 72) return '1-3d';
  return '>=3d';
}

const markets = await fetchJson('/markets');
const status = await fetchJson('/status');
const nowMs = Number(status.current_time_ms ?? Date.now());

const live = markets
  .map((market) => {
    const tteMs = Number(market.expiry) - nowMs;
    return {
      id: market.expiry_market_id,
      expiry: Number(market.expiry),
      tteMs,
      tteHours: tteMs / 3_600_000,
      tickSize: market.tick_size,
      admissionTickSize: market.admission_tick_size,
    };
  })
  .filter((market) => market.tteMs > 0)
  .sort((a, b) => a.expiry - b.expiry);

const buckets = new Map();
for (const market of live) {
  const key = bucketLabel(market.tteHours);
  buckets.set(key, (buckets.get(key) ?? 0) + 1);
}

const longest = live.at(-1);

console.log(`indexer: ${INDEXER_URL}`);
console.log(`now:     ${nowMs} (${new Date(nowMs).toISOString()})`);
console.log(`total:   ${markets.length}  live: ${live.length}  expired_in_list: ${markets.length - live.length}`);
console.log(
  `longest: ${longest ? `${formatHours(longest.tteHours)}  expiry=${longest.expiry}  id=${longest.id}` : 'none'}`,
);
console.log('');
console.log('buckets:');
for (const label of ['<15m', '15m-1h', '1-3h', '3-6h', '6-12h', '12-24h', '1-3d', '>=3d']) {
  console.log(`  ${label.padEnd(8)} ${buckets.get(label) ?? 0}`);
}
console.log('');
console.log('live markets (shortest -> longest):');
for (const market of live) {
  console.log(
    `  ${formatHours(market.tteHours).padStart(8)}  expiry=${market.expiry}  tick=${market.tickSize}  adm=${market.admissionTickSize}  ${market.id}`,
  );
}

if (!longest || longest.tteHours < 3) {
  console.log('');
  console.log('result: no live market >= 3h right now.');
} else if (longest.tteHours < 12) {
  console.log('');
  console.log('result: have multi-hour markets, but still nothing >= 12h.');
} else {
  console.log('');
  console.log('result: found market(s) >= 12h.');
}
