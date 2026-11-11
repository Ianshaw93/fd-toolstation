// The directory access token for this pane. The provider is registered by lib/fd-msal.ts
// from the FD Microsoft sign-in on the shared registration; with none registered nothing is
// sent. Beyond the shared client's own guard, only an access_as_user access token for the
// directory API in the FD tenant is returned: never an ID token or a Graph token.

import { DirectoryError, FD_SHARED_CLIENT_ID } from './vendor/fd-directory-client';

export const FD_TENANT_ID = '8c535dde-8170-4909-8edc-40bbff4924ba';

const ACCEPTED_AUDIENCES = new Set([`api://${FD_SHARED_CLIENT_ID}`, FD_SHARED_CLIENT_ID]);
const GRAPH_AUDIENCES = new Set(['00000003-0000-0000-c000-000000000000', 'https://graph.microsoft.com']);

export type DirectoryAccessTokenProvider = () => Promise<string>;

let registered: DirectoryAccessTokenProvider | null = null;

export function setDirectoryAccessTokenProvider(provider: DirectoryAccessTokenProvider | null): void {
  registered = provider;
}

/** Browser fixture runs only. Next inlines NODE_ENV, so production bundles drop this. */
export function fixtureToken(): string | null {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return null;
  const token = (window as unknown as { __FD_DIRECTORY_FIXTURE_TOKEN__?: unknown }).__FD_DIRECTORY_FIXTURE_TOKEN__;
  return typeof token === 'string' ? token : null;
}

function activeProvider(): DirectoryAccessTokenProvider | null {
  if (registered) return registered;
  const token = fixtureToken();
  return token ? async () => token : null;
}

export type TokenCheck = { ok: true } | { ok: false; code: 'not_an_access_token' | 'wrong_audience' };

export function checkDirectoryAccessToken(token: string): TokenCheck {
  const claims = decodeClaims(token);
  if (!claims) return { ok: false, code: 'not_an_access_token' };
  const aud = typeof claims.aud === 'string' ? claims.aud : '';
  if (GRAPH_AUDIENCES.has(aud)) return { ok: false, code: 'wrong_audience' };
  const scopes = typeof claims.scp === 'string' ? claims.scp.split(' ') : [];
  if (!scopes.length) return { ok: false, code: 'not_an_access_token' };
  if (!ACCEPTED_AUDIENCES.has(aud) || !scopes.includes('access_as_user')) return { ok: false, code: 'wrong_audience' };
  if (claims.tid !== FD_TENANT_ID) return { ok: false, code: 'wrong_audience' };
  if (typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now()) return { ok: false, code: 'not_an_access_token' };
  return { ok: true };
}

/** For createDirectoryClient's getAccessToken. Throws DirectoryError; never prompts. */
export async function getDirectoryAccessToken(): Promise<string> {
  const provider = activeProvider();
  if (!provider) throw new DirectoryError('interaction_required');
  const token = await provider();
  const check = checkDirectoryAccessToken(token);
  if (!check.ok) throw new DirectoryError(check.code);
  return token;
}

function decodeClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const claims: unknown = JSON.parse(atob(padded));
    return typeof claims === 'object' && claims !== null && !Array.isArray(claims)
      ? (claims as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
