import type { Transaction } from '@mysten/sui/transactions';

export type PreflightEngine = 'simulateTransaction' | 'devInspectTransactionBlock';

export type TransactionPreflightResult =
  | { status: 'success'; engine: PreflightEngine }
  | { status: 'skipped'; reason: string };

interface TransactionPreflightInput {
  client: unknown;
  sender: string;
  transaction: Transaction;
}

interface SimulateClient {
  simulateTransaction: (input: {
    transaction: Transaction;
    checksEnabled: true;
    include: { effects: true };
  }) => Promise<unknown>;
}

interface DevInspectClient {
  devInspectTransactionBlock: (input: {
    sender: string;
    transactionBlock: Transaction;
  }) => Promise<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function messageFromError(error: unknown): string | null {
  if (!isRecord(error)) return null;
  if (typeof error.message === 'string') return error.message;
  if (typeof error.description === 'string') return error.description;
  return null;
}

function statusError(status: unknown): string | null {
  if (!isRecord(status)) return null;

  if (status.success === false) {
    return messageFromError(status.error) ?? 'Transaction simulation failed.';
  }

  if (status.status === 'failure') {
    const error = status.error;
    if (typeof error === 'string') return error;
    return messageFromError(error) ?? 'Transaction simulation failed.';
  }

  return null;
}

function simulatedTransactionError(result: unknown): string | null {
  if (!isRecord(result)) return null;

  if (result.$kind === 'FailedTransaction') {
    const failed = isRecord(result.FailedTransaction) ? result.FailedTransaction : null;
    return statusError(failed?.status) ?? 'Transaction simulation failed.';
  }

  if (result.$kind === 'Transaction') {
    const transaction = isRecord(result.Transaction) ? result.Transaction : null;
    return statusError(transaction?.status);
  }

  const effects = isRecord(result.effects) ? result.effects : null;
  return statusError(effects?.status);
}

function hasSimulator(client: unknown): client is SimulateClient {
  return isRecord(client) && typeof client.simulateTransaction === 'function';
}

function hasDevInspect(client: unknown): client is DevInspectClient {
  return isRecord(client) && typeof client.devInspectTransactionBlock === 'function';
}

function assertPreflightSuccess(result: unknown) {
  const error = simulatedTransactionError(result);
  if (error) {
    throw new Error(`Preflight failed: ${error}`);
  }
}

function allowsUnsimulatedTransactions() {
  return (
    process.env.DEMO_ALLOW_UNSIMULATED_TX === 'true' ||
    process.env.NEXT_PUBLIC_DEMO_ALLOW_UNSIMULATED_TX === 'true'
  );
}

export async function preflightTransaction({
  client,
  sender,
  transaction,
}: TransactionPreflightInput): Promise<TransactionPreflightResult> {
  if (hasSimulator(client)) {
    const result = await client.simulateTransaction({
      transaction,
      checksEnabled: true,
      include: { effects: true },
    });
    assertPreflightSuccess(result);
    return { status: 'success', engine: 'simulateTransaction' };
  }

  if (hasDevInspect(client)) {
    const result = await client.devInspectTransactionBlock({
      sender,
      transactionBlock: transaction,
    });
    assertPreflightSuccess(result);
    return { status: 'success', engine: 'devInspectTransactionBlock' };
  }

  if (allowsUnsimulatedTransactions()) {
    return {
      status: 'skipped',
      reason: 'Current Sui client does not expose transaction simulation.',
    };
  }

  throw new Error(
    'Transaction simulation is unavailable. Set DEMO_ALLOW_UNSIMULATED_TX=true only for local demo bypasses.',
  );
}
