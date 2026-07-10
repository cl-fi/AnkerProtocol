import { PROPBOOK_SERVER_URL } from '../../../../src/config/deepbook';
import { isAllowedPropbookProxyPath } from './allowlist';

export const dynamic = 'force-dynamic';

const PROPBOOK_PROXY_TIMEOUT_MS = 8_000;
const PROPBOOK_PROXY_MAX_BYTES = 1_000_000;
const PROPBOOK_PROXY_CACHE_CONTROL = 's-maxage=5, stale-while-revalidate=30';

export async function GET(request: Request, { params }: { params: { path?: string[] } }) {
  const path = params.path?.join('/') ?? '';
  if (!isAllowedPropbookProxyPath(path)) {
    return Response.json({ error: 'Propbook endpoint is not allowed.' }, { status: 404 });
  }

  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(`/${path}`, PROPBOOK_SERVER_URL);
  upstreamUrl.search = incomingUrl.search;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROPBOOK_PROXY_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(upstreamUrl.toString(), {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Propbook upstream request failed.' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > PROPBOOK_PROXY_MAX_BYTES) {
    return Response.json({ error: 'Propbook upstream response is too large.' }, { status: 502 });
  }

  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > PROPBOOK_PROXY_MAX_BYTES) {
    return Response.json({ error: 'Propbook upstream response is too large.' }, { status: 502 });
  }

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/json',
      'cache-control': PROPBOOK_PROXY_CACHE_CONTROL,
    },
  });
}
