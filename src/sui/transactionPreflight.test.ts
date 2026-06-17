import { Transaction } from '@mysten/sui/transactions';
import { describe, expect, it, vi } from 'vitest';
import { preflightTransaction } from './transactionPreflight';

const SENDER = `0x${'a'.repeat(64)}`;

describe('preflightTransaction', () => {
  it('uses Sui core transaction simulation when available', async () => {
    const tx = new Transaction();
    const simulateTransaction = vi.fn().mockResolvedValue({
      $kind: 'Transaction',
      Transaction: { status: { success: true, error: null } },
    });

    const result = await preflightTransaction({
      client: { simulateTransaction },
      sender: SENDER,
      transaction: tx,
    });

    expect(simulateTransaction).toHaveBeenCalledWith({
      transaction: tx,
      checksEnabled: true,
      include: { effects: true },
    });
    expect(result).toEqual({ status: 'success', engine: 'simulateTransaction' });
  });

  it('throws a readable error when simulation returns a failed transaction', async () => {
    const tx = new Transaction();
    const simulateTransaction = vi.fn().mockResolvedValue({
      $kind: 'FailedTransaction',
      FailedTransaction: {
        status: {
          success: false,
          error: { message: 'MoveAbort in predict::mint: EPriceOutOfBounds' },
        },
      },
    });

    await expect(
      preflightTransaction({
        client: { simulateTransaction },
        sender: SENDER,
        transaction: tx,
      }),
    ).rejects.toThrow('Preflight failed: MoveAbort in predict::mint: EPriceOutOfBounds');
  });

  it('falls back to JSON-RPC dev inspect clients used by scripts', async () => {
    const tx = new Transaction();
    const devInspectTransactionBlock = vi.fn().mockResolvedValue({
      effects: { status: { status: 'success' } },
    });

    const result = await preflightTransaction({
      client: { devInspectTransactionBlock },
      sender: SENDER,
      transaction: tx,
    });

    expect(devInspectTransactionBlock).toHaveBeenCalledWith({
      sender: SENDER,
      transactionBlock: tx,
    });
    expect(result).toEqual({ status: 'success', engine: 'devInspectTransactionBlock' });
  });

  it('skips preflight when the client does not expose a simulation API', async () => {
    const result = await preflightTransaction({
      client: {},
      sender: SENDER,
      transaction: new Transaction(),
    });

    expect(result.status).toBe('skipped');
  });
});
