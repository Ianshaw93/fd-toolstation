// Server-side forwarding to the shared project directory API. Requires a valid add-in
// session (from cookie or session token). Calls the directory with a server-only service
// credential (TOOLSTATION_SERVICE_KEY) and forwards the signed-in user's email as audit context.

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { ADDIN_SESSION_COOKIE, verifySessionToken, type AddinSession } from './auth-session';

const DEFAULT_DIRECTORY_API_BASE = 'https://directory-api-production-7f250373.up.railway.app';

const SEARCH_PARAMS = ['q', 'include', 'limit', 'offset'] as const;

export function directoryApiBase(): string {
  return (process.env.DIRECTORY_API_BASE || DEFAULT_DIRECTORY_API_BASE).replace(/\/$/, '');
}

const DEV_SERVICE_KEY = 'toolstation-service-dev-key';

export function toolstationServiceKey(): string | null {
  const configured = process.env.TOOLSTATION_SERVICE_KEY;
  if (typeof configured === 'string' && configured.length > 0) return configured;
  if (process.env.NODE_ENV === 'production') return null;
  return DEV_SERVICE_KEY;
}

export function callerSession(req: NextRequest): AddinSession | null {
  // 1. Check session cookie
  const cookie = req.cookies.get(ADDIN_SESSION_COOKIE)?.value;
  const fromCookie = verifySessionToken(cookie);
  if (fromCookie) return fromCookie;

  // 2. Check Authorization Bearer header (session token)
  const auth = req.headers.get('authorization');
  if (auth && /^Bearer /i.test(auth)) {
    const fromBearer = verifySessionToken(auth.slice(7).trim());
    if (fromBearer) return fromBearer;
  }

  return null;
}

export function sessionRequired(): NextResponse {
  return NextResponse.json({ error: 'unauthorized', code: 'missing_session' }, { status: 401 });
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

export async function forwardToDirectory(url: string, userEmail: string): Promise<NextResponse> {
  const serviceKey = toolstationServiceKey();
  if (!serviceKey) {
    return NextResponse.json({ error: 'directory_not_configured' }, { status: 503 });
  }
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        'x-toolstation-key': serviceKey,
        'x-forwarded-user': userEmail,
      },
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
