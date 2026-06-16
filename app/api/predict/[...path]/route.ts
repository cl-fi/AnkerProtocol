import { PREDICT_SERVER_URL } from '../../../../src/config/deepbook';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { path?: string[] } }) {
  const path = params.path?.join('/') ?? '';
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(`/${path}`, PREDICT_SERVER_URL);
  upstreamUrl.search = incomingUrl.search;

  const response = await fetch(upstreamUrl.toString(), {
    headers: {
      accept: 'application/json',
    },
    cache: 'no-store',
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/json',
    },
  });
}
