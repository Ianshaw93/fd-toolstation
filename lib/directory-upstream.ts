// Server-side forwarding to the shared project directory API. Only the caller's own bearer
// token is forwarded (no cookies, no Synergy key); the directory decides whether it is a
// delegated access_as_user token for the FD tenant and answers 401 / 403 / 503 itself.

import { NextResponse } from 'next/server';

const DEFAULT_DIRECTORY_API_BASE = 'https://directory-api-production-7f250373.up.railway.app';

const SEARCH_PARAMS = ['q', 'include', 'limit', 'offset'] as const;

export function directoryApiBase(): string {
  return (process.env.DIRECTORY_API_BASE || DEFAULT_DIRECTORY_API_BASE).replace(/\/$/, '');
}

export function callerAuthorization(header: string | null): string | null {
  const value = header?.trim() ?? '';
  return /^Bearer [A-Za-z0-9\-_.~+/]+=*$/i.test(value) ? `Bearer ${value.slice(7)}` : null;
}

export function directorySearchUrl(params: URLSearchParams): string {
  const forwarded = new URLSearchParams();
  for (const key of SEARCH_PARAMS) {
    const value = params.get(key);
    if (value !== null) forwarded.set(key, value);
  }
  const query = forwarded.toString();
  return `${directoryApiBase()}/v1/projects${query ? `?${query}` : ''}`;
}

export function directoryPrefillUrl(id: string): string {
  return `${directoryApiBase()}/v1/projects/${encodeURIComponent(id)}/fee-proposal-prefill`;
}

export function signInRequired(): NextResponse {
  return NextResponse.json({ error: 'unauthorized', code: 'missing_token' }, { status: 401 });
}

export async function forwardToDirectory(url: string, authorization: string): Promise<NextResponse> {
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: { Accept: 'application/json', Authorization: authorization },
      cache: 'no-store',
      redirect: 'error',
    });
  } catch {
    return NextResponse.json({ error: 'directory_unreachable' }, { status: 502 });
  }
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'private, no-store',
    },
  });
}
