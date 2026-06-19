import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { SUI_NETWORK, TESTNET_GRPC_URL } from '../config/deepbook';

const GRPC_URLS = {
  testnet: TESTNET_GRPC_URL,
} as const;

export const dAppKit = createDAppKit({
  networks: [SUI_NETWORK],
  defaultNetwork: SUI_NETWORK,
  createClient: (network) =>
    new SuiGrpcClient({
      network,
      baseUrl: GRPC_URLS[SUI_NETWORK],
    }),
});

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
