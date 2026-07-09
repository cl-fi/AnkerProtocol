import { PREDICT_SERVER_URL } from '../../../../src/config/deepbook';
import { isFixtureDataMode } from '../../../../src/config/runtimeModes';
import { deterministicPredictResponse } from '../../../../src/server/deterministicPredictFixtures';
import { isAllowedPredictProxyPath } from './allowlist';

export const dynamic = 'force-dynamic';

const PREDICT_PROXY_TIMEOUT_MS = 8_000;
const PREDICT_PROXY_MAX_BYTES = 1_000_000;
const PREDICT_PROXY_CACHE_CONTROL = 's-maxage=5, stale-while-revalidate=30';
const PREDICT_PROXY_RATE_LIMIT_WINDOW_MS = 60_000;
const PREDICT_PROXY_RATE_LIMIT_REQUESTS = 60;

type RateLimitBucket = {
  resetAtMs: number;
  count: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

function clientKeyForRequest(request: Request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'anonymous'
  );
}

function rateLimitResult(request: Request, nowMs = Date.now()) {
  const key = clientKeyForRequest(request);
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || nowMs >= bucket.resetAtMs) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAtMs: nowMs + PREDICT_PROXY_RATE_LIMIT_WINDOW_MS,
    });
    return { limited: false, retryAfterSeconds: 0 };
  }

  if (bucket.count >= PREDICT_PROXY_RATE_LIMIT_REQUESTS) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAtMs - nowMs) / 1_000)),
    };
  }

  bucket.count += 1;
  return { limited: false, retryAfterSeconds: 0 };
}

export async function GET(request: Request, { params }: { params: { path?: string[] } }) {
  const path = params.path?.join('/') ?? '';
  if (!isAllowedPredictProxyPath(path)) {
    return Response.json({ error: 'Predict endpoint is not allowed.' }, { status: 404 });
  }

  const rateLimit = rateLimitResult(request);
  if (rateLimit.limited) {
    return Response.json(
      { error: 'Predict proxy rate limit exceeded.' },
      {
        status: 429,
        headers: {
          'retry-after': String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  if (isFixtureDataMode()) {
    const fixture = deterministicPredictResponse(path);
    if (fixture) {
      return Response.json(fixture, {
        headers: {
          'cache-control': PREDICT_PROXY_CACHE_CONTROL,
        },
      });
    }
  }

  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(`/${path}`, PREDICT_SERVER_URL);
  upstreamUrl.search = incomingUrl.search;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PREDICT_PROXY_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(upstreamUrl.toString(), {
      headers: {
        accept: 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Predict upstream request failed.' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > PREDICT_PROXY_MAX_BYTES) {
    return Response.json({ error: 'Predict upstream response is too large.' }, { status: 502 });
  }

  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > PREDICT_PROXY_MAX_BYTES) {
    return Response.json({ error: 'Predict upstream response is too large.' }, { status: 502 });
  }

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/json',
      'cache-control': PREDICT_PROXY_CACHE_CONTROL,
    },
  });
}
