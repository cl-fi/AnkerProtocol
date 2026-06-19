import { SuiJsonRpcClient, getJsonRpcFullnodeUrl, type EventId } from '@mysten/sui/jsonRpc';
import { useQuery } from '@tanstack/react-query';
import { SUI_NETWORK } from '../config/deepbook';
import { DEFAULT_ANKER_CONFIG } from '../sui/ankerTransactions';
import {
  buildProductNoteEventIndex,
  productNoteEventTypes,
  type ProductNoteEventIndex,
} from '../sui/productNoteEvents';

const PRODUCT_NOTE_EVENT_LIMIT = 100;

type ProductNoteEventClient = {
  queryEvents(input: {
    query: { MoveEventType: string };
    cursor?: EventId | null;
    order?: 'ascending' | 'descending';
    limit?: number;
  }): Promise<{ data?: unknown[]; hasNextPage?: boolean; nextCursor?: EventId | null }>;
};

const productNoteEventClient = new SuiJsonRpcClient({
  network: SUI_NETWORK,
  url: getJsonRpcFullnodeUrl(SUI_NETWORK),
});

function configuredPackageId(packageId: string) {
  return packageId.length > 0 && packageId !== '0x0';
}

function pushUnique(values: string[], value: string) {
  if (!values.includes(value)) values.push(value);
}

export function filterProductNoteEventIndex(index: ProductNoteEventIndex, noteIds: readonly string[]) {
  const byNoteId: ProductNoteEventIndex['byNoteId'] = {};
  const byOwner: ProductNoteEventIndex['byOwner'] = {};
  const byManagerId: ProductNoteEventIndex['byManagerId'] = {};

  for (const noteId of noteIds) {
    const entry = index.byNoteId[noteId];
    if (!entry) continue;
    byNoteId[noteId] = entry;
    if (entry.owner) {
      byOwner[entry.owner] ??= [];
      pushUnique(byOwner[entry.owner], noteId);
    }
    if (entry.managerId) {
      byManagerId[entry.managerId] ??= [];
      pushUnique(byManagerId[entry.managerId], noteId);
    }
  }

  return { byNoteId, byOwner, byManagerId };
}

export async function fetchProductNoteEventIndex(
  client: ProductNoteEventClient,
  packageId: string,
  limit = PRODUCT_NOTE_EVENT_LIMIT,
) {
  const eventsByType = await Promise.all(
    productNoteEventTypes(packageId).map(async (MoveEventType) => {
      const events: unknown[] = [];
      let cursor: EventId | null | undefined;

      do {
        const page = await client.queryEvents({
          query: { MoveEventType },
          cursor,
          order: 'descending',
          limit,
        });
        if (Array.isArray(page.data)) events.push(...page.data);
        cursor = page.hasNextPage ? (page.nextCursor ?? null) : null;
      } while (cursor);

      return events;
    }),
  );

  return buildProductNoteEventIndex(eventsByType.flat());
}

export function useProductNoteEventIndex(
  noteIds: readonly string[] | undefined,
  packageId = DEFAULT_ANKER_CONFIG.packageId,
  client: ProductNoteEventClient = productNoteEventClient,
) {
  const sortedNoteIds = [...(noteIds ?? [])].sort();

  return useQuery({
    queryKey: ['product-note-event-index', packageId, sortedNoteIds],
    queryFn: async () => filterProductNoteEventIndex(await fetchProductNoteEventIndex(client, packageId), sortedNoteIds),
    enabled: configuredPackageId(packageId) && sortedNoteIds.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
