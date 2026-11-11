// Server-side calls to the shared project directory. The browser never receives a Synergy key.
// Only the caller's own bearer token is forwarded; the directory checks it is a delegated
// access_as_user token for the FD tenant and answers 401 (or 503 when not configured).

import { NextResponse } from 'next/server';

const DEFAULT_DIRECTORY_API_BASE = 'https://directory-api-production-7f250373.up.railway.app';

export function directoryApiBase(): string {
  return (process.env.DIRECTORY_API_BASE || DEFAULT_DIRECTORY_API_BASE).replace(/\/$/, '');
}

export function callerAuthorization(header: string | null): string | null {
  const value = header?.trim() ?? '';
  return /^Bearer [A-Za-z0-9\-_.~+/]+=*$/.test(value) ? value : null;
}

export function directorySearchUrl(query: string): string {
  return `${directoryApiBase()}/v1/projects${query ? `?${query}` : ''}`;
}

/** `synergy:<organisation>:<project>` is the directory's project id. */
export function directoryPrefillUrl(orgId: string, projectId: string): string | null {
  if (!/^\d+$/.test(orgId) || !/^\d+$/.test(projectId)) return null;
  return `${directoryApiBase()}/v1/projects/synergy:${orgId}:${projectId}/fee-proposal-prefill`;
}

export function signInRequired(): NextResponse {
  return NextResponse.json({ error: 'unauthorized', code: 'sign_in_required' }, { status: 401 });
}

export async function forwardToDirectory(url: string, authorization: string): Promise<NextResponse> {
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: { Accept: 'application/json', Authorization: authorization },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'directory_unreachable' }, { status: 502 });
  }
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}
