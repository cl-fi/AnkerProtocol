import { fromChainPrice } from '../products/units';

export type AnkerProductNoteStatus = 'open' | 'redeemed';
export type AnkerProductNoteType = 'dual-investment' | 'shark-fin';

export interface AnkerProductNoteLeg {
  strike: number;
  quantity: number;
  cost: number;
}

export interface AnkerProductNoteRecord {
  noteId: string;
  productType: AnkerProductNoteType;
  productId: string;
  owner: string;
  managerId: string;
  oracleId: string;
  expiryMs: number;
  principal: number;
  reserve: number;
  coupon: number;
  targetPrice: number;
  floorPrice: number;
  lowerBound: number;
  upperBound: number;
  isBullish: boolean;
  usesMockCurrentDeposit: boolean;
  apr: number;
  feeBps: number;
  legs: AnkerProductNoteLeg[];
  status: AnkerProductNoteStatus;
  redeemedPayout: number;
  redeemedFee: number;
}

export interface AnkerPortfolioConfig {
  packageId: string;
  quoteAssetDecimals: number;
}

type UnknownRecord = Record<string, unknown>;

export function productNoteType(packageId: string) {
  return `${packageId}::product_note::ProductNote`;
}

function scaleForDecimals(decimals: number) {
  return 10 ** decimals;
}

function quoteAmount(value: unknown, decimals: number) {
  return Number(asString(value) || 0) / scaleForDecimals(decimals);
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object' && 'id' in value) {
    return asString((value as { id: unknown }).id);
  }
  return '';
}

function asNumber(value: unknown): number {
  return Number(asString(value) || 0);
}

function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return asString(value) === 'true';
}

function asVector(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function decodeProductId(value: unknown): string {
  if (typeof value === 'string') return decodeBase64ProductId(value) ?? value;
  const bytes = asVector(value).map((byte) => Number(byte));
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function decodeBase64ProductId(value: string): string | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 === 1) {
    return null;
  }

  try {
    const decoded = atob(value);
    const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    if (!/^[\x20-\x7E]+$/.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}

function getObjectType(object: unknown): string {
  const record = object as UnknownRecord;
  const data = record.data as UnknownRecord | undefined;
  return asString(record.type ?? record.objType ?? data?.type);
}

function getObjectId(object: unknown): string {
  const record = object as UnknownRecord;
  const data = record.data as UnknownRecord | undefined;
  return asString(record.objectId ?? data?.objectId);
}

function getObjectFields(object: unknown): UnknownRecord | null {
  const record = object as UnknownRecord;
  if (record.json && typeof record.json === 'object') {
    return record.json as UnknownRecord;
  }

  if (record.content && typeof record.content === 'object') {
    return record.content as UnknownRecord;
  }

  const data = record.data as UnknownRecord | undefined;
  const content = data?.content as UnknownRecord | undefined;
  if (content?.fields && typeof content.fields === 'object') {
    return content.fields as UnknownRecord;
  }

  return null;
}

function productTypeFromKind(kind: number): AnkerProductNoteType {
  return kind === 1 ? 'shark-fin' : 'dual-investment';
}

function statusFromValue(status: number): AnkerProductNoteStatus {
  return status === 1 ? 'redeemed' : 'open';
}

export function parseOwnedProductNotes(
  objects: unknown[],
  config: AnkerPortfolioConfig,
): AnkerProductNoteRecord[] {
  const noteType = productNoteType(config.packageId);

  return objects.flatMap((object) => {
    if (getObjectType(object) !== noteType) return [];
    const fields = getObjectFields(object);
    if (!fields) return [];

    const strikes = asVector(fields.strikes);
    const quantities = asVector(fields.quantities);
    const costs = asVector(fields.costs);

    return [
      {
        noteId: getObjectId(object),
        productType: productTypeFromKind(asNumber(fields.product_kind)),
        productId: decodeProductId(fields.product_id),
        owner: asString(fields.owner),
        managerId: asString(fields.manager_id),
        oracleId: asString(fields.oracle_id),
        expiryMs: asNumber(fields.expiry_ms),
        principal: quoteAmount(fields.principal_amount, config.quoteAssetDecimals),
        reserve: quoteAmount(fields.reserve_amount, config.quoteAssetDecimals),
        coupon: quoteAmount(fields.coupon_amount, config.quoteAssetDecimals),
        targetPrice: fromChainPrice(asString(fields.target_price)),
        floorPrice: fromChainPrice(asString(fields.floor_price)),
        lowerBound: fromChainPrice(asString(fields.lower_bound)),
        upperBound: fromChainPrice(asString(fields.upper_bound)),
        isBullish: asBoolean(fields.is_bullish),
        usesMockCurrentDeposit: asBoolean(fields.uses_mock_current_deposit),
        apr: asNumber(fields.apr_bps) / 10_000,
        feeBps: asNumber(fields.fee_bps),
        legs: strikes.map((strike, index) => ({
          strike: fromChainPrice(asString(strike)),
          quantity: quoteAmount(quantities[index], config.quoteAssetDecimals),
          cost: quoteAmount(costs[index], config.quoteAssetDecimals),
        })),
        status: statusFromValue(asNumber(fields.status)),
        redeemedPayout: quoteAmount(fields.redeemed_payout_amount, config.quoteAssetDecimals),
        redeemedFee: quoteAmount(fields.redeemed_fee_amount, config.quoteAssetDecimals),
      },
    ];
  });
}
