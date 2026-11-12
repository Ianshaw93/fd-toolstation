// FD Microsoft sign-in for the Word pane, matching Mail Marshal's Outlook add-in pattern.
// Inside Word it uses nested app authentication with SSO_SCOPES (openid, profile, email, User.Read)
// so the token comes from the account already signed in to Word without per-user consent prompts.
// The ID token is verified server-side at /api/auth/microsoft which sets an httpOnly session cookie
// and returns a signed session token.

import type { Configuration } from '@azure/msal-browser';
import { fixtureAccount, fixtureToken, FD_TENANT_ID, setDirectoryAccessTokenProvider } from './directory-auth';
import type { FdAccount } from './engineer-identity';
import { DirectoryError, FD_SHARED_CLIENT_ID } from './vendor/fd-directory-client';

export const SSO_SCOPES = ['openid', 'profile', 'email', 'User.Read'];

export type FdSignInState = 'checking' | 'signed_in' | 'needs_sign_in' | 'unavailable';

export interface FdSignIn {
  state: FdSignInState;
  reason: string | null;
  /** The MSAL account once signed in; null otherwise. */
  account: FdAccount | null;
  signIn: () => Promise<FdSignInState>;
}

interface Account {
  homeAccountId: string;
  username: string;
  name?: string;
}

interface TokenResult {
  accessToken?: string;
  idToken?: string;
  account?: Account | null;
}

/** The parts of an MSAL PublicClientApplication / nestable application this pane uses. */
export interface FdMsalClient {
  initialize(): Promise<void>;
  handleRedirectPromise(): Promise<TokenResult | null>;
  getActiveAccount(): Account | null;
  getAllAccounts(): Account[];
  setActiveAccount(account: Account | null): void;
  acquireTokenSilent(request: { scopes: string[]; account?: never }): Promise<TokenResult>;
  acquireTokenPopup(request: { scopes: string[] }): Promise<TokenResult>;
  loginRedirect(request: { scopes: string[]; redirectStartPage?: string }): Promise<void>;
}

export const FD_AUTHORITY = `https://login.microsoftonline.com/${FD_TENANT_ID}`;

export const NESTED_APP_AUTH_UNAVAILABLE =
  'This Word does not support nested app authentication (NestedAppAuth 1.1), which the pane needs to reuse your Microsoft 365 sign-in. Update Word (Microsoft 365), or fill in the details by hand.';

export function fdMsalConfiguration(redirectUri: string) {
  return {
    auth: { clientId: FD_SHARED_CLIENT_ID, authority: FD_AUTHORITY, redirectUri },
    cache: { cacheLocation: 'sessionStorage' as const },
  } satisfies Configuration;
}

export interface StartOptions {
  host: 'word' | 'preview';
  nestedAppAuth: boolean;
  createNested: (config: Configuration) => Promise<FdMsalClient>;
  createStandard: (config: Configuration) => Promise<FdMsalClient>;
  redirectUri?: string;
  startPage?: string;
  exchangeToken?: (idToken: string) => Promise<{ token: string; email?: string; name?: string } | null>;
}

