export const PREDICT_SERVER_URL = 'https://predict-server.testnet.mystenlabs.com';

export type ProtocolNetwork = 'testnet';

export function resolveProtocolNetwork(network = process.env.NEXT_PUBLIC_SUI_NETWORK ?? 'testnet'): ProtocolNetwork {
  if (network !== 'testnet') {
    throw new Error('Anker Protocol is only configured for Sui testnet. Remove the network override or set it to testnet.');
  }
  return 'testnet';
}

export const DEEPBOOK_PREDICT = {
  packageId:
    process.env.NEXT_PUBLIC_DEEPBOOK_PREDICT_PACKAGE_ID ??
    '0xf5ea2b3749c65d6e56507cc35388719aadb28f9cab873696a2f8687f5c785138',
  predictObjectId:
    process.env.NEXT_PUBLIC_DEEPBOOK_PREDICT_OBJECT_ID ??
    '0xc8736204d12f0a7277c86388a68bf8a194b0a14c5538ad13f22cbd8e2a38028a',
  quoteAssetType:
    '0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC',
  quoteAssetDecimals: 6,
  baseSpread: 0.02,
  minSpread: 0.005,
  utilizationMultiplier: 2,
  minAskPrice: 0.01,
  maxAskPrice: 0.99,
  underlyingAsset: 'BTC',
} as const;

export const TESTNET_GRPC_URL = 'https://fullnode.testnet.sui.io:443';
export const SUI_NETWORK = resolveProtocolNetwork();
