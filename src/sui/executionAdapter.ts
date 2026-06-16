export type ExecutionState = 'disabled' | 'preview-only' | 'ready';

export interface OpenTransactionRequest {
  quote: unknown;
}

export interface RedeemTransactionRequest {
  ownerAddress: string;
  productId: string;
}

export interface ExecutionAdapter {
  state: ExecutionState;
  buildOpenTransaction(request: OpenTransactionRequest): Promise<never>;
  buildRedeemTransaction(request: RedeemTransactionRequest): Promise<never>;
  trackPositions(ownerAddress: string): Promise<[]>;
}

export const previewOnlyExecutionAdapter: ExecutionAdapter = {
  state: 'preview-only',
  async buildOpenTransaction() {
    throw new Error('Anker Protocol V1 is quote-and-preview only until the execution adapter is enabled.');
  },
  async buildRedeemTransaction() {
    throw new Error('Anker Protocol V1 is quote-and-preview only until the execution adapter is enabled.');
  },
  async trackPositions() {
    return [];
  },
};
