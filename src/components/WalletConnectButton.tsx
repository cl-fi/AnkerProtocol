'use client';

import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import type { ReactNode } from 'react';

export function WalletConnectButton({ children }: { children?: ReactNode }) {
  return <ConnectButton>{children}</ConnectButton>;
}
