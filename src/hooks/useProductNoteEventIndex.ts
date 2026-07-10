import { useQuery } from '@tanstack/react-query';
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
    cursor?: unknown;
    order?: 'ascending' | 'descending';
    limit?: number;
  }): Promise<{ data?: unknown[]; hasNextPage?: boolean; nextCursor?: unknown }>;
};

/** Empty client — JSON-RPC event indexing was removed (D7); GraphQL path is #9. */
const disabledProductNoteEventClient: ProductNoteEventClient = {
  async queryEvents() {
    return { data: [], hasNextPage: false, nextCursor: null };
  },
};

function configuredPackageId(packageId: string) {
  return packageId.length > 0 && packageId !== '0x0';
}

function pushUnique(values: string[], value: string) {
  if (!values.includes(value)) values.push(value);
}

export function filterProductNoteEventIndex(index: ProductNoteEventIndex, noteIds: readonly string[]) {
  const byNoteId: ProductNoteEventIndex['byNoteId'] = {};
  const byOwner: ProductNoteEventIndex['byOwner'] = {};
  const byWrapperId: ProductNoteEventIndex['byWrapperId'] = {};

  for (const noteId of noteIds) {
    const entry = index.byNoteId[noteId];
    if (!entry) continue;
    byNoteId[noteId] = entry;
    if (entry.owner) {
      byOwner[entry.owner] ??= [];
      pushUnique(byOwner[entry.owner], noteId);
    }
    if (entry.wrapperId) {
      byWrapperId[entry.wrapperId] ??= [];
      pushUnique(byWrapperId[entry.wrapperId], noteId);
    }
  }

  return { byNoteId, byOwner, byWrapperId };
}

export async function fetchProductNoteEventIndex(
  client: ProductNoteEventClient,
  packageId: string,
  limit = PRODUCT_NOTE_EVENT_LIMIT,
) {
  const eventsByType = await Promise.all(
    productNoteEventTypes(packageId).map(async (MoveEventType) => {
      const events: unknown[] = [];
      let cursor: unknown;

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
  client: ProductNoteEventClient = disabledProductNoteEventClient,
) {
  const sortedNoteIds = [...(noteIds ?? [])].sort();

  return useQuery({
    queryKey: ['product-note-event-index', packageId, sortedNoteIds],
    queryFn: async () =>
      filterProductNoteEventIndex(await fetchProductNoteEventIndex(client, packageId), sortedNoteIds),
    enabled: configuredPackageId(packageId) && sortedNoteIds.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
