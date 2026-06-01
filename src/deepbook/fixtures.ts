import type { OracleMarket } from '../products/types';

export const lastKnownMarketSnapshot: OracleMarket = {
  predictId: '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a',
  oracleId: '0xb46fdd7aee8b5b729358a254a74ec4eb59c2a07ca8878cc77df09b843bae6c38',
  underlyingAsset: 'BTC',
  expiryMs: 1780299900000,
  minStrike: 50_000,
  tickSize: 1,
  status: 'active',
  spot: 73_264.292161574,
  forward: 73_264.782323624,
  spotTimestampMs: 1780293695403,
  sviTimestampMs: 1780293682377,
  serverLagSeconds: 1,
};
