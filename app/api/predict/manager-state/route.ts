import { DEEPBOOK_PREDICT, TESTNET_GRPC_URL } from '../../../../src/config/deepbook';
import { fromChainPrice } from '../../../../src/products/units';
import type { PredictManagerPosition, PredictManagerState } from '../../../../src/sui/predictManagerState';

export const dynamic = 'force-dynamic';

type UnknownRecord = Record<string, unknown>;

interface JsonRpcResponse<T> {
  result?: T;
  error?: { message?: string; code?: number };
}

interface DynamicFieldPage {
  data?: Array<{ objectId?: string; objectType?: string; name?: unknown }>;
  nextCursor?: string | null;
  hasNextPage?: boolean;
}

interface SuiObjectResponse {
  data?: {
    objectId?: string;
    content?: {
      fields?: UnknownRecord;
    };
  };
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' ? (value as UnknownRecord) : null;
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return String(value);
  const record = asRecord(value);
  if (record && 'id' in record) return asString(record.id);
  return '';
}

function tableId(value: unknown): string {
  const record = asRecord(value);
  if (!record) return '';
  return asString(asRecord(record.fields)?.id ?? record.id);
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(TESTNET_GRPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
  });
  const payload = (await response.json()) as JsonRpcResponse<T>;
  if (payload.error) {
    throw new Error(payload.error.message ?? `Sui RPC ${method} failed.`);
  }
  if (!payload.result) {
    throw new Error(`Sui RPC ${method} returned an empty result.`);
  }
  return payload.result;
}

async function listDynamicFields(tableObjectId: string) {
  const fields: NonNullable<DynamicFieldPage['data']> = [];
  let cursor: string | null | undefined;

  do {
    const page = await rpc<DynamicFieldPage>('suix_getDynamicFields', [tableObjectId, cursor ?? null, 50]);
    fields.push(...(page.data ?? []));
    cursor = page.hasNextPage ? (page.nextCursor ?? null) : null;
  } while (cursor);

  return fields;
}

async function multiGetObjects(objectIds: string[]) {
  if (objectIds.length === 0) return [];
  return rpc<SuiObjectResponse[]>('sui_multiGetObjects', [objectIds, { showContent: true }]);
}

function managerTables(managerObject: SuiObjectResponse) {
  const fields = managerObject.data?.content?.fields ?? {};
  const balanceManager = asRecord(fields.balance_manager);
  const balanceManagerFields = asRecord(balanceManager?.fields);
  const balanceTableId = tableId(balanceManagerFields?.balances);
  const positionsTableId = tableId(fields.positions);

  if (!balanceTableId || !positionsTableId) {
    throw new Error('Predict manager object is missing balance or position tables.');
  }

  return { balanceTableId, positionsTableId };
}

function parseDusdcBalance(objects: SuiObjectResponse[]) {
  const dusdcObject = objects.find((object) => {
    const name = object.data?.content?.fields?.name;
    const type = asString(asRecord(name)?.type);
    return type.includes(DEEPBOOK_PREDICT.quoteAssetType);
  });
  const value = asString(dusdcObject?.data?.content?.fields?.value);
  return value ? Number(value) / 10 ** DEEPBOOK_PREDICT.quoteAssetDecimals : 0;
}

function parsePosition(field: { name?: unknown }, object: SuiObjectResponse): PredictManagerPosition | null {
  const name = asRecord(field.name);
  const value = asRecord(name?.value) ?? asRecord(asRecord(object.data?.content?.fields?.name)?.fields);
  if (!value) return null;

  const quantity = Number(asString(object.data?.content?.fields?.value) || 0) / 10 ** DEEPBOOK_PREDICT.quoteAssetDecimals;
  return {
    oracleId: asString(value.oracle_id),
    expiryMs: Number(asString(value.expiry) || 0),
    strike: fromChainPrice(asString(value.strike)),
    isUp: Number(asString(value.direction) || 0) === 0,
    quantity,
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const managerId = url.searchParams.get('managerId') ?? '';
    if (!/^0x[0-9a-fA-F]+$/.test(managerId)) {
      return Response.json({ error: 'managerId must be a Sui object id.' }, { status: 400 });
    }

    const managerObject = await rpc<SuiObjectResponse>('sui_getObject', [managerId, { showContent: true }]);
    const { balanceTableId, positionsTableId } = managerTables(managerObject);

    const [balanceFields, positionFields] = await Promise.all([
      listDynamicFields(balanceTableId),
      listDynamicFields(positionsTableId),
    ]);
    const [balanceObjects, positionObjects] = await Promise.all([
      multiGetObjects(balanceFields.flatMap((field) => (field.objectId ? [field.objectId] : []))),
      multiGetObjects(positionFields.flatMap((field) => (field.objectId ? [field.objectId] : []))),
    ]);

    const positions = positionFields.flatMap((field, index) => {
      const position = parsePosition(field, positionObjects[index]);
      return position ? [position] : [];
    });

    const state: PredictManagerState = {
      managerId,
      dusdcBalance: parseDusdcBalance(balanceObjects),
      positions,
      generatedAt: Date.now(),
    };

    return Response.json(state);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Predict manager state request failed.',
        managerId: new URL(request.url).searchParams.get('managerId') ?? '',
        dusdcBalance: null,
        positions: [],
        generatedAt: Date.now(),
      },
      { status: 502 },
    );
  }
}
