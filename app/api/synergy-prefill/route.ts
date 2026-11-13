import { NextRequest, NextResponse } from 'next/server';

const DIRECTORY_API_URL = (
  process.env.DIRECTORY_API_BASE ||
  process.env.DIRECTORY_API_URL ||
  process.env.NEXT_PUBLIC_DIRECTORY_API_URL ||
  'https://directory-api-production-7f250373.up.railway.app'
).replace(/\/+$/, '');

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get('ref')?.trim();
  if (!ref) {
    return NextResponse.json({ error: 'Missing ref query parameter' }, { status: 400 });
  }

  const headers: Record<string, string> = {};
  const serviceKey = process.env.TOOLSTATION_SERVICE_KEY;
  if (serviceKey) {
    headers['x-toolstation-key'] = serviceKey;
  } else {
    const auth = request.headers.get('authorization');
    if (auth) headers['authorization'] = auth;
  }

  const refresh = request.nextUrl.searchParams.get('refresh') === '1' ? '?refresh=1' : '';
  const upstreamUrl = `${DIRECTORY_API_URL}/v1/projects/${encodeURIComponent(ref)}/fee-proposal-prefill${refresh}`;

  try {
    const res = await fetch(upstreamUrl, { headers, cache: 'no-store' });
    const body = await res.json().catch(() => ({ error: `Upstream HTTP ${res.status}` }));
    return NextResponse.json(body, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to reach directory-api' },
      { status: 502 },
    );
  }
}
