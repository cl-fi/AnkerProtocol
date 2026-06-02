import { describe, expect, it } from 'vitest';
import { formatTimeToExpiry } from './timeFormat';

describe('formatTimeToExpiry', () => {
  it('formats expiry as days, hours, and minutes', () => {
    const now = Date.UTC(2026, 5, 1, 0, 0, 0);
    const expiry = now + 10 * 86_400_000 + 16 * 3_600_000 + 42 * 60_000;

    expect(formatTimeToExpiry(expiry, now)).toBe('10d 16h 42m');
  });

  it('keeps the day unit visible for sub-day expiries', () => {
    const now = Date.UTC(2026, 5, 1, 0, 0, 0);
    const expiry = now + 3 * 3_600_000 + 7 * 60_000;

    expect(formatTimeToExpiry(expiry, now)).toBe('0d 3h 7m');
  });
});
