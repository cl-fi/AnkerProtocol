/**
 * Retired predict-testnet-4-16 deployment (CONTEXT: Legacy Oracle).
 *
 * The 4-16 indexer is gone (HTTP 500) and its markets are frozen for trading,
 * but Block Scholes still pushes spot/forward/SVI to the deployment's day-scale
 * oracle objects on-chain. We read those objects directly over GraphQL to give
 * day tenors live browse pricing while the 6-24 deployment has no day-scale
 * Expiry Markets. Subscribe stays disabled for these rows ("awaiting migration").
 */
export const LEGACY_PREDICT = {
  packageId: '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138',
  predictObjectId: '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a',
} as const;

export const LEGACY_ORACLE_PRICES_UPDATED_EVENT = `${LEGACY_PREDICT.packageId}::oracle::OraclePricesUpdated`;

/** How many recent OraclePricesUpdated events to scan when discovering live Legacy Oracles. */
export const LEGACY_ORACLE_DISCOVERY_EVENT_WINDOW = 50;
