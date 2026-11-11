import { fdMsalConfiguration, startFdSignIn, type FdMsalClient } from '../../lib/fd-msal';
import { getDirectoryAccessToken, setDirectoryAccessTokenProvider } from '../../lib/directory-auth';
import { FD_DIRECTORY_SCOPE } from '../../lib/vendor/fd-directory-client';
import { fixtureAccessToken } from '../../test-fixtures/directory-contract-v1';

const ACCOUNT = { homeAccountId: 'h', username: 'ian@firedynamicsgroup.com' };

function interactionRequired() {
  return Object.assign(new Error('interaction_required'), { name: 'InteractionRequiredAuthError', errorCode: 'interaction_required' });
}

function fakeClient(overrides: Partial<FdMsalClient> = {}): FdMsalClient & { calls: Record<string, unknown[]> } {
  const calls: Record<string, unknown[]> = { silent: [], popup: [], redirect: [] };
  let active: unknown = null;
  return {
    calls,
    initialize: async () => undefined,
    handleRedirectPromise: async () => null,
    getActiveAccount: () => active as never,
    getAllAccounts: () => [],
    setActiveAccount: (account: unknown) => {
      active = account;
    },
    acquireTokenSilent: async (request: unknown) => {
      calls.silent.push(request);
      return { accessToken: fixtureAccessToken(), idToken: 'id-token-not-used', account: ACCOUNT };
    },
    acquireTokenPopup: async (request: unknown) => {
      calls.popup.push(request);
      return { accessToken: fixtureAccessToken(), idToken: 'id-token-not-used', account: ACCOUNT };
    },
    loginRedirect: async (request: unknown) => {
      calls.redirect.push(request);
    },
    ...overrides,
  } as FdMsalClient & { calls: Record<string, unknown[]> };
}

describe('FD Microsoft sign-in for the Word pane', () => {
  afterEach(() => setDirectoryAccessTokenProvider(null));

  it('uses the existing shared registration, the FD tenant, and session storage', () => {
    const config = fdMsalConfiguration('https://fd-toolstation.vercel.app/addin/word');
    expect(config.auth.clientId).toBe('2b180b8a-7cd3-40b2-83dd-8338103ce41e');
    expect(config.auth.authority).toBe('https://login.microsoftonline.com/8c535dde-8170-4909-8edc-40bbff4924ba');
    expect(config.auth.redirectUri).toBe('https://fd-toolstation.vercel.app/addin/word');
    expect(config.cache.cacheLocation).toBe('sessionStorage');
  });

  it('inside Word with nested app auth, registers the provider from the Office account silently', async () => {
    const client = fakeClient();
    const createNested = jest.fn(async () => client);
    const result = await startFdSignIn({ host: 'word', nestedAppAuth: true, createNested, createStandard: jest.fn() });
    expect(createNested).toHaveBeenCalled();
    expect(result.state).toBe('signed_in');
    expect(client.calls.silent[0]).toMatchObject({ scopes: [FD_DIRECTORY_SCOPE] });
    expect(client.calls.popup).toHaveLength(0);
    await expect(getDirectoryAccessToken()).resolves.not.toBe('id-token-not-used');
  });

  it('inside Word, asks for the existing Microsoft account by popup only when the user presses sign in', async () => {
    let signedIn = false;
    const client = fakeClient({
      acquireTokenSilent: async () => {
        if (!signedIn) throw interactionRequired();
        return { accessToken: fixtureAccessToken(), idToken: 'x', account: ACCOUNT };
      },
      acquireTokenPopup: async () => {
        signedIn = true;
        return { accessToken: fixtureAccessToken(), idToken: 'x', account: ACCOUNT };
      },
    });
    const result = await startFdSignIn({ host: 'word', nestedAppAuth: true, createNested: async () => client, createStandard: jest.fn() });
    expect(result.state).toBe('needs_sign_in');
    await expect(getDirectoryAccessToken()).rejects.toMatchObject({ code: 'interaction_required' });
    await expect(result.signIn()).resolves.toBe('signed_in');
    await expect(getDirectoryAccessToken()).resolves.toMatch(/\./);
  });

  it('inside Word without nested app auth, reports exactly that instead of opening another sign-in', async () => {
    const createStandard = jest.fn();
    const result = await startFdSignIn({ host: 'word', nestedAppAuth: false, createNested: jest.fn(), createStandard });
    expect(result.state).toBe('unavailable');
    expect(result.reason).toMatch(/NestedAppAuth 1\.1/);
    expect(createStandard).not.toHaveBeenCalled();
    await expect(getDirectoryAccessToken()).rejects.toMatchObject({ code: 'interaction_required' });
  });

  it('in the browser preview, reuses an account already in this session', async () => {
    const client = fakeClient({ getAllAccounts: () => [ACCOUNT as never] });
    const result = await startFdSignIn({ host: 'preview', nestedAppAuth: false, createNested: jest.fn(), createStandard: async () => client });
    expect(result.state).toBe('signed_in');
    expect(client.calls.redirect).toHaveLength(0);
  });

  it('in the browser preview with no account, redirects to Microsoft only when the user presses sign in', async () => {
    const client = fakeClient();
    const result = await startFdSignIn({ host: 'preview', nestedAppAuth: false, createNested: jest.fn(), createStandard: async () => client });
    expect(result.state).toBe('needs_sign_in');
    expect(client.calls.redirect).toHaveLength(0);
    await result.signIn();
    expect(client.calls.redirect[0]).toMatchObject({ scopes: [FD_DIRECTORY_SCOPE] });
  });

  it('reports an MSAL start failure with its error code', async () => {
    const result = await startFdSignIn({
      host: 'word',
      nestedAppAuth: true,
      createNested: async () => {
        throw Object.assign(new Error('bad'), { errorCode: 'invalid_request' });
      },
      createStandard: jest.fn(),
    });
    expect(result.state).toBe('unavailable');
    expect(result.reason).toMatch(/invalid_request/);
  });
});
