'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { IPublicClientApplication } from '@azure/msal-browser';
import { AuthContext, type AuthAccount } from '../lib/auth/AuthContext';
import { apiScope, authority, entraConfig, identityScopes } from '../lib/auth/config';
import { setTokenProvider } from '../lib/auth/token';

const SIGNED_OUT_KEY = 'fd-toolstation-signed-out';
let clientPromise: Promise<IPublicClientApplication> | null = null;
let redirectPromise: Promise<unknown> | null = null;
let loginRedirectPromise: Promise<void> | null = null;

function getMsalClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { PublicClientApplication } = await import('@azure/msal-browser');
      const client = new PublicClientApplication({
        auth: {
          clientId: entraConfig.clientId,
          authority,
          redirectUri: window.location.origin,
        },
        cache: { cacheLocation: 'sessionStorage' },
      });
      await client.initialize();
      return client;
    })();
  }
  return clientPromise;
}

function handleRedirectOnce(client: IPublicClientApplication) {
  if (!redirectPromise) {
    redirectPromise = client.handleRedirectPromise().finally(() => {
      redirectPromise = null;
    });
  }
  return redirectPromise;
}

function startLoginRedirect(client: IPublicClientApplication) {
  if (!loginRedirectPromise) {
    loginRedirectPromise = client.loginRedirect({ scopes: apiScope ? [apiScope] : identityScopes }).finally(() => {
      loginRedirectPromise = null;
    });
  }
  return loginRedirectPromise;
}

function canUseMockAuth() {
  if (process.env.NEXT_PUBLIC_AUTH_DISABLED !== 'true' || typeof window === 'undefined') return false;
  const local = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const preview = process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'preview'
    && window.location.hostname !== 'fd-toolstation.vercel.app';
  return local || preview;
}

function MockAuthProvider({ children }: { children: ReactNode }) {
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    setTokenProvider(async () => null);
    return () => setTokenProvider(async () => null);
  }, []);

  if (signedOut) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 p-6 text-white">
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-8 text-center shadow-xl">
          <h1 className="text-xl font-semibold">You’re signed out</h1>
          <button
            type="button"
            onClick={() => setSignedOut(false)}
            className="mt-6 rounded-lg bg-white px-4 py-2 font-medium text-gray-900 hover:bg-gray-200"
          >
            Continue as dev user
          </button>
        </div>
      </main>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        account: { oid: 'dev-user', name: 'Dev', username: 'dev@firedynamicsgroup.com' },
        ready: true,
        signOut: async () => setSignedOut(true),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function MicrosoftAuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const clientRef = useRef<IPublicClientApplication | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function signIn() {
      const client = await getMsalClient();
      await handleRedirectOnce(client);
      if (cancelled) return;
      clientRef.current = client;

      if (window.sessionStorage.getItem(SIGNED_OUT_KEY) === '1') {
        window.sessionStorage.removeItem(SIGNED_OUT_KEY);
        setSignedOut(true);
        return;
      }

      const signedIn = client.getActiveAccount() || client.getAllAccounts()[0];

      if (!signedIn) {
        await startLoginRedirect(client);
        return;
      }

      client.setActiveAccount(signedIn);

      setTokenProvider(async () => {
        const scopes = apiScope ? [apiScope] : identityScopes;
        const result = await client.acquireTokenSilent({ account: signedIn, scopes });
        return apiScope ? result.accessToken : result.idToken;
      });

      const oid = signedIn.idTokenClaims?.oid;
      setAccount({
        oid: typeof oid === 'string' ? oid : undefined,
        name: signedIn.name || signedIn.username,
        username: signedIn.username,
      });
    }

    signIn().catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason : new Error(String(reason)));
    });

    return () => {
      cancelled = true;
      setTokenProvider(async () => null);
    };
  }, []);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 p-6 text-white">
        <div className="max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-8 shadow-xl">
          <h1 className="text-xl font-semibold">Microsoft sign-in could not be completed</h1>
          <p className="mt-3 break-words text-sm text-gray-300">{error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-white px-4 py-2 font-medium text-gray-900 hover:bg-gray-200"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (signedOut) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 p-6 text-white">
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-8 text-center shadow-xl">
          <h1 className="text-xl font-semibold">You’re signed out</h1>
          <p className="mt-2 text-sm text-gray-300">Sign in with your Fire Dynamics Microsoft account to continue.</p>
          <button
            type="button"
            onClick={() => {
              const client = clientRef.current;
              if (!client) return window.location.reload();
              setSignedOut(false);
              setError(null);
              startLoginRedirect(client).catch((reason: unknown) => {
                setError(reason instanceof Error ? reason : new Error(String(reason)));
              });
            }}
            className="mt-6 rounded-lg bg-white px-4 py-2 font-medium text-gray-900 hover:bg-gray-200"
          >
            Sign in with Microsoft
          </button>
        </div>
      </main>
    );
  }

  if (!account) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 text-white" aria-live="polite">
        Signing in with Microsoft…
      </main>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        account,
        ready: true,
        signOut: async () => {
          const client = clientRef.current;
          if (!client) return;
          const activeAccount = client.getActiveAccount();
          window.sessionStorage.setItem(SIGNED_OUT_KEY, '1');
          setTokenProvider(async () => null);
          setAccount(null);
          setSignedOut(true);
          try {
            await client.logoutRedirect({ account: activeAccount ?? undefined, postLogoutRedirectUri: window.location.origin });
          } catch (reason) {
            window.sessionStorage.removeItem(SIGNED_OUT_KEY);
            setError(reason instanceof Error ? reason : new Error(String(reason)));
          }
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [authMode, setAuthMode] = useState<'checking' | 'mock' | 'microsoft'>('checking');

  useEffect(() => {
    setAuthMode(canUseMockAuth() ? 'mock' : 'microsoft');
  }, []);

  // Word add-in routes manage their own Office SSO / session flow inside the taskpane.
  if (pathname?.startsWith('/addin')) {
    return <>{children}</>;
  }

  if (authMode === 'checking') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950 text-white" aria-live="polite">
        Preparing sign-in…
      </main>
    );
  }

  return authMode === 'mock'
    ? <MockAuthProvider>{children}</MockAuthProvider>
    : <MicrosoftAuthProvider>{children}</MicrosoftAuthProvider>;
}
