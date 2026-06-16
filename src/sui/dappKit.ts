import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { SUI_NETWORK, TESTNET_GRPC_URL } from '../config/deepbook';

const DEFAULT_NETWORK = SUI_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
const GRPC_URLS = {
  testnet: TESTNET_GRPC_URL,
  mainnet: 'https://fullnode.mainnet.sui.io:443',
} as const;

export const dAppKit = createDAppKit({
  networks: [DEFAULT_NETWORK],
  defaultNetwork: DEFAULT_NETWORK,
  createClient: (network) =>
    new SuiGrpcClient({
      network,
      baseUrl: GRPC_URLS[network as keyof typeof GRPC_URLS],
    }),
});

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
