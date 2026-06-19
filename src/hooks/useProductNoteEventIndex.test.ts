import { describe, expect, it, vi } from 'vitest';
import { buildProductNoteEventIndex, productNoteEventTypes } from '../sui/productNoteEvents';
import { fetchProductNoteEventIndex, filterProductNoteEventIndex } from './useProductNoteEventIndex';

const PACKAGE_ID = `0x${'1'.repeat(64)}`;
const NOTE_ID = `0x${'2'.repeat(64)}`;
const OTHER_NOTE_ID = `0x${'5'.repeat(64)}`;
const OWNER = `0x${'a'.repeat(64)}`;
const MANAGER_ID = `0x${'3'.repeat(64)}`;

function eventFixture(typeName: string, txDigest: string, parsedJson: Record<string, unknown>) {
  return {
    id: { txDigest, eventSeq: '0' },
    type: `${PACKAGE_ID}::product_note::${typeName}`,
    parsedJson,
  };
}

describe('fetchProductNoteEventIndex', () => {
  it('queries ProductNote Move event types and builds a note-indexed lifecycle map', async () => {
    const queryEvents = vi.fn(async ({ query }: { query: { MoveEventType: string } }) => ({
      data: query.MoveEventType.endsWith('ProductSubscribed')
        ? [
            eventFixture('ProductSubscribed', '0xsubscribe', {
              note_id: NOTE_ID,
              owner: `0x${'a'.repeat(64)}`,
              manager_id: `0x${'3'.repeat(64)}`,
              oracle_id: `0x${'4'.repeat(64)}`,
            }),
          ]
        : [],
      hasNextPage: false,
      nextCursor: null,
    }));

    const index = await fetchProductNoteEventIndex({ queryEvents }, PACKAGE_ID);

    expect(queryEvents).toHaveBeenCalledTimes(2);
    expect(queryEvents.mock.calls.map(([input]) => input.query.MoveEventType)).toEqual(productNoteEventTypes(PACKAGE_ID));
    expect(index.byNoteId[NOTE_ID]?.subscriptionDigest).toBe('0xsubscribe');
  });

  it('paginates each ProductNote event type until nextCursor is exhausted', async () => {
    const pageTwoCursor = { txDigest: '0xpage1', eventSeq: '0' };
    const seenCursors: Array<typeof pageTwoCursor | null | undefined> = [];
    const queryEvents = vi.fn(
      async ({
        query,
        cursor,
      }: {
        query: { MoveEventType: string };
        cursor?: typeof pageTwoCursor | null;
      }) => {
        if (!query.MoveEventType.endsWith('ProductSubscribed')) {
          return { data: [], hasNextPage: false, nextCursor: null };
        }

        seenCursors.push(cursor);
        if (!cursor) {
          return { data: [], hasNextPage: true, nextCursor: pageTwoCursor };
        }

        return {
          data: [
            eventFixture('ProductSubscribed', '0xsubscribe-page-2', {
              note_id: NOTE_ID,
              owner: OWNER,
              manager_id: MANAGER_ID,
              oracle_id: `0x${'4'.repeat(64)}`,
            }),
          ],
          hasNextPage: false,
          nextCursor: null,
        };
      },
    );

    const index = await fetchProductNoteEventIndex({ queryEvents }, PACKAGE_ID);

    expect(seenCursors).toEqual([undefined, pageTwoCursor]);
    expect(index.byNoteId[NOTE_ID]?.subscriptionDigest).toBe('0xsubscribe-page-2');
  });

  it('filters the event index without dropping owner and manager maps for retained notes', () => {
    const index = buildProductNoteEventIndex([
      eventFixture('ProductSubscribed', '0xsubscribe', {
        note_id: NOTE_ID,
        owner: OWNER,
        manager_id: MANAGER_ID,
        oracle_id: `0x${'4'.repeat(64)}`,
      }),
      eventFixture('ProductSubscribed', '0xother', {
        note_id: OTHER_NOTE_ID,
        owner: OWNER,
        manager_id: `0x${'6'.repeat(64)}`,
        oracle_id: `0x${'7'.repeat(64)}`,
      }),
    ]);

    const filtered = filterProductNoteEventIndex(index, [NOTE_ID]);

    expect(Object.keys(filtered.byNoteId)).toEqual([NOTE_ID]);
    expect(filtered.byOwner[OWNER]).toEqual([NOTE_ID]);
    expect(filtered.byManagerId[MANAGER_ID]).toEqual([NOTE_ID]);
  });
});
