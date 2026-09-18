/**
 * Server-side ingest for tool-search analytics.
 * Enriches nullable identity from Easy Auth / Entra / Access headers when present,
 * then forwards to Railway. Missing backend tables must not 500 the homepage.
 */

export type Identity = { userId: string | null; userEmail: string | null };

const DEFAULT_BACKEND = 'https://backendfornextapp-production.up.railway.app';

export function identityFromHeaders(headers: Headers): Identity {
  const email =
    headers.get('x-ms-client-principal-name') ||
    headers.get('x-forwarded-email') ||
    headers.get('cf-access-authenticated-user-email') ||
    null;
  const userId = headers.get('x-ms-client-principal-id') || headers.get('x-forwarded-user') || null;
  return { userId, userEmail: email };
}

export function backendOrigin(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    DEFAULT_BACKEND
  ).replace(/\/$/, '');
}

export function backendPath(kind: 'log' | 'click'): string {
  return kind === 'log' ? '/tool-search/logs' : '/tool-search/clicks';
}

export function enrichEvent(body: Record<string, unknown>, identity: Identity): Record<string, unknown> {
  return {
    ...body,
    userId: body.userId || identity.userId,
    userEmail: body.userEmail || identity.userEmail,
  };
}

export function isLogEvent(body: unknown): body is Record<string, unknown> {
  if (!body || typeof body !== 'object') return false;
  const event = body as Record<string, unknown>;
  return typeof event.clientSearchId === 'string' && event.clientSearchId.length > 0 && typeof event.query === 'string';
}

export function isClickEvent(body: unknown): body is Record<string, unknown> {
  if (!body || typeof body !== 'object') return false;
  const event = body as Record<string, unknown>;
  return (
    typeof event.clientSearchId === 'string' &&
    event.clientSearchId.length > 0 &&
    typeof event.partId === 'string' &&
    event.partId.length > 0
  );
}

export async function forwardToolSearchEvent(
  kind: 'log' | 'click',
  body: Record<string, unknown>,
  headers: Headers,
  post: typeof fetch = fetch,
): Promise<{ forwarded: boolean }> {
  const payload = enrichEvent(body, identityFromHeaders(headers));
  const url = `${backendOrigin()}${backendPath(kind)}`;
  const signal =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(2500)
      : undefined;
  try {
    const res = await post(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      ...(signal ? { signal } : {}),
    });
    return { forwarded: res.ok };
  } catch {
    return { forwarded: false };
  }
}
