import { describe, expect, it } from 'vitest';
import { authorizeCronRequest } from '../../../../src/recorder/cronAuth';

// Route handler auth is the thin adapter; reuse the pure seam with Request-shaped headers.
describe('GET /api/cron/benchmark-recorder auth', () => {
  it('rejects requests without the cron secret', () => {
    expect(
      authorizeCronRequest({
        authorizationHeader: new Request('http://localhost/api/cron/benchmark-recorder').headers.get(
          'authorization',
        ),
        cronSecret: 'expected',
      }),
    ).toBe(false);
  });

  it('accepts Bearer CRON_SECRET the way Vercel Cron sends it', () => {
    const request = new Request('http://localhost/api/cron/benchmark-recorder', {
      headers: { authorization: 'Bearer expected' },
    });
    expect(
      authorizeCronRequest({
        authorizationHeader: request.headers.get('authorization'),
        cronSecret: 'expected',
      }),
    ).toBe(true);
  });
});
