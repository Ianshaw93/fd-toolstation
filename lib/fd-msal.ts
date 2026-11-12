// FD Microsoft sign-in for the Word pane, on the shared FD registration that Upload Canvas,
// backendForNextApp and the email-search add-in use (same client id, tenant authority and
// session cache as Upload Canvas's AuthGate). Inside Word it uses nested app authentication so
// the token comes from the account already signed in to Word; the pane never shows its own
// sign-in form. In a plain browser (preview) it reuses this tab's MSAL session and only
// redirects to Microsoft when the user presses Sign in.

import type { Configuration } from '@azure/msal-browser';
import { fixtureAccount, fixtureToken, FD_TENANT_ID, setDirectoryAccessTokenProvider } from './directory-auth';
import type { FdAccount } from './engineer-identity';
import { DirectoryError, FD_DIRECTORY_SCOPE, FD_SHARED_CLIENT_ID, msalAccessTokenProvider } from './vendor/fd-directory-client';

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
  // The shared provider returns only the access token; keep the account MSAL returned with it.
  const recording = {
    acquireTokenSilent: async (request: { scopes: string[]; account?: never }) => {
      try {
        const token = await client.acquireTokenSilent(request);
        if (token.account) client.setActiveAccount(token.account);
        if (token.accessToken) activeToken = token.accessToken;
        return token;
      } catch (err) {
        if (activeToken) {
          return { accessToken: activeToken, account: account() ?? null };
        }
        throw err;
      }
    },
  };
  const provider = msalAccessTokenProvider(recording, account);

  const result: FdSignIn = { state: 'checking', reason: null, account: null, signIn: async () => result.state };

  const trySilent = async (): Promise<FdSignInState> => {
    result.account = null;
    if (options.host === 'preview' && !account()) return 'needs_sign_in';
    try {
      await provider();
    } catch (error) {
      if (error instanceof DirectoryError && (error.code === 'interaction_required' || error.code === 'no_access_token')) {
        return 'needs_sign_in';
      }
      result.reason = msalFailure(error);
      return 'unavailable';
    }
    const signedIn = account();
    if (signedIn) client.setActiveAccount(signedIn);
    result.account = signedIn ? { key: signedIn.homeAccountId, username: signedIn.username, name: signedIn.name ?? null } : null;
    result.reason = null;
    setDirectoryAccessTokenProvider(provider);
    return 'signed_in';
  };

  result.signIn = async () => {
    try {
      if (options.host === 'word') {
        const popup = await client.acquireTokenPopup({ scopes: [FD_DIRECTORY_SCOPE] });
        if (popup.account) client.setActiveAccount(popup.account);
        if (popup.accessToken) activeToken = popup.accessToken;
      } else {
        await client.loginRedirect({
          scopes: [FD_DIRECTORY_SCOPE],
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
