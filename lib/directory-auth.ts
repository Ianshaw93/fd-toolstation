// Delegated FD access token for the project directory API. The token comes from the
// existing FD (MSAL) session through a provider registered by the host; this pane never
// starts its own sign-in. With no provider, or a token that is not an access_as_user
// access token for the directory API in the FD tenant, nothing is sent.

export const DIRECTORY_API_APP_ID = '2b180b8a-7cd3-40b2-83dd-8338103ce41e';
export const DIRECTORY_API_SCOPE = `api://${DIRECTORY_API_APP_ID}/access_as_user`;
export const FD_TENANT_ID = '8c535dde-8170-4909-8edc-40bbff4924ba';

const ACCEPTED_AUDIENCES = new Set([`api://${DIRECTORY_API_APP_ID}`, DIRECTORY_API_APP_ID]);

export type DirectoryAccessTokenProvider = (scopes: string[]) => Promise<string>;

export type DirectoryAuthErrorCode = 'sign_in_unavailable' | 'wrong_token';

export class DirectoryAuthError extends Error {
  readonly code: DirectoryAuthErrorCode;
  readonly status = 401;

  constructor(code: DirectoryAuthErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

let registered: DirectoryAccessTokenProvider | null = null;

export function setDirectoryAccessTokenProvider(provider: DirectoryAccessTokenProvider | null): void {
  registered = provider;
}

function activeProvider(): DirectoryAccessTokenProvider | null {
  if (registered) return registered;
  // Browser fixture runs only. Next inlines NODE_ENV, so production bundles drop this.
  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    const token = (window as unknown as { __FD_DIRECTORY_FIXTURE_TOKEN__?: unknown }).__FD_DIRECTORY_FIXTURE_TOKEN__;
    if (typeof token === 'string') return async () => token;
  }
  return null;
}

export type TokenCheck = { ok: true } | { ok: false; reason: string };

export function checkDirectoryAccessToken(token: string): TokenCheck {
  const claims = decodeClaims(token);
  if (!claims) return { ok: false, reason: 'not_a_jwt' };
  if (typeof claims.aud !== 'string' || !ACCEPTED_AUDIENCES.has(claims.aud)) return { ok: false, reason: 'audience' };
  if (claims.tid !== FD_TENANT_ID) return { ok: false, reason: 'tenant' };
  const scopes = typeof claims.scp === 'string' ? claims.scp.split(' ') : [];
  if (!scopes.includes('access_as_user')) return { ok: false, reason: 'scope' };
  if (typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now()) return { ok: false, reason: 'expired' };
  return { ok: true };
}

/** `Bearer <token>` for the directory, or a DirectoryAuthError. Never prompts. */
export async function directoryAuthorization(): Promise<string> {
  const provider = activeProvider();
  if (!provider) {
    throw new DirectoryAuthError(
      'sign_in_unavailable',
      'FD sign-in is not available in this pane. Fill in the project and client details by hand.',
    );
  }
  let token: string;
  try {
    token = await provider([DIRECTORY_API_SCOPE]);
  } catch {
    throw new DirectoryAuthError(
      'sign_in_unavailable',
      'Sign in to your FD account to search the project directory. Client details stay as you typed them.',
    );
  }
  if (!checkDirectoryAccessToken(token).ok) {
    throw new DirectoryAuthError(
      'wrong_token',
      'The FD sign-in did not give a project directory token. Client details stay as you typed them.',
    );
  }
  return `Bearer ${token}`;
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
