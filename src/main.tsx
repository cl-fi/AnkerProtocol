import React from 'react';
import ReactDOM from 'react-dom/client';
import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { dAppKit } from './sui/dappKit';
import App from './App';
import './styles.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <DAppKitProvider dAppKit={dAppKit}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </DAppKitProvider>
  </React.StrictMode>,
);