export async function startFdSignIn(options: StartOptions): Promise<FdSignIn> {
  setDirectoryAccessTokenProvider(null);
  if (fixtureToken()) {
    const fixture = fixtureAccount();
    return {
      state: 'signed_in',
      reason: 'Fixture token (development only).',
      account: fixture ? { key: 'fixture', ...fixture } : null,
      signIn: async () => 'signed_in',
    };
  }
  if (options.host === 'word' && !options.nestedAppAuth) {
    return { state: 'unavailable', reason: NESTED_APP_AUTH_UNAVAILABLE, account: null, signIn: async () => 'unavailable' };
  }
  const redirectUri = options.redirectUri ?? (typeof window !== 'undefined' ? `${window.location.origin}/addin/word` : '');
  const config = fdMsalConfiguration(redirectUri);

  let client: FdMsalClient;
  try {
    if (options.host === 'word') {
      client = await options.createNested(config);
    } else {
      client = await options.createStandard(config);
      await client.initialize();
      const redirect = await client.handleRedirectPromise();
      if (redirect?.account) client.setActiveAccount(redirect.account);
    }
  } catch (error) {
    return { state: 'unavailable', reason: msalFailure(error), account: null, signIn: async () => 'unavailable' };
  }

  let activeToken: string | null = null;
  const account = () => client.getActiveAccount() ?? client.getAllAccounts()[0] ?? undefined;

  const establishSession = async (tokenResult: TokenResult): Promise<string> => {
    const acct = tokenResult.account ?? account();
    const idToken = tokenResult.idToken;

    if (idToken) {
      if (options.exchangeToken) {
        try {
          const data = await options.exchangeToken(idToken);
          if (data?.token) {
            if (data.email) {
              result.account = { key: data.email, username: data.email, name: data.name ?? null };
            }
            return data.token;
          }
        } catch {
          // ignore error and proceed
        }
      } else if (typeof fetch === 'function') {
        try {
          const res = await fetch('/api/auth/microsoft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.token) {
              if (data.email) {
                result.account = { key: data.email, username: data.email, name: data.name ?? null };
              } else if (acct) {
                result.account = { key: acct.homeAccountId || acct.username, username: acct.username, name: acct.name ?? null };
              }
              return data.token;
            }
          }
        } catch {
          // ignore error and proceed
        }
      }
    }

    if (acct) {
      result.account = { key: acct.homeAccountId || acct.username, username: acct.username, name: acct.name ?? null };
    }

    throw new DirectoryError('no_access_token');
  };

  const provider = async (): Promise<string> => {
    if (activeToken) return activeToken;
    const acct = account();
    if (!acct) throw new DirectoryError('interaction_required');
    const token = await client.acquireTokenSilent({ scopes: SSO_SCOPES, account: acct as never });
    if (token.account) client.setActiveAccount(token.account);
    activeToken = await establishSession(token);
    return activeToken;
  };

  const result: FdSignIn = { state: 'checking', reason: null, account: null, signIn: async () => result.state };

  const trySilent = async (): Promise<FdSignInState> => {
    result.account = null;
    if (options.host === 'preview' && !account()) return 'needs_sign_in';
    try {
      let token: TokenResult | undefined;
      try {
        token = await client.acquireTokenSilent({ scopes: SSO_SCOPES, account: account() as never });
        if (token.account) client.setActiveAccount(token.account);
      } catch (err) {
        const e = err as { name?: string; errorCode?: string } | null;
        const interaction =
          e?.name === 'InteractionRequiredAuthError' ||
          ['interaction_required', 'login_required', 'consent_required', 'no_account_error'].includes(e?.errorCode ?? '');
        throw new DirectoryError(interaction ? 'interaction_required' : 'no_access_token');
      }

      if (!token) throw new DirectoryError('no_access_token');
      activeToken = await establishSession(token);
    } catch (error) {
      if (error instanceof DirectoryError && (error.code === 'interaction_required' || error.code === 'no_access_token')) {
        return 'needs_sign_in';
      }
      result.reason = msalFailure(error);
      return 'unavailable';
    }

    const signedIn = account();
    if (signedIn) client.setActiveAccount(signedIn);
    if (!result.account && signedIn) {
      result.account = { key: signedIn.homeAccountId, username: signedIn.username, name: signedIn.name ?? null };
    }
    result.reason = null;
    setDirectoryAccessTokenProvider(provider);
    return 'signed_in';
  };

  result.signIn = async () => {
    try {
      if (options.host === 'word') {
        const popup = await client.acquireTokenPopup({ scopes: SSO_SCOPES });
        if (popup.account) client.setActiveAccount(popup.account);
        activeToken = await establishSession(popup);
      } else {
        await client.loginRedirect({
          scopes: SSO_SCOPES,
          redirectStartPage: options.startPage ?? (typeof window !== 'undefined' ? window.location.href : undefined),
        });
        return result.state;
      }
    } catch (error) {
      result.reason = msalFailure(error);
      return result.state;
    }
    result.state = await trySilent();
    return result.state;
  };

  result.state = await trySilent();
  return result;
}

function msalFailure(error: unknown): string {
  const e = error as { errorCode?: string; code?: string; message?: string } | null;
  const code = e?.errorCode ?? e?.code ?? e?.message ?? 'unknown_error';
  return `Microsoft sign-in did not complete (${code}). Fill in the details by hand.`;
}
