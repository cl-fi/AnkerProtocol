import { describe, expect, it } from 'vitest';
import { parsePredictManagers } from './predictManagers';

describe('parsePredictManagers', () => {
  it('normalizes manager ids from Predict server responses', () => {
    expect(
      parsePredictManagers([
        { manager_id: '0x1', owner: '0xa' },
        { managerId: '0x2' },
        { id: '0x3' },
        { object_id: '0x4' },
        { manager_id: '' },
        null,
      ]),
    ).toEqual([
      { managerId: '0x1', owner: '0xa' },
      { managerId: '0x2' },
      { managerId: '0x3' },
      { managerId: '0x4' },
    ]);
  });

  it('returns an empty list for non-array payloads', () => {
    expect(parsePredictManagers({ manager_id: '0x1' })).toEqual([]);
  });
});
