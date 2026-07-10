import { bcs } from '@mysten/sui/bcs';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { DEEPBOOK_PREDICT, SUI_GRPC_URL, SUI_NETWORK } from '../config/deepbook';
import {
  parseBlockScholesForwardObservation,
  parseBlockScholesSpotObservation,
  parseBlockScholesSviObservation,
  type PropbookForwardRead,
  type PropbookSpotRead,
  type PropbookSviRead,
} from './propbookOracle';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

let sharedClient: SuiGrpcClient | null = null;

function grpcClient() {
  if (!sharedClient) {
    sharedClient = new SuiGrpcClient({ network: SUI_NETWORK, baseUrl: SUI_GRPC_URL });
  }
  return sharedClient;
}

async function readObjectJson(objectId: string): Promise<UnknownRecord | null> {
  const { object } = await grpcClient().core.getObject({
    objectId,
    include: { json: true, content: true },
  });
  const json = object.json ? await object.json : null;
  return isRecord(json) ? json : null;
}

function tableIdFromFeed(feedJson: UnknownRecord): string | null {
  const expiries = feedJson.expiries;
  if (!isRecord(expiries)) return null;
  return typeof expiries.id === 'string' ? expiries.id : null;
}

async function readExpiryLaneJson(tableId: string, expiryMs: number): Promise<UnknownRecord | null> {
  const nameBcs = bcs.u64().serialize(BigInt(expiryMs)).toBytes();
  const { dynamicField } = await grpcClient().core.getDynamicField({
    parentId: tableId,
    name: { type: 'u64', bcs: nameBcs },
  });
  const { object } = await grpcClient().core.getObject({
    objectId: dynamicField.fieldId,
    include: { json: true },
  });
  const json = object.json ? await object.json : null;
  if (!isRecord(json)) return null;
  const value = json.value;
  return isRecord(value) ? value : null;
}

export async function fetchBlockScholesSpot(): Promise<PropbookSpotRead | null> {
  const json = await readObjectJson(DEEPBOOK_PREDICT.feeds.blockScholesSpot);
  if (!json) return null;
  return parseBlockScholesSpotObservation(json);
}

export async function fetchBlockScholesForward(expiryMs: number): Promise<PropbookForwardRead | null> {
  const feed = await readObjectJson(DEEPBOOK_PREDICT.feeds.blockScholesForward);
  if (!feed) return null;
  const tableId = tableIdFromFeed(feed);
  if (!tableId) return null;
  const lane = await readExpiryLaneJson(tableId, expiryMs);
  if (!lane) return null;
  return parseBlockScholesForwardObservation(lane);
}

export async function fetchBlockScholesSvi(expiryMs: number): Promise<PropbookSviRead | null> {
  const feed = await readObjectJson(DEEPBOOK_PREDICT.feeds.blockScholesSvi);
  if (!feed) return null;
  const tableId = tableIdFromFeed(feed);
  if (!tableId) return null;
  const lane = await readExpiryLaneJson(tableId, expiryMs);
  if (!lane) return null;
  return parseBlockScholesSviObservation(lane);
}
