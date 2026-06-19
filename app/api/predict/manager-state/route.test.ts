import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEEPBOOK_PREDICT } from '../../../../src/config/deepbook';
import { GET } from './route';

const MANAGER_ID = `0x${'a'.repeat(64)}`;
const ORACLE_ID = `0x${'b'.repeat(64)}`;

function rpcResponse(result: unknown) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), {
    headers: { 'content-type': 'application/json' },
  });
}

async function jsonRpcMethod(init?: RequestInit) {
  return JSON.parse(String(init?.body ?? '{}')).method as string;
}

describe('/api/predict/manager-state', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps dynamic field objects by object id instead of positional indexes', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const method = await jsonRpcMethod(init);
      if (method === 'sui_getObject') {
        return rpcResponse({
          data: {
            objectId: MANAGER_ID,
            content: {
              fields: {
                balance_manager: { fields: { balances: { fields: { id: '0xbalance-table' } } } },
                positions: { fields: { id: '0xposition-table' } },
              },
            },
          },
        });
      }

      if (method === 'suix_getDynamicFields') {
        const params = JSON.parse(String(init?.body ?? '{}')).params as unknown[];
        if (params[0] === '0xbalance-table') {
          return rpcResponse({
            data: [{ objectId: '0xbalance-object' }],
            hasNextPage: false,
            nextCursor: null,
          });
        }
        return rpcResponse({
          data: [
            { name: { value: { oracle_id: ORACLE_ID, expiry: '1781683200000', strike: '61000000000000', direction: '0' } } },
            {
              objectId: '0xposition-object',
              name: { value: { oracle_id: ORACLE_ID, expiry: '1781683200000', strike: '62000000000000', direction: '0' } },
            },
          ],
          hasNextPage: false,
          nextCursor: null,
        });
      }

      if (method === 'sui_multiGetObjects') {
        const params = JSON.parse(String(init?.body ?? '{}')).params as [string[]];
        if (params[0][0] === '0xposition-object') {
          return rpcResponse([
            {
              data: {
                objectId: '0xposition-object',
                content: { fields: { value: '1230000' } },
              },
            },
          ]);
        }
        if (params[0][0] === '0xbalance-object') {
          return rpcResponse([
            {
              data: {
                objectId: '0xbalance-object',
                content: {
                  fields: {
                    name: { type: DEEPBOOK_PREDICT.quoteAssetType },
                    value: '2500000',
                  },
                },
              },
            },
          ]);
        }
        return rpcResponse([]);
      }

      throw new Error(`Unexpected RPC method ${method}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(new Request(`http://localhost/api/predict/manager-state?managerId=${MANAGER_ID}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      managerId: MANAGER_ID,
      dusdcBalance: 2.5,
      dusdcBalanceBaseUnits: '2500000',
      positions: [
        {
          oracleId: ORACLE_ID,
          expiryMs: 1_781_683_200_000,
          strike: 62_000,
          isUp: true,
          quantity: 1.23,
          quantityBaseUnits: '1230000',
        },
      ],
    });
  });

  it('fails closed when a Predict position key contains invalid u64 fields', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const method = await jsonRpcMethod(init);
      if (method === 'sui_getObject') {
        return rpcResponse({
          data: {
            objectId: MANAGER_ID,
            content: {
              fields: {
                balance_manager: { fields: { balances: { fields: { id: '0xbalance-table' } } } },
                positions: { fields: { id: '0xposition-table' } },
              },
            },
          },
        });
      }

      if (method === 'suix_getDynamicFields') {
        const params = JSON.parse(String(init?.body ?? '{}')).params as unknown[];
        if (params[0] === '0xbalance-table') {
          return rpcResponse({ data: [], hasNextPage: false, nextCursor: null });
        }
        return rpcResponse({
          data: [
            {
              objectId: '0xposition-object',
              name: { value: { oracle_id: ORACLE_ID, expiry: 'not-a-u64', strike: '62000000000000', direction: '0' } },
            },
          ],
          hasNextPage: false,
          nextCursor: null,
        });
      }

      if (method === 'sui_multiGetObjects') {
        return rpcResponse([
          {
            data: {
              objectId: '0xposition-object',
              content: { fields: { value: '1230000' } },
            },
          },
        ]);
      }

      throw new Error(`Unexpected RPC method ${method}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(new Request(`http://localhost/api/predict/manager-state?managerId=${MANAGER_ID}`));
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toContain('Predict manager position expiry is not a u64 string.');
    expect(payload.positions).toEqual([]);
  });

  it('fails closed when DUSDC balance cannot be represented safely as a number', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const method = await jsonRpcMethod(init);
      if (method === 'sui_getObject') {
        return rpcResponse({
          data: {
            objectId: MANAGER_ID,
            content: {
              fields: {
                balance_manager: { fields: { balances: { fields: { id: '0xbalance-table' } } } },
                positions: { fields: { id: '0xposition-table' } },
              },
            },
          },
        });
      }

      if (method === 'suix_getDynamicFields') {
        const params = JSON.parse(String(init?.body ?? '{}')).params as unknown[];
        if (params[0] === '0xbalance-table') {
          return rpcResponse({
            data: [{ objectId: '0xbalance-object' }],
            hasNextPage: false,
            nextCursor: null,
          });
        }
        return rpcResponse({ data: [], hasNextPage: false, nextCursor: null });
      }

      if (method === 'sui_multiGetObjects') {
        return rpcResponse([
          {
            data: {
              objectId: '0xbalance-object',
              content: {
                fields: {
                  name: { type: DEEPBOOK_PREDICT.quoteAssetType },
                  value: `${BigInt(Number.MAX_SAFE_INTEGER) + 1n}`,
                },
              },
            },
          },
        ]);
      }

      throw new Error(`Unexpected RPC method ${method}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(new Request(`http://localhost/api/predict/manager-state?managerId=${MANAGER_ID}`));
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toContain('Predict manager DUSDC balance exceeds safe integer range.');
  });
});
