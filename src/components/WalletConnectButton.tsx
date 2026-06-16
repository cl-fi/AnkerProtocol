'use client';

import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { dAppKit } from '../sui/dappKit';

export function WalletConnectButton() {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <ConnectButton />
    </DAppKitProvider>
  );
}
